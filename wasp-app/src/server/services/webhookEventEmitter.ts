/**
 * Webhook Delivery Service
 * Manages webhook event queuing and delivery orchestration
 */

import * as crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { webhookDeliveryQueue } from '../queues/config.js';

const prisma = new PrismaClient();

export interface WebhookEvent {
  scanId: string;
  eventType: 'scan_complete' | 'scan_failed' | 'report_ready';
  userId: string;
  payload: any;
  timestamp: Date;
}

export interface DeliveryQueueJob {
  deliveryId: string;
  webhookId: string;
  scanId: string;
  eventType: string;
  payload: string;
  payloadHash: string;
  targetUrl: string;
  signingSecretEncrypted: Buffer;
  attemptNumber: number;
}

/**
 * Emit a webhook event
 * Finds all webhooks subscribed to the event and enqueues delivery jobs
 * @param event The webhook event to emit
 */
export async function emitWebhookEvent(event: WebhookEvent): Promise<void> {
  try {
    const { scanId, eventType, userId, payload, timestamp } = event;

    // Find all enabled webhooks for this user that subscribe to this event
    const webhooks = await prisma.webhook.findMany({
      where: {
        userId,
        enabled: true,
        events: {
          has: eventType,
        },
      },
    });

    if (webhooks.length === 0) {
      console.log(`[WebhookEmitter] No webhooks found for event: ${eventType}, user: ${userId}`);
      return;
    }

    console.log(
      `[WebhookEmitter] Found ${webhooks.length} webhooks for event: ${eventType}, scan: ${scanId}`
    );

    // Create payload string for signing
    const payloadStr = JSON.stringify(payload);
    const payloadHash = crypto
      .createHash('sha256')
      .update(payloadStr)
      .digest('hex');

    // Find existing deliveries to prevent duplicates (idempotency) in a single query
    const existingDeliveries = await prisma.webhookDelivery.findMany({
      where: {
        webhookId: { in: webhooks.map((w) => w.id) },
        scanId: scanId,
        payloadHash: payloadHash,
      },
    });

    const existingWebhookIds = new Set(existingDeliveries.map((d) => d.webhookId));

    // Filter out webhooks that already have a delivery for this event/scan/payload
    const newWebhooks = webhooks.filter((w) => !existingWebhookIds.has(w.id));

    if (existingWebhookIds.size > 0) {
      console.log(
        `[WebhookEmitter] Skipping ${existingWebhookIds.size} duplicate deliveries for scan ${scanId}`
      );
    }

    if (newWebhooks.length === 0) {
      return;
    }

    // Create WebhookDelivery records in a transaction
    const deliveryCreates = newWebhooks.map((webhook) => {
      return prisma.webhookDelivery.create({
        data: {
          webhookId: webhook.id,
          scanId: scanId,
          eventType: eventType,
          payload: payload,
          targetUrl: webhook.url,
          payloadHash: payloadHash,
          attemptNumber: 1, // Initial attempt
          status: 'pending',
        },
      });
    });

    let createdDeliveries: any[] = [];
    try {
      createdDeliveries = await prisma.$transaction(deliveryCreates);
    } catch (error) {
      console.error(
        `[WebhookEmitter] Failed to create webhook deliveries in transaction:`,
        error instanceof Error ? error.message : String(error)
      );
      // Fallback: If transaction fails, try individually so we don't drop all of them
      for (const webhook of newWebhooks) {
        try {
          const delivery = await prisma.webhookDelivery.create({
            data: {
              webhookId: webhook.id,
              scanId: scanId,
              eventType: eventType,
              payload: payload,
              targetUrl: webhook.url,
              payloadHash: payloadHash,
              attemptNumber: 1,
              status: 'pending',
            },
          });
          createdDeliveries.push(delivery);
        } catch (innerError) {
          console.error(
            `[WebhookEmitter] Failed to create webhook delivery for ${webhook.id}:`,
            innerError instanceof Error ? innerError.message : String(innerError)
          );
        }
      }
    }

    // Enqueue delivery jobs for each successfully created delivery
    const queuePromises = createdDeliveries.map((delivery) => {
      const webhook = newWebhooks.find((w) => w.id === delivery.webhookId);
      if (!webhook) return Promise.resolve();

      const jobData: DeliveryQueueJob = {
        deliveryId: delivery.id,
        webhookId: webhook.id,
        scanId: scanId,
        eventType: eventType,
        payload: payloadStr,
        payloadHash: payloadHash,
        targetUrl: webhook.url,
        signingSecretEncrypted: webhook.signingSecretEncrypted,
        attemptNumber: 1, // Will be updated on retry based on job.attemptsMade
      };

      return webhookDeliveryQueue.add(
        `delivery-${delivery.id}`,
        jobData,
        {
          priority: 5, // Normal priority for webhooks
          attempts: 5, // Retry up to 5 times
          backoff: {
            type: 'exponential',
            delay: 2000, // Start at 2s, exponential backoff
          },
          removeOnComplete: true,
          removeOnFail: false,
        }
      ).then(() => {
        console.log(
          `[WebhookEmitter] Skipping duplicate delivery: webhook ${w.id}, scan ${scanId}`
        );
      }).catch((error) => {
        console.error(
          `[WebhookEmitter] Failed to enqueue webhook ${webhook.id}:`,
          error instanceof Error ? error.message : String(error)
        );
      });
    });

    await Promise.allSettled(queuePromises);
  } catch (error) {
    console.error(
      `[WebhookEmitter] Failed to emit webhook event:`,
      error instanceof Error ? error.message : String(error)
    );
    // Don't throw - webhook delivery is best-effort and shouldn't fail main flow
  }
}

/**
 * Build a webhook payload for a scan event
 */
export function buildWebhookPayload(
  eventType: string,
  scanId: string,
  userId: string,
  scanData: any
): any {
  const basePayload = {
    event: eventType,
    timestamp: new Date().toISOString(),
    data: {
      scanId,
      userId,
      ...scanData,
    },
  };

  return basePayload;
}

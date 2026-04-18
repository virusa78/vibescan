/**
 * Webhook Delivery Service
 * Manages webhook event queuing and delivery orchestration
 */

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
    const payloadHash = require('crypto')
      .createHash('sha256')
      .update(payloadStr)
      .digest('hex');

    // Enqueue delivery jobs for each webhook
    for (const webhook of webhooks) {
      try {
        // Check for duplicate delivery (idempotency)
        const existingDelivery = await prisma.webhookDelivery.findFirst({
          where: {
            webhookId: webhook.id,
            scanId: scanId,
            payloadHash: payloadHash,
          },
        });

        if (existingDelivery) {
          console.log(
            `[WebhookEmitter] Skipping duplicate delivery: webhook ${webhook.id}, scan ${scanId}`
          );
          continue;
        }

        // Create WebhookDelivery record
        const delivery = await prisma.webhookDelivery.create({
          data: {
            webhookId: webhook.id,
            scanId: scanId,
            targetUrl: webhook.url,
            payloadHash: payloadHash,
            attemptNumber: 1,
            status: 'pending',
          },
        });

        // Enqueue delivery job
        const jobData: DeliveryQueueJob = {
          webhookId: webhook.id,
          scanId: scanId,
          eventType: eventType,
          payload: payloadStr,
          payloadHash: payloadHash,
          targetUrl: webhook.url,
          signingSecretEncrypted: webhook.signingSecretEncrypted,
          attemptNumber: 1,
        };

        await webhookDeliveryQueue.add(
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
        );

        console.log(
          `[WebhookEmitter] Enqueued delivery job for webhook: ${webhook.id}, delivery: ${delivery.id}`
        );
      } catch (error) {
        console.error(
          `[WebhookEmitter] Failed to enqueue webhook ${webhook.id}:`,
          error instanceof Error ? error.message : String(error)
        );
        // Continue with next webhook instead of failing entire event
      }
    }
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

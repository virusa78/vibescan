/**
 * Webhook Delivery Worker
 * Processes webhook delivery jobs from the queue
 * Handles HTTP POST, retry logic, and error handling
 */

import * as http from 'http';
import * as https from 'https';
import { PrismaClient } from '@prisma/client';
import { signWebhookPayload } from '../services/webhookSigner.js';
import type { DeliveryQueueJob } from '../services/webhookEventEmitter.js';

const prisma = new PrismaClient();

const DELIVERY_TIMEOUT = 30000; // 30 seconds
const MAX_RETRIES = 5;

/**
 * HTTP client factory to handle both http and https
 */
function httpRequest(url: string, options: any, data: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;

    const req = client.request(url, options, (res) => {
      let body = '';

      res.on('data', (chunk) => {
        body += chunk;
      });

      res.on('end', () => {
        resolve({
          status: res.statusCode || 500,
          body: body.substring(0, 1000), // Limit response body to 1000 chars
        });
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.setTimeout(DELIVERY_TIMEOUT);
    req.write(data);
    req.end();
  });
}

/**
 * Process a webhook delivery job
 */
export async function webhookDeliveryWorker(job: any): Promise<any> {
  const data: DeliveryQueueJob = job.data;
  const { webhookId, scanId, eventType, payload, payloadHash, targetUrl, signingSecretEncrypted } = data;
  
  // Use BullMQ's attemptsMade to get actual attempt number (0-based, so add 1)
  const attemptNumber = (job.attemptsMade || 0) + 1;

  console.log(
    `[WebhookWorker] Processing delivery job: webhook=${webhookId}, scan=${scanId}, attempt=${attemptNumber}`
  );

  try {
    // Generate signature
    const { signature } = signWebhookPayload(payload, signingSecretEncrypted);

    // Prepare headers
    const headers = {
      'Content-Type': 'application/json',
      'X-Vibescan-Signature': `sha256=${signature}`,
      'X-Vibescan-Event': eventType,
      'X-Vibescan-Timestamp': new Date().toISOString(),
    };

    // Make HTTP request
    let httpStatus = 500;
    let responseBody = '';

    try {
      const response = await httpRequest(targetUrl, {
        method: 'POST',
        headers,
      }, payload);

      httpStatus = response.status;
      responseBody = response.body;
    } catch (error) {
      // Network error or timeout
      console.warn(
        `[WebhookWorker] HTTP error for ${targetUrl}: ${error instanceof Error ? error.message : String(error)}`
      );
      httpStatus = 0;
      responseBody = error instanceof Error ? error.message : String(error);
    }

    // Update WebhookDelivery record with targeted update (not updateMany)
    // This ensures atomicity and prevents accidental bulk updates
    const deliveryRecord = await prisma.webhookDelivery.findFirst({
      where: {
        webhookId,
        scanId,
        payloadHash,
      },
    });

    if (!deliveryRecord) {
      console.warn(`[WebhookWorker] Delivery record not found for ${webhookId}/${scanId}`);
      throw new Error('Delivery record not found');
    }

    const status = httpStatus >= 200 && httpStatus < 300 ? 'delivered' : 'failed';

    await prisma.webhookDelivery.update({
      where: { id: deliveryRecord.id },
      data: {
        httpStatus,
        responseBody,
        attemptNumber,
        status,
        deliveredAt: status === 'delivered' ? new Date() : null,
        nextRetryAt: status === 'failed' && attemptNumber < MAX_RETRIES ? calculateNextRetry(attemptNumber) : null,
      },
    });

    if (status === 'delivered') {
      console.log(`[WebhookWorker] ✅ Successfully delivered webhook to ${targetUrl}`);
      return { success: true, status: httpStatus };
    } else if (attemptNumber >= MAX_RETRIES) {
      console.error(`[WebhookWorker] ❌ Max retries exceeded for ${targetUrl}`);
      // Mark as exhausted with targeted update
      await prisma.webhookDelivery.update({
        where: { id: deliveryRecord.id },
        data: {
          status: 'exhausted',
        },
      });
      throw new Error(`Delivery failed after ${MAX_RETRIES} attempts. Last status: ${httpStatus}`);
    } else {
      console.warn(`[WebhookWorker] ⚠️ Delivery failed with status ${httpStatus}, will retry`);
      throw new Error(`Delivery failed with status ${httpStatus}. Attempt ${attemptNumber}/${MAX_RETRIES}`);
    }
  } catch (error) {
    console.error(
      `[WebhookWorker] Job failed: ${error instanceof Error ? error.message : String(error)}`
    );
    throw error;
  }
}

/**
 * Calculate next retry time with exponential backoff
 * Attempts: 1s, 2s, 4s, 8s, 16s, 32s
 */
function calculateNextRetry(attemptNumber: number): Date {
  const delays = [1000, 2000, 4000, 8000, 16000, 32000];
  const delay = delays[Math.min(attemptNumber, delays.length - 1)];
  return new Date(Date.now() + delay);
}

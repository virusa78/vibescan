import { HttpError, prisma } from 'wasp/server';
import { webhookDeliveryQueue } from '../../queues/config.js';
import * as z from 'zod';
import { ensureArgsSchemaOrThrowHttpError } from '../../validation.js';

const retryDeliveryInputSchema = z.object({
  webhookId: z.string().uuid('Invalid webhook ID'),
  deliveryId: z.string().uuid('Invalid delivery ID'),
});

export type RetryWebhookDeliveryInput = z.infer<typeof retryDeliveryInputSchema>;

const retryableStatuses = new Set(['failed', 'exhausted']);

export async function retryWebhookDelivery(rawArgs: unknown, context: any): Promise<any> {
  if (!context.user) {
    throw new HttpError(401, 'User not authenticated');
  }

  const args = ensureArgsSchemaOrThrowHttpError(retryDeliveryInputSchema, rawArgs);

  const webhook = await prisma.webhook.findUnique({ where: { id: args.webhookId } });
  if (!webhook || webhook.userId !== context.user.id) {
    throw new HttpError(404, 'Webhook not found');
  }

  const sourceDelivery = await prisma.webhookDelivery.findFirst({
    where: {
      id: args.deliveryId,
      webhookId: args.webhookId,
    },
  });

  if (!sourceDelivery) {
    throw new HttpError(404, 'Delivery not found');
  }

  if (!retryableStatuses.has(sourceDelivery.status)) {
    throw new HttpError(422, 'Delivery is not eligible for manual retry', {
      error: 'validation_error',
      validation_errors: [{ field: 'deliveryId', message: 'not_retryable' }],
    });
  }

  if (!sourceDelivery.payload) {
    throw new HttpError(422, 'Payload is missing for this delivery', {
      error: 'validation_error',
      validation_errors: [{ field: 'deliveryId', message: 'missing_payload' }],
    });
  }

  const payload = JSON.stringify(sourceDelivery.payload);
  const retryDelivery = await prisma.webhookDelivery.create({
    data: {
      webhookId: sourceDelivery.webhookId,
      scanId: sourceDelivery.scanId,
      eventType: sourceDelivery.eventType,
      payload: sourceDelivery.payload,
      targetUrl: sourceDelivery.targetUrl,
      payloadHash: sourceDelivery.payloadHash,
      attemptNumber: 1,
      status: 'pending',
      manualRetryOfId: sourceDelivery.id,
    },
  });

  await webhookDeliveryQueue.add(
    `delivery-${retryDelivery.id}`,
    {
      deliveryId: retryDelivery.id,
      webhookId: sourceDelivery.webhookId,
      scanId: sourceDelivery.scanId,
      eventType: sourceDelivery.eventType,
      payload,
      payloadHash: sourceDelivery.payloadHash,
      targetUrl: sourceDelivery.targetUrl,
      signingSecretEncrypted: webhook.signingSecretEncrypted,
      attemptNumber: 1,
    },
    {
      priority: 4,
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: true,
      removeOnFail: false,
    },
  );

  return {
    queued: true,
    delivery_id: retryDelivery.id,
  } as any;
}

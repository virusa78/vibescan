import { HttpError, prisma } from 'wasp/server';
import * as crypto from 'crypto';
import * as z from 'zod';
import { ensureArgsSchemaOrThrowHttpError } from '../../validation.js';
import { webhookDeliveryQueue } from '../../queues/config.js';

const testDeliveryInputSchema = z.object({
  webhookId: z.string().uuid('Invalid webhook ID'),
});

export type TestWebhookDeliveryInput = z.infer<typeof testDeliveryInputSchema>;

async function getOrCreateSyntheticScanId(userId: string): Promise<string> {
  const latestScan = await prisma.scan.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });

  if (latestScan) {
    return latestScan.id;
  }

  const syntheticScan = await prisma.scan.create({
    data: {
      userId,
      inputType: 'github_app',
      inputRef: 'webhook:test',
      status: 'done',
      planAtSubmission: 'free_trial',
    },
    select: { id: true },
  });

  await prisma.scanDelta.create({
    data: {
      scanId: syntheticScan.id,
      totalFreeCount: 0,
      totalEnterpriseCount: 0,
      deltaCount: 0,
      deltaBySeverity: {},
      isLocked: false,
    },
  });

  return syntheticScan.id;
}

export async function testWebhookDelivery(rawArgs: unknown, context: any): Promise<{ queued: true; delivery_id: string }> {
  if (!context.user) {
    throw new HttpError(401, 'User not authenticated');
  }

  const args = ensureArgsSchemaOrThrowHttpError(testDeliveryInputSchema, rawArgs);

  const webhook = await prisma.webhook.findUnique({ where: { id: args.webhookId } });
  if (!webhook || webhook.userId !== context.user.id) {
    throw new HttpError(404, 'Webhook not found');
  }

  const scanId = await getOrCreateSyntheticScanId(context.user.id);
  const payloadBody = {
    event: 'webhook.test',
    timestamp: new Date().toISOString(),
    data: {
      scanId,
      userId: context.user.id,
      message: 'Manual test delivery from VibeScan',
    },
  };

  const payload = JSON.stringify(payloadBody);
  const payloadHash = crypto.createHash('sha256').update(payload).digest('hex');

  const delivery = await prisma.webhookDelivery.create({
    data: {
      webhookId: webhook.id,
      scanId,
      eventType: 'webhook.test',
      payload: payloadBody,
      targetUrl: webhook.url,
      payloadHash,
      attemptNumber: 1,
      status: 'pending',
    },
  });

  await webhookDeliveryQueue.add(
    `delivery-${delivery.id}`,
    {
      deliveryId: delivery.id,
      webhookId: webhook.id,
      scanId,
      eventType: 'webhook.test',
      payload,
      payloadHash,
      targetUrl: webhook.url,
      signingSecretEncrypted: webhook.signingSecretEncrypted,
      attemptNumber: 1,
    },
    {
      priority: 5,
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
    delivery_id: delivery.id,
  };
}

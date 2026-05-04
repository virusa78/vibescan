import { HttpError } from 'wasp/server';
import * as z from 'zod';
import { ensureArgsSchemaOrThrowHttpError } from '../../validation.js';
import {
  calculateWebhookDeliveryStats,
  type AuthenticatedUser,
  type WebhookDeliveryRecord,
  type WebhookDetailResponse,
  type WebhookOwnershipRecord,
} from './types.js';
import {
  assertWorkspaceOrLegacyOwnership,
  requireWorkspaceScopedUser,
} from '../../services/workspaceAccess';

const getWebhookInputSchema = z.object({
  webhookId: z.string().uuid('Invalid webhook ID'),
});

export type GetWebhookInput = z.infer<typeof getWebhookInputSchema>;


/**
 * Get detailed webhook information including delivery stats
 */
export async function getWebhook(
  rawArgs: unknown,
  context: any,
): Promise<any> {
  const user = await requireWorkspaceScopedUser(context.user);

  const args = ensureArgsSchemaOrThrowHttpError(getWebhookInputSchema, rawArgs);

  try {
    // Verify ownership
    const webhook = await context.entities.Webhook.findUnique({
      where: { id: args.webhookId },
    });

    if (!webhook) {
      throw new HttpError(404, 'Webhook not found');
    }

    assertWorkspaceOrLegacyOwnership(webhook, user, 'Webhook not found');

    // Get delivery stats
    const deliveries = await context.entities.WebhookDelivery.findMany({
      where: { webhookId: args.webhookId },
    });

    const deliveryStats = calculateWebhookDeliveryStats(deliveries);

    // Get last 5 deliveries
    const last5Deliveries = await context.entities.WebhookDelivery.findMany({
      where: { webhookId: args.webhookId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        scanId: true,
        status: true,
        httpStatus: true,
        eventType: true,
        attemptNumber: true,
        durationMs: true,
        createdAt: true,
        deliveredAt: true,
        payload: true,
        responseBody: true,
      },
    });

    return {
      webhook: {
        id: webhook.id,
        url: webhook.url,
        created_at: webhook.createdAt,
        events: webhook.events,
        enabled: webhook.enabled,
      },
      delivery_stats: deliveryStats,
      last_5_deliveries: last5Deliveries.map((d: any) => ({
        id: d.id,
        scan_id: d.scanId,
        status: d.status,
        http_status: d.httpStatus,
        event: d.eventType ?? 'scan_complete',
        attempt: d.attemptNumber,
        duration: d.durationMs ?? null,
        created_at: d.createdAt,
        delivered_at: d.deliveredAt,
        payload: d.payload ?? null,
        response: d.responseBody ?? null,
      })),
    };
  } catch (err) {
    if (err instanceof HttpError) {
      throw err;
    }
    throw new HttpError(500, 'Failed to retrieve webhook');
  }
}

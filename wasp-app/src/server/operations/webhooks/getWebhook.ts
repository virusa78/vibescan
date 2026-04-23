import { HttpError } from 'wasp/server';
import * as z from 'zod';
import { ensureArgsSchemaOrThrowHttpError } from '../../validation.js';

const getWebhookInputSchema = z.object({
  webhookId: z.string().uuid('Invalid webhook ID'),
});

export type GetWebhookInput = z.infer<typeof getWebhookInputSchema>;

export interface WebhookDeliveryStats {
  total_attempts: number;
  successful: number;
  failed: number;
  pending: number;
}

export interface WebhookDetailResponse {
  webhook: {
    id: string;
    url: string;
    created_at: Date;
    events: string[];
    enabled: boolean;
  };
  delivery_stats: WebhookDeliveryStats;
  last_5_deliveries: Array<{
    id: string;
    scan_id: string;
    status: string;
    http_status: number | null;
    event: string;
    attempt: number;
    duration: number | null;
    created_at: Date;
    delivered_at: Date | null;
    payload: unknown;
    response: string | null;
  }>;
}

/**
 * Get detailed webhook information including delivery stats
 */
export async function getWebhook(
  rawArgs: any,
  context: any
): Promise<WebhookDetailResponse> {
  if (!context.user) {
    throw new HttpError(401, 'User not authenticated');
  }

  const args = ensureArgsSchemaOrThrowHttpError(getWebhookInputSchema, rawArgs);

  try {
    // Verify ownership
    const webhook = await context.entities.Webhook.findUnique({
      where: { id: args.webhookId },
    });

    if (!webhook) {
      throw new HttpError(404, 'Webhook not found');
    }

    if (webhook.userId !== context.user.id) {
      throw new HttpError(404, 'Webhook not found');
    }

    // Get delivery stats
    const deliveries = await context.entities.WebhookDelivery.findMany({
      where: { webhookId: args.webhookId },
    });

    const deliveryStats: WebhookDeliveryStats = {
      total_attempts: deliveries.length,
      successful: deliveries.filter((d: any) => d.status === 'delivered').length,
      failed: deliveries.filter((d: any) => d.status === 'failed').length,
      pending: deliveries.filter((d: any) => d.status === 'pending').length,
    };

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

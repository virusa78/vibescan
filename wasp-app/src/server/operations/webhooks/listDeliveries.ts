import { HttpError } from 'wasp/server';
import * as z from 'zod';
import { ensureArgsSchemaOrThrowHttpError } from '../../validation.js';

const listDeliveriesInputSchema = z.object({
  webhookId: z.string().uuid('Invalid webhook ID'),
  limit: z.number().int().min(1).max(100).default(100),
  cursor: z.string().uuid().optional(),
});

export type ListWebhookDeliveriesInput = z.infer<typeof listDeliveriesInputSchema>;

export interface WebhookDeliveryListItem {
  id: string;
  status: string;
  status_code: number | null;
  duration: number | null;
  event: string;
  attempt: number;
  timestamp: string;
  delivered_at: string | null;
  scan_id: string;
  payload: unknown;
  response: string | null;
  manual_retry_of_id: string | null;
}

export interface ListWebhookDeliveriesResponse {
  deliveries: WebhookDeliveryListItem[];
  next_cursor: string | null;
}

export async function listWebhookDeliveries(
  rawArgs: unknown,
  context: any,
): Promise<ListWebhookDeliveriesResponse> {
  if (!context.user) {
    throw new HttpError(401, 'User not authenticated');
  }

  const args = ensureArgsSchemaOrThrowHttpError(listDeliveriesInputSchema, rawArgs);

  const webhook = await context.entities.Webhook.findUnique({ where: { id: args.webhookId } });
  if (!webhook || webhook.userId !== context.user.id) {
    throw new HttpError(404, 'Webhook not found');
  }

  const deliveries = await context.entities.WebhookDelivery.findMany({
    where: { webhookId: args.webhookId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    ...(args.cursor
      ? {
          cursor: { id: args.cursor },
          skip: 1,
        }
      : {}),
    take: args.limit + 1,
  });

  const hasMore = deliveries.length > args.limit;
  const pageItems = hasMore ? deliveries.slice(0, args.limit) : deliveries;

  return {
    deliveries: pageItems.map((delivery: any) => ({
      id: delivery.id,
      status: delivery.status,
      status_code: delivery.httpStatus,
      duration: delivery.durationMs ?? null,
      event: delivery.eventType ?? 'scan_complete',
      attempt: delivery.attemptNumber,
      timestamp: delivery.createdAt.toISOString(),
      delivered_at: delivery.deliveredAt ? delivery.deliveredAt.toISOString() : null,
      scan_id: delivery.scanId,
      payload: delivery.payload ?? null,
      response: delivery.responseBody ?? null,
      manual_retry_of_id: delivery.manualRetryOfId ?? null,
    })),
    next_cursor: hasMore ? pageItems[pageItems.length - 1]?.id ?? null : null,
  };
}

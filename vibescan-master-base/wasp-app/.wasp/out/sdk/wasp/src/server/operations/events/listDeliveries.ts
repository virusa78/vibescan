import * as z from 'zod';
import { ensureArgsSchemaOrThrowHttpError } from '../../validation.js';
import { requireWorkspaceScopedUser } from '../../services/workspaceAccess';

const listEventDeliveriesInputSchema = z.object({
  limit: z.number().int().min(1).max(100).default(100),
  status: z.enum(['pending', 'delivered', 'failed', 'exhausted']).optional(),
});

export async function listEventDeliveries(rawArgs: unknown, context: any): Promise<any> {
  const user = await requireWorkspaceScopedUser(context.user);
  const args = ensureArgsSchemaOrThrowHttpError(listEventDeliveriesInputSchema, rawArgs ?? {});

  const deliveries = await context.entities.EventDelivery.findMany({
    where: {
      subscription: {
        OR: [
          { workspaceId: user.workspaceId },
          { workspaceId: null, userId: user.id },
        ],
      },
      ...(args.status ? { status: args.status } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: args.limit,
    include: {
      eventOutbox: {
        select: {
          id: true,
          eventType: true,
          occurredAt: true,
        },
      },
    },
  });

  return {
    deliveries: deliveries.map((delivery: any) => ({
      id: delivery.id,
      event_id: delivery.eventOutboxId,
      event_type: delivery.eventOutbox.eventType,
      occurred_at: delivery.eventOutbox.occurredAt,
      subscription_id: delivery.subscriptionId,
      destination_type: delivery.destinationType,
      status: delivery.status,
      attempt_number: delivery.attemptNumber,
      http_status: delivery.httpStatus,
      duration_ms: delivery.durationMs,
      delivered_at: delivery.deliveredAt,
      created_at: delivery.createdAt,
    })),
  };
}

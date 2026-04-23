import type { Webhook } from 'wasp/entities';
import { HttpError } from 'wasp/server';

export interface WebhookListResponse {
  webhooks: Array<{
    id: string;
    url: string;
    created_at: Date;
    events: string[];
    enabled: boolean;
    lastTriggeredAt?: string | null;
    deliverySuccessRate?: number;
  }>;
}

/**
 * List all webhooks for the authenticated user
 */
export async function listWebhooks(_args: void, context: any): Promise<WebhookListResponse> {
  if (!context.user) {
    throw new HttpError(401, 'User not authenticated');
  }

  try {
    const webhooks = await context.entities.Webhook.findMany({
      where: { userId: context.user.id },
      select: {
        id: true,
        url: true,
        createdAt: true,
        events: true,
        enabled: true,
        deliveries: {
          orderBy: { createdAt: 'desc' },
          take: 100,
          select: {
            status: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      webhooks: webhooks.map((w: any) => ({
        id: w.id,
        url: w.url,
        created_at: w.createdAt,
        events: w.events,
        enabled: w.enabled,
        lastTriggeredAt: w.deliveries?.[0]?.createdAt?.toISOString?.() ?? null,
        deliverySuccessRate: (() => {
          const total = w.deliveries?.length ?? 0;
          if (total === 0) return 0;
          const successful = w.deliveries.filter((delivery: any) => delivery.status === 'delivered').length;
          return Math.round((successful / total) * 100);
        })(),
      })),
    };
  } catch (_err) {
    throw new HttpError(500, 'Failed to list webhooks');
  }
}

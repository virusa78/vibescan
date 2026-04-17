import type { Webhook } from 'wasp/entities';
import { HttpError } from 'wasp/server';

export interface WebhookListResponse {
  webhooks: Array<{
    id: string;
    url: string;
    created_at: Date;
    events: string[];
    enabled: boolean;
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
      })),
    };
  } catch (_err) {
    throw new HttpError(500, 'Failed to list webhooks');
  }
}

import { HttpError } from 'wasp/server';
import { calculateDeliverySuccessRate, } from './types.js';
import { buildWorkspaceOrLegacyOwnerWhere, requireWorkspaceScopedUser } from '../../services/workspaceAccess';
/**
 * List all webhooks for the authenticated user
 */
export async function listWebhooks(context) {
    const user = await requireWorkspaceScopedUser(context.user);
    try {
        const webhooks = await context.entities.Webhook.findMany({
            where: buildWorkspaceOrLegacyOwnerWhere(user),
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
            webhooks: webhooks.map((w) => ({
                id: w.id,
                url: w.url,
                created_at: w.createdAt,
                events: w.events,
                enabled: w.enabled,
                lastTriggeredAt: w.deliveries?.[0]?.createdAt?.toISOString?.() ?? null,
                deliverySuccessRate: calculateDeliverySuccessRate(w.deliveries),
            })),
        };
    }
    catch {
        throw new HttpError(500, 'Failed to list webhooks');
    }
}
//# sourceMappingURL=listWebhooks.js.map
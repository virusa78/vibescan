import { requireWorkspaceScopedUser } from '../../services/workspaceAccess';
export async function listEventSubscriptions(_args, context) {
    const user = await requireWorkspaceScopedUser(context.user);
    const subscriptions = await context.entities.EventSubscription.findMany({
        where: {
            OR: [
                { workspaceId: user.workspaceId },
                { workspaceId: null, userId: user.id },
            ],
        },
        orderBy: { createdAt: 'desc' },
    });
    return {
        subscriptions: subscriptions.map((subscription) => ({
            id: subscription.id,
            name: subscription.name,
            destination_type: subscription.destinationType,
            workspace_id: subscription.workspaceId,
            user_id: subscription.userId,
            event_types: subscription.eventTypes,
            categories: subscription.categories,
            enabled: subscription.enabled,
            last_delivery_at: subscription.lastDeliveryAt,
            created_at: subscription.createdAt,
            updated_at: subscription.updatedAt,
        })),
    };
}
//# sourceMappingURL=listSubscriptions.js.map
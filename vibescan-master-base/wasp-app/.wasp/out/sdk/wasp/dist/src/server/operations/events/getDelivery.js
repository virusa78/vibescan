import { HttpError } from 'wasp/server';
import * as z from 'zod';
import { ensureArgsSchemaOrThrowHttpError } from '../../validation.js';
import { requireWorkspaceScopedUser } from '../../services/workspaceAccess';
const getEventDeliveryInputSchema = z.object({
    deliveryId: z.string().uuid(),
});
export async function getEventDelivery(rawArgs, context) {
    const user = await requireWorkspaceScopedUser(context.user);
    const args = ensureArgsSchemaOrThrowHttpError(getEventDeliveryInputSchema, rawArgs);
    const delivery = await context.entities.EventDelivery.findUnique({
        where: { id: args.deliveryId },
        include: {
            eventOutbox: true,
            subscription: true,
        },
    });
    if (!delivery) {
        throw new HttpError(404, 'Event delivery not found');
    }
    const isOwned = delivery.subscription.workspaceId === user.workspaceId ||
        (!delivery.subscription.workspaceId && delivery.subscription.userId === user.id);
    if (!isOwned) {
        throw new HttpError(404, 'Event delivery not found');
    }
    return {
        id: delivery.id,
        event_id: delivery.eventOutboxId,
        subscription_id: delivery.subscriptionId,
        destination_type: delivery.destinationType,
        status: delivery.status,
        attempt_number: delivery.attemptNumber,
        http_status: delivery.httpStatus,
        response_body: delivery.responseBody,
        error_code: delivery.errorCode,
        error_message: delivery.errorMessage,
        duration_ms: delivery.durationMs,
        delivered_at: delivery.deliveredAt,
        next_retry_at: delivery.nextRetryAt,
        manual_retry_of_id: delivery.manualRetryOfId,
        event: {
            id: delivery.eventOutbox.id,
            type: delivery.eventOutbox.eventType,
            category: delivery.eventOutbox.category,
            occurred_at: delivery.eventOutbox.occurredAt,
        },
    };
}
//# sourceMappingURL=getDelivery.js.map
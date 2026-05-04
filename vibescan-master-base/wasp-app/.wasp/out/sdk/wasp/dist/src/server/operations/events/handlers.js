import { createEventSubscription, getEventDelivery, listEventDeliveries, listEventSubscriptions, retryEventDelivery, } from './index';
import { resolveRequestUser } from '../../services/requestAuth';
import { parseJsonBodyWithLimit } from '../../http/requestGuards';
import { sendOperationError } from '../../http/httpErrors';
export async function listEventSubscriptionsApiHandler(request, response, context) {
    try {
        const result = await listEventSubscriptions({}, { user: (await resolveRequestUser(request, context)) || undefined, entities: context.entities });
        response.status(200).json(result);
    }
    catch (error) {
        sendOperationError('event-operation', error, response);
    }
}
export async function createEventSubscriptionApiHandler(request, response, context) {
    try {
        const body = parseJsonBodyWithLimit(request.body);
        const result = await createEventSubscription(body, { user: (await resolveRequestUser(request, context)) || undefined, entities: context.entities });
        response.status(201).json(result);
    }
    catch (error) {
        sendOperationError('event-operation', error, response);
    }
}
export async function listEventDeliveriesApiHandler(request, response, context) {
    try {
        const limitParam = request.query.limit;
        const statusParam = request.query.status;
        const result = await listEventDeliveries({
            limit: limitParam ? parseInt(Array.isArray(limitParam) ? limitParam[0] : limitParam, 10) : undefined,
            status: Array.isArray(statusParam) ? statusParam[0] : statusParam,
        }, { user: (await resolveRequestUser(request, context)) || undefined, entities: context.entities });
        response.status(200).json(result);
    }
    catch (error) {
        sendOperationError('event-operation', error, response);
    }
}
export async function getEventDeliveryApiHandler(request, response, context) {
    try {
        const result = await getEventDelivery({ deliveryId: String(request.params.deliveryId) }, { user: (await resolveRequestUser(request, context)) || undefined, entities: context.entities });
        response.status(200).json(result);
    }
    catch (error) {
        sendOperationError('event-operation', error, response);
    }
}
export async function retryEventDeliveryApiHandler(request, response, context) {
    try {
        const result = await retryEventDelivery({ deliveryId: String(request.params.deliveryId) }, { user: (await resolveRequestUser(request, context)) || undefined, entities: context.entities });
        response.status(200).json(result);
    }
    catch (error) {
        sendOperationError('event-operation', error, response);
    }
}
//# sourceMappingURL=handlers.js.map
import { createWebhook, listWebhooks, getWebhook, updateWebhook, deleteWebhook, listWebhookDeliveries, testWebhookDelivery, retryWebhookDelivery, } from './index';
import { resolveRequestUser } from '../../services/requestAuth';
import { parseJsonBodyWithLimit, enforceRateLimit, getRateLimitKey } from '../../http/requestGuards';
import { sendOperationError } from '../../http/httpErrors';
export async function createWebhookApiHandler(request, response, context) {
    try {
        const body = parseJsonBodyWithLimit(request.body);
        const user = await resolveRequestUser(request, context);
        await enforceRateLimit({
            key: getRateLimitKey('webhook-create', user?.id || request.ip || 'anonymous'),
            limit: 20,
            windowSeconds: 60,
        });
        const result = await createWebhook(body, {
            user: user || undefined,
            entities: context.entities,
        });
        response.status(201).json(result);
    }
    catch (error) {
        sendOperationError('webhook-operation', error, response);
    }
}
export async function listWebhooksApiHandler(_request, response, context) {
    try {
        const result = await listWebhooks({
            user: (await resolveRequestUser(_request, context)) || undefined,
            entities: context.entities,
        });
        response.status(200).json(result);
    }
    catch (error) {
        sendOperationError('webhook-operation', error, response);
    }
}
export async function getWebhookApiHandler(request, response, context) {
    try {
        const result = await getWebhook({ webhookId: String(request.params.webhookId) }, {
            user: (await resolveRequestUser(request, context)) || undefined,
            entities: context.entities,
        });
        response.status(200).json(result);
    }
    catch (error) {
        sendOperationError('webhook-operation', error, response);
    }
}
export async function updateWebhookApiHandler(request, response, context) {
    try {
        const body = parseJsonBodyWithLimit(request.body);
        const user = await resolveRequestUser(request, context);
        await enforceRateLimit({
            key: getRateLimitKey('webhook-update', user?.id || request.ip || 'anonymous'),
            limit: 30,
            windowSeconds: 60,
        });
        const result = await updateWebhook({
            webhookId: String(request.params.webhookId),
            ...body,
        }, {
            user: user || undefined,
            entities: context.entities,
        });
        response.status(200).json(result);
    }
    catch (error) {
        sendOperationError('webhook-operation', error, response);
    }
}
export async function deleteWebhookApiHandler(request, response, context) {
    try {
        const user = await resolveRequestUser(request, context);
        await enforceRateLimit({
            key: getRateLimitKey('webhook-delete', user?.id || request.ip || 'anonymous'),
            limit: 20,
            windowSeconds: 60,
        });
        const result = await deleteWebhook({ webhookId: String(request.params.webhookId) }, {
            user: user || undefined,
            entities: context.entities,
        });
        response.status(200).json(result);
    }
    catch (error) {
        sendOperationError('webhook-operation', error, response);
    }
}
export async function listWebhookDeliveriesApiHandler(request, response, context) {
    try {
        const user = await resolveRequestUser(request, context);
        const limitRaw = Array.isArray(request.query.limit) ? request.query.limit[0] : request.query.limit;
        const cursorRaw = Array.isArray(request.query.cursor) ? request.query.cursor[0] : request.query.cursor;
        const limit = limitRaw ? Number.parseInt(String(limitRaw), 10) : 100;
        const result = await listWebhookDeliveries({
            webhookId: String(request.params.webhookId),
            limit: Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 100) : 100,
            ...(cursorRaw ? { cursor: String(cursorRaw) } : {}),
        }, { user: user || undefined, entities: context.entities });
        response.status(200).json(result);
    }
    catch (error) {
        sendOperationError('webhook-operation', error, response);
    }
}
export async function testWebhookDeliveryApiHandler(request, response, context) {
    try {
        const user = await resolveRequestUser(request, context);
        const result = await testWebhookDelivery({ webhookId: String(request.params.webhookId) }, { user: user || undefined });
        response.status(200).json(result);
    }
    catch (error) {
        sendOperationError('webhook-operation', error, response);
    }
}
export async function retryWebhookDeliveryApiHandler(request, response, context) {
    try {
        const user = await resolveRequestUser(request, context);
        const result = await retryWebhookDelivery({
            webhookId: String(request.params.webhookId),
            deliveryId: String(request.params.deliveryId),
        }, { user: user || undefined });
        response.status(200).json(result);
    }
    catch (error) {
        sendOperationError('webhook-operation', error, response);
    }
}
//# sourceMappingURL=handlers.js.map
import { getBillingAccount, getBillingEntitlements, listBillingEvents } from './index';
import { resolveRequestUser } from '../../services/requestAuth';
import { sendOperationError } from '../../http/httpErrors';
export async function getBillingAccountApiHandler(request, response, context) {
    try {
        const result = await getBillingAccount({}, { user: (await resolveRequestUser(request, context)) || undefined, entities: context.entities });
        response.status(200).json(result);
    }
    catch (error) {
        sendOperationError('billing-operation', error, response);
    }
}
export async function listBillingEventsApiHandler(request, response, context) {
    try {
        const limitParam = request.query.limit;
        const limit = limitParam ? parseInt(Array.isArray(limitParam) ? limitParam[0] : limitParam, 10) : undefined;
        const result = await listBillingEvents({ limit }, { user: (await resolveRequestUser(request, context)) || undefined, entities: context.entities });
        response.status(200).json(result);
    }
    catch (error) {
        sendOperationError('billing-operation', error, response);
    }
}
export async function getBillingEntitlementsApiHandler(request, response, context) {
    try {
        const result = await getBillingEntitlements({}, { user: (await resolveRequestUser(request, context)) || undefined, entities: context.entities });
        response.status(200).json(result);
    }
    catch (error) {
        sendOperationError('billing-operation', error, response);
    }
}
//# sourceMappingURL=handlers.js.map
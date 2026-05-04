import { generateAPIKey, listAPIKeys, getAPIKeyDetails, revokeAPIKey, } from './index';
import { resolveRequestUser } from '../../services/requestAuth';
import { parseJsonBodyWithLimit, enforceRateLimit, getRateLimitKey } from '../../http/requestGuards';
import { sendOperationError } from '../../http/httpErrors';
export async function generateAPIKeyApiHandler(request, response, context) {
    try {
        const body = parseJsonBodyWithLimit(request.body);
        const user = await resolveRequestUser(request, context);
        await enforceRateLimit({
            key: getRateLimitKey('apikey-generate', user?.id || request.ip || 'anonymous'),
            limit: 10,
            windowSeconds: 60,
        });
        const result = await generateAPIKey(body, {
            user: user || undefined,
        });
        response.status(201).json(result);
    }
    catch (error) {
        sendOperationError('apikey-operation', error, response);
    }
}
export async function listAPIKeysApiHandler(request, response, context) {
    try {
        const result = await listAPIKeys({}, {
            user: (await resolveRequestUser(request, context)) || undefined,
        });
        response.status(200).json(result);
    }
    catch (error) {
        sendOperationError('apikey-operation', error, response);
    }
}
export async function getAPIKeyDetailsApiHandler(request, response, context) {
    try {
        const keyId = request.params.keyId;
        const result = await getAPIKeyDetails({ keyId }, {
            user: (await resolveRequestUser(request, context)) || undefined,
        });
        response.status(200).json(result);
    }
    catch (error) {
        sendOperationError('apikey-operation', error, response);
    }
}
export async function revokeAPIKeyApiHandler(request, response, context) {
    try {
        const keyId = request.params.keyId;
        const result = await revokeAPIKey({ keyId }, {
            user: (await resolveRequestUser(request, context)) || undefined,
        });
        response.status(200).json(result);
    }
    catch (error) {
        sendOperationError('apikey-operation', error, response);
    }
}
//# sourceMappingURL=handlers.js.map
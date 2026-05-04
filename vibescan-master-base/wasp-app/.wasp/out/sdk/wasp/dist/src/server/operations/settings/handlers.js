import { getProfileSettings, updateProfileSettings, getNotificationSettings, updateNotificationSettings, getScannerAccessSettings, updateScannerAccessSettings, } from './index';
import { resolveRequestUser } from '../../services/requestAuth';
import { parseJsonBodyWithLimit, enforceRateLimit, getRateLimitKey } from '../../http/requestGuards';
import { sendOperationError } from '../../http/httpErrors';
export async function getProfileSettingsApiHandler(request, response, context) {
    try {
        const result = await getProfileSettings({}, {
            user: (await resolveRequestUser(request, context)) || undefined,
        });
        response.status(200).json(result);
    }
    catch (error) {
        sendOperationError('settings-operation', error, response);
    }
}
export async function updateProfileSettingsApiHandler(request, response, context) {
    try {
        const body = parseJsonBodyWithLimit(request.body);
        const user = await resolveRequestUser(request, context);
        await enforceRateLimit({
            key: getRateLimitKey('settings-profile', user?.id || request.ip || 'anonymous'),
            limit: 20,
            windowSeconds: 60,
        });
        const result = await updateProfileSettings(body, {
            user: user || undefined,
        });
        response.status(200).json(result);
    }
    catch (error) {
        sendOperationError('settings-operation', error, response);
    }
}
export async function getNotificationSettingsApiHandler(request, response, context) {
    try {
        const projectKeyParam = request.query.project_key;
        const projectKey = Array.isArray(projectKeyParam) ? projectKeyParam[0] : projectKeyParam;
        const result = await getNotificationSettings({
            project_key: projectKey,
        }, {
            user: (await resolveRequestUser(request, context)) || undefined,
        });
        response.status(200).json(result);
    }
    catch (error) {
        sendOperationError('settings-operation', error, response);
    }
}
export async function updateNotificationSettingsApiHandler(request, response, context) {
    try {
        const body = parseJsonBodyWithLimit(request.body);
        const user = await resolveRequestUser(request, context);
        await enforceRateLimit({
            key: getRateLimitKey('settings-notifications', user?.id || request.ip || 'anonymous'),
            limit: 20,
            windowSeconds: 60,
        });
        const result = await updateNotificationSettings(body, {
            user: user || undefined,
        });
        response.status(200).json(result);
    }
    catch (error) {
        sendOperationError('settings-operation', error, response);
    }
}
export async function getScannerAccessSettingsApiHandler(request, response, context) {
    try {
        const user = await resolveRequestUser(request, context);
        const result = await getScannerAccessSettings({}, {
            user: user || undefined,
        });
        response.status(200).json(result);
    }
    catch (error) {
        sendOperationError('settings-operation', error, response);
    }
}
export async function updateScannerAccessSettingsApiHandler(request, response, context) {
    try {
        const body = parseJsonBodyWithLimit(request.body);
        const user = await resolveRequestUser(request, context);
        await enforceRateLimit({
            key: getRateLimitKey('settings-scanner-access', user?.id || request.ip || 'anonymous'),
            limit: 20,
            windowSeconds: 60,
        });
        const result = await updateScannerAccessSettings(body, {
            user: user || undefined,
        });
        response.status(200).json(result);
    }
    catch (error) {
        sendOperationError('settings-operation', error, response);
    }
}
//# sourceMappingURL=handlers.js.map
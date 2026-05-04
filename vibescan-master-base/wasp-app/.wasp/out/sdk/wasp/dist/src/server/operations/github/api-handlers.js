import { listGithubInstallations } from './listGithubInstallations';
import { linkGithubInstallation } from './linkGithubInstallation';
import { updateGithubInstallationSettings, } from './updateGithubInstallationSettings';
import { resolveRequestUser } from '../../services/requestAuth';
import { parseJsonBodyWithLimit, enforceRateLimit, getRateLimitKey } from '../../http/requestGuards';
import { sendOperationError } from '../../http/httpErrors';
export async function listGithubInstallationsApiHandler(request, response, context) {
    try {
        const result = await listGithubInstallations({}, {
            user: await resolveRequestUser(request, context),
        });
        response.status(200).json(result);
    }
    catch (error) {
        sendOperationError('github-operation', error, response);
    }
}
export async function linkGithubInstallationApiHandler(request, response, context) {
    try {
        const user = await resolveRequestUser(request, context);
        await enforceRateLimit({
            key: getRateLimitKey('github-installation-link', user?.id || request.ip || 'anonymous'),
            limit: 20,
            windowSeconds: 60,
        });
        const body = parseJsonBodyWithLimit(request.body);
        const result = await linkGithubInstallation(body, {
            user,
        });
        response.status(200).json(result);
    }
    catch (error) {
        sendOperationError('github-operation', error, response);
    }
}
export async function updateGithubInstallationSettingsApiHandler(request, response, context) {
    try {
        const user = await resolveRequestUser(request, context);
        await enforceRateLimit({
            key: getRateLimitKey('github-installation-settings', user?.id || request.ip || 'anonymous'),
            limit: 20,
            windowSeconds: 60,
        });
        const body = parseJsonBodyWithLimit(request.body);
        const installationId = request.params.installationId;
        const result = await updateGithubInstallationSettings({
            ...body,
            installationId,
        }, {
            user,
        });
        response.status(200).json(result);
    }
    catch (error) {
        sendOperationError('github-operation', error, response);
    }
}
//# sourceMappingURL=api-handlers.js.map
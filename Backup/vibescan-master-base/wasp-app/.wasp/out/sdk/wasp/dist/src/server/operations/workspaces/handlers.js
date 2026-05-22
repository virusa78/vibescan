import { getWorkspaceContext } from './getWorkspaceContext';
import { listWorkspaces } from './listWorkspaces';
import { switchWorkspace } from './switchWorkspace';
import { resolveRequestUser } from '../../services/requestAuth';
import { parseJsonBodyWithLimit, enforceRateLimit, getRateLimitKey } from '../../http/requestGuards';
import { sendOperationError } from '../../http/httpErrors';
export async function getWorkspaceContextApiHandler(request, response, context) {
    try {
        const result = await getWorkspaceContext({}, {
            user: await resolveRequestUser(request, context),
        });
        response.status(200).json(result);
    }
    catch (error) {
        sendOperationError('workspace-operation', error, response);
    }
}
export async function listWorkspacesApiHandler(request, response, context) {
    try {
        const result = await listWorkspaces({}, {
            user: await resolveRequestUser(request, context),
        });
        response.status(200).json(result);
    }
    catch (error) {
        sendOperationError('workspace-operation', error, response);
    }
}
export async function switchWorkspaceApiHandler(request, response, context) {
    try {
        const user = await resolveRequestUser(request, context);
        await enforceRateLimit({
            key: getRateLimitKey('workspace-switch', user?.id || request.ip || 'anonymous'),
            limit: 30,
            windowSeconds: 60,
        });
        const body = parseJsonBodyWithLimit(request.body);
        const result = await switchWorkspace(body, {
            user,
        });
        response.status(200).json(result);
    }
    catch (error) {
        sendOperationError('workspace-operation', error, response);
    }
}
//# sourceMappingURL=handlers.js.map
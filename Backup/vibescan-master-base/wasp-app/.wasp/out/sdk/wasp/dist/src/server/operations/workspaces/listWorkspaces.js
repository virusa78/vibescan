import { prisma } from 'wasp/server';
import { requireWorkspaceScopedUser } from '../../services/workspaceAccess';
import { getWorkspaceContextForUser } from '../../services/workspaceFoundation';
import { mapWorkspaceSummaryResponse } from './shared';
export async function listWorkspaces(_rawArgs, context) {
    const user = await requireWorkspaceScopedUser(context.user);
    const workspaceContext = await getWorkspaceContextForUser(prisma, user.id);
    return {
        workspaces: workspaceContext.workspaces.map(mapWorkspaceSummaryResponse),
    };
}
//# sourceMappingURL=listWorkspaces.js.map
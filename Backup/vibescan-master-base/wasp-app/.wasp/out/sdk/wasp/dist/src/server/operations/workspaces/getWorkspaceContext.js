import { prisma } from 'wasp/server';
import { requireWorkspaceScopedUser } from '../../services/workspaceAccess';
import { getWorkspaceContextForUser } from '../../services/workspaceFoundation';
import { mapWorkspaceContextResponse } from './shared';
export async function getWorkspaceContext(_rawArgs, context) {
    const user = await requireWorkspaceScopedUser(context.user);
    const workspaceContext = await getWorkspaceContextForUser(prisma, user.id);
    return mapWorkspaceContextResponse(workspaceContext);
}
//# sourceMappingURL=getWorkspaceContext.js.map
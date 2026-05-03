import { prisma } from 'wasp/server';
import { requireWorkspaceScopedUser } from '../../services/workspaceAccess';
import { getWorkspaceContextForUser, type WorkspaceFoundationDatabase } from '../../services/workspaceFoundation';
import { mapWorkspaceContextResponse, type WorkspaceContextResponse } from './shared';


export async function getWorkspaceContext(
  _rawArgs: unknown,
  context: any,
): Promise<any> {
  const user = await requireWorkspaceScopedUser(context.user);
  const workspaceContext = await getWorkspaceContextForUser(
    prisma as unknown as WorkspaceFoundationDatabase,
    user.id,
  );

  return mapWorkspaceContextResponse(workspaceContext);
}

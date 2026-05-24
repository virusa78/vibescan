import { HttpError, prisma } from 'wasp/server';
import { requireWorkspaceScopedUser } from '../../services/workspaceAccess';
import { getWorkspaceContextForUser, type WorkspaceFoundationDatabase } from '../../services/workspaceFoundation';

export async function requireZohoWorkspaceAdmin(contextUser: any): Promise<{ userId: string; workspaceId: string }> {
  const user = await requireWorkspaceScopedUser(contextUser);
  const workspaceContext = await getWorkspaceContextForUser(
    prisma as unknown as WorkspaceFoundationDatabase,
    user.id,
  );

  if (workspaceContext.activeWorkspace.role !== 'admin') {
    throw new HttpError(403, 'Only workspace admins can manage Zoho integration');
  }

  return {
    userId: user.id,
    workspaceId: workspaceContext.activeWorkspace.id,
  };
}

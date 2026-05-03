import { prisma } from 'wasp/server';
import { requireWorkspaceScopedUser } from '../../services/workspaceAccess';
import { getWorkspaceContextForUser, type WorkspaceFoundationDatabase } from '../../services/workspaceFoundation';
import { mapWorkspaceSummaryResponse, type WorkspaceSummaryResponse } from './shared';


export type ListWorkspacesResponse = {
  workspaces: WorkspaceSummaryResponse[];
};

export async function listWorkspaces(
  _rawArgs: unknown,
  context: any,
): Promise<any> {
  const user = await requireWorkspaceScopedUser(context.user);
  const workspaceContext = await getWorkspaceContextForUser(
    prisma as unknown as WorkspaceFoundationDatabase,
    user.id,
  );

  return {
    workspaces: workspaceContext.workspaces.map(mapWorkspaceSummaryResponse),
  };
}

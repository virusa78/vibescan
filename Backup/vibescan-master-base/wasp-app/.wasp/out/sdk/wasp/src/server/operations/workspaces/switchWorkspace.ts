import * as z from 'zod';
import { HttpError, prisma } from 'wasp/server';
import { ensureArgsSchemaOrThrowHttpError } from '../../validation';
import { requireWorkspaceScopedUser } from '../../services/workspaceAccess';
import { getWorkspaceContextForUser, type WorkspaceFoundationDatabase } from '../../services/workspaceFoundation';
import { mapWorkspaceContextResponse, type WorkspaceContextResponse } from './shared';

const switchWorkspaceInputSchema = z.object({
  workspace_id: z.string().uuid(),
});

export type SwitchWorkspaceInput = z.infer<typeof switchWorkspaceInputSchema>;


export async function switchWorkspace(
  rawArgs: unknown,
  context: any,
): Promise<any> {
  const user = await requireWorkspaceScopedUser(context.user);
  const args = ensureArgsSchemaOrThrowHttpError(switchWorkspaceInputSchema, rawArgs);

  const membership = await prisma.workspaceMembership.findFirst({
    where: {
      userId: user.id,
      workspaceId: args.workspace_id,
    },
    select: {
      workspaceId: true,
    },
  });

  if (!membership) {
    throw new HttpError(404, 'Workspace not found');
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      activeWorkspaceId: membership.workspaceId,
    },
  });

  const workspaceContext = await getWorkspaceContextForUser(
    prisma as unknown as WorkspaceFoundationDatabase,
    user.id,
  );

  return mapWorkspaceContextResponse(workspaceContext);
}

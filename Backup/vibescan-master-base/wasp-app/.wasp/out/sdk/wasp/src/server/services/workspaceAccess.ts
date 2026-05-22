import { HttpError, prisma } from 'wasp/server';
import {
  getWorkspaceContextForUser,
  type WorkspaceFoundationDatabase,
} from './workspaceFoundation';

export type WorkspaceScopedUser = {
  id: string;
  workspaceId: string;
};

type UserLike = {
  id: string;
  workspaceId?: string | null;
};

type OwnershipLike = {
  workspaceId?: string | null;
  userId?: string | null;
};

export async function resolveWorkspaceScopedUser(user: UserLike): Promise<WorkspaceScopedUser> {
  if (user.workspaceId) {
    return {
      id: user.id,
      workspaceId: user.workspaceId,
    };
  }

  const workspaceContext = await getWorkspaceContextForUser(
    prisma as unknown as WorkspaceFoundationDatabase,
    user.id,
  );

  return {
    id: user.id,
    workspaceId: workspaceContext.activeWorkspace.id,
  };
}

export async function requireWorkspaceScopedUser(
  user: UserLike | null | undefined,
): Promise<WorkspaceScopedUser> {
  if (!user) {
    throw new HttpError(401, 'User not authenticated');
  }

  return resolveWorkspaceScopedUser(user);
}

export function buildWorkspaceOrLegacyOwnerWhere(
  user: WorkspaceScopedUser,
  ownerField = 'userId',
): Record<string, unknown> {
  return {
    OR: [
      { workspaceId: user.workspaceId },
      { workspaceId: null, [ownerField]: user.id },
    ],
  };
}

export function buildNestedScanWorkspaceWhere(user: WorkspaceScopedUser): Record<string, unknown> {
  return {
    OR: [
      { workspaceId: user.workspaceId },
      { workspaceId: null, userId: user.id },
    ],
  };
}

export function hasWorkspaceOrLegacyOwnership(
  record: OwnershipLike | null | undefined,
  user: WorkspaceScopedUser,
): boolean {
  if (!record) {
    return false;
  }

  if (record.workspaceId) {
    return record.workspaceId === user.workspaceId;
  }

  return record.userId === user.id;
}

export function assertWorkspaceOrLegacyOwnership(
  record: OwnershipLike | null | undefined,
  user: WorkspaceScopedUser,
  notFoundMessage: string,
): void {
  if (!hasWorkspaceOrLegacyOwnership(record, user)) {
    throw new HttpError(404, notFoundMessage);
  }
}

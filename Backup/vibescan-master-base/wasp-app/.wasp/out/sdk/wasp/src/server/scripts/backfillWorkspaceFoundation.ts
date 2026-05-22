import type { PrismaClient } from '@prisma/client';
import {
  ensureWorkspaceFoundationForUser,
  type WorkspaceFoundationDatabase,
} from '../services/workspaceFoundation';

type UserIdRow = {
  id: string;
};

export async function backfillWorkspaceFoundation(prismaClient: PrismaClient): Promise<{
  processedUsers: number;
}> {
  const workspaceDb = prismaClient as unknown as WorkspaceFoundationDatabase;
  const users = (await prismaClient.user.findMany({
    select: { id: true },
  })) as UserIdRow[];

  for (const user of users) {
    await ensureWorkspaceFoundationForUser(workspaceDb, user.id);
  }

  return {
    processedUsers: users.length,
  };
}

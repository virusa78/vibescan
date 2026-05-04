import { HttpError, prisma } from 'wasp/server';
import { mapProfileResponse, type ProfileResponse, type ProfileUserRecord } from './profileResponse';
import {
  getWorkspaceContextForUser,
  type WorkspaceFoundationDatabase,
} from '../../services/workspaceFoundation';


export async function getProfileSettings(
  _args: unknown,
  context: any
): Promise<any> {
  if (!context.user) {
    throw new HttpError(401, 'User not authenticated');
  }

  const workspaceDb = prisma as unknown as WorkspaceFoundationDatabase;
  const workspaceContext = await getWorkspaceContextForUser(workspaceDb, context.user.id);

  const user = await prisma.user.findUnique({
    where: { id: context.user.id },
    select: {
      id: true,
      displayName: true,
      email: true,
      region: true,
      plan: true,
      subscriptionStatus: true,
      monthlyQuotaUsed: true,
      monthlyQuotaLimit: true,
    },
  }) as ProfileUserRecord | null;

  if (!user) {
    throw new HttpError(404, 'User not found');
  }

  return mapProfileResponse(user, workspaceContext);
}

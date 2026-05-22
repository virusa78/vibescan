import { HttpError, prisma } from 'wasp/server';
import * as z from 'zod';
import { ensureArgsSchemaOrThrowHttpError } from '../../validation';
import { mapProfileResponse, type ProfileResponse, type ProfileUserRecord } from './profileResponse';
import {
  getWorkspaceContextForUser,
  type WorkspaceFoundationDatabase,
} from '../../services/workspaceFoundation';

const updateProfileSettingsSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  region: z.enum(['IN', 'PK', 'OTHER']).optional(),
  notifications_enabled: z.boolean().optional(),
});

export type UpdateProfileSettingsInput = z.infer<typeof updateProfileSettingsSchema>;


type ProfileUpdateData = {
  displayName?: string;
  region?: 'IN' | 'PK' | 'OTHER';
};

export async function updateProfileSettings(
  rawArgs: unknown,
  context: any
): Promise<any> {
  if (!context.user) {
    throw new HttpError(401, 'User not authenticated');
  }

  const args = ensureArgsSchemaOrThrowHttpError(
    updateProfileSettingsSchema,
    rawArgs
  );

  const updateData: ProfileUpdateData = {};
  if (args.name !== undefined) {
    updateData.displayName = args.name;
  }
  if (args.region !== undefined) {
    updateData.region = args.region;
  }

  const user = await prisma.user.update({
    where: { id: context.user.id },
    data: updateData,
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
  }) as ProfileUserRecord;

  const workspaceDb = prisma as unknown as WorkspaceFoundationDatabase;
  const workspaceContext = await getWorkspaceContextForUser(workspaceDb, context.user.id);

  return mapProfileResponse(user, workspaceContext);
}

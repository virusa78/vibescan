import { HttpError, prisma } from 'wasp/server';
import * as z from 'zod';
import { ensureArgsSchemaOrThrowHttpError } from '../../validation';
import type { ProfileResponse } from './getProfileSettings';

const updateProfileSettingsSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  region: z.enum(['IN', 'PK', 'OTHER']).optional(),
  notifications_enabled: z.boolean().optional(),
});

export type UpdateProfileSettingsInput = z.infer<typeof updateProfileSettingsSchema>;

export async function updateProfileSettings(
  rawArgs: any,
  context: any
): Promise<ProfileResponse> {
  if (!context.user) {
    throw new HttpError(401, 'User not authenticated');
  }

  const args = ensureArgsSchemaOrThrowHttpError(
    updateProfileSettingsSchema,
    rawArgs
  );

  const updateData: any = {};
  if (args.name !== undefined) {
    updateData.displayName = args.name;
  }
  if (args.region !== undefined) {
    updateData.region = args.region;
  }

  const user = await prisma.user.update({
    where: { id: context.user.id },
    data: updateData,
    include: {
      organizations: {
        select: {
          id: true,
          ownerUserId: true,
        },
        take: 1,
      },
    },
  });

  const org = user.organizations[0] || null;

  return {
    id: user.id,
    name: user.displayName || null,
    email: user.email,
    region: user.region,
    plan_tier: user.plan,
    org_id: org?.id || null,
    org_role: org?.ownerUserId === user.id ? 'owner' : org ? 'member' : null,
  };
}

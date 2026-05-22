import type { User } from "wasp/entities";
import { HttpError, prisma } from "wasp/server";
import * as z from "zod";
import { ensureArgsSchemaOrThrowHttpError } from "../server/validation";

type AuthContext = {
  user?: User | null;
};

const updateUserSettingsInputSchema = z.object({
  displayName: z.string().trim().max(120).optional(),
  timezone: z.string().trim().max(50).optional(),
  language: z.string().trim().max(10).optional(),
  region: z.enum(["IN", "PK", "OTHER"]).optional(),
});

type PublicUserSettings = {
  id: string;
  displayName: string | null;
  timezone: string | null;
  language: string | null;
  region: string;
};

// Get current user profile/settings
export const getUserSettings = async (
  _args: unknown,
  context: AuthContext
): Promise<PublicUserSettings | null> => {
  if (!context.user) {
    throw new HttpError(401, "User not authenticated");
  }

  return prisma.user.findUnique({
    where: { id: context.user.id },
    select: {
      id: true,
      displayName: true,
      timezone: true,
      language: true,
      region: true,
    },
  });
};

// Update user profile/settings
export const updateUserSettings = async (
  rawArgs: unknown,
  context: AuthContext
): Promise<void> => {
  if (!context.user) {
    throw new HttpError(401, "User not authenticated");
  }

  const args = ensureArgsSchemaOrThrowHttpError(
    updateUserSettingsInputSchema,
    rawArgs,
  );

  await prisma.user.update({
    where: { id: context.user.id },
    data: {
      displayName: args.displayName,
      timezone: args.timezone,
      language: args.language,
      region: args.region,
    },
  });
};

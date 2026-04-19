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

// Get current user profile/settings
export const getUserSettings = async (
  _args: unknown,
  context: AuthContext
): Promise<User | null> => {
  if (!context.user) {
    throw new HttpError(401, "User not authenticated");
  }

  return prisma.user.findUnique({
    where: { id: context.user.id },
  });
};

// Update user profile/settings
export const updateUserSettings = async (
  rawArgs: unknown,
  context: AuthContext
): Promise<User> => {
  if (!context.user) {
    throw new HttpError(401, "User not authenticated");
  }

  const args = ensureArgsSchemaOrThrowHttpError(
    updateUserSettingsInputSchema,
    rawArgs,
  );

  return prisma.user.update({
    where: { id: context.user.id },
    data: {
      displayName: args.displayName,
      timezone: args.timezone,
      language: args.language,
      region: args.region,
    },
  });
};

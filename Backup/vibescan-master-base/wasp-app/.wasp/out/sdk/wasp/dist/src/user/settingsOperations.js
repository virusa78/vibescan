import { HttpError, prisma } from "wasp/server";
import * as z from "zod";
import { ensureArgsSchemaOrThrowHttpError } from "../server/validation";
const updateUserSettingsInputSchema = z.object({
    displayName: z.string().trim().max(120).optional(),
    timezone: z.string().trim().max(50).optional(),
    language: z.string().trim().max(10).optional(),
    region: z.enum(["IN", "PK", "OTHER"]).optional(),
});
// Get current user profile/settings
export const getUserSettings = async (_args, context) => {
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
export const updateUserSettings = async (rawArgs, context) => {
    if (!context.user) {
        throw new HttpError(401, "User not authenticated");
    }
    const args = ensureArgsSchemaOrThrowHttpError(updateUserSettingsInputSchema, rawArgs);
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
//# sourceMappingURL=settingsOperations.js.map
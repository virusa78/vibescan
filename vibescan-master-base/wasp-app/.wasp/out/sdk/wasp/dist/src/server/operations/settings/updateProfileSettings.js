import { HttpError, prisma } from 'wasp/server';
import * as z from 'zod';
import { ensureArgsSchemaOrThrowHttpError } from '../../validation';
import { mapProfileResponse } from './profileResponse';
import { getWorkspaceContextForUser, } from '../../services/workspaceFoundation';
const updateProfileSettingsSchema = z.object({
    name: z.string().min(1).max(255).optional(),
    region: z.enum(['IN', 'PK', 'OTHER']).optional(),
    notifications_enabled: z.boolean().optional(),
});
export async function updateProfileSettings(rawArgs, context) {
    if (!context.user) {
        throw new HttpError(401, 'User not authenticated');
    }
    const args = ensureArgsSchemaOrThrowHttpError(updateProfileSettingsSchema, rawArgs);
    const updateData = {};
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
    });
    const workspaceDb = prisma;
    const workspaceContext = await getWorkspaceContextForUser(workspaceDb, context.user.id);
    return mapProfileResponse(user, workspaceContext);
}
//# sourceMappingURL=updateProfileSettings.js.map
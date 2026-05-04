import { HttpError, prisma } from 'wasp/server';
import { mapProfileResponse } from './profileResponse';
import { getWorkspaceContextForUser, } from '../../services/workspaceFoundation';
export async function getProfileSettings(_args, context) {
    if (!context.user) {
        throw new HttpError(401, 'User not authenticated');
    }
    const workspaceDb = prisma;
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
    });
    if (!user) {
        throw new HttpError(404, 'User not found');
    }
    return mapProfileResponse(user, workspaceContext);
}
//# sourceMappingURL=getProfileSettings.js.map
import { ensureWorkspaceFoundationForUser, } from '../services/workspaceFoundation';
export async function backfillWorkspaceFoundation(prismaClient) {
    const workspaceDb = prismaClient;
    const users = (await prismaClient.user.findMany({
        select: { id: true },
    }));
    for (const user of users) {
        await ensureWorkspaceFoundationForUser(workspaceDb, user.id);
    }
    return {
        processedUsers: users.length,
    };
}
//# sourceMappingURL=backfillWorkspaceFoundation.js.map
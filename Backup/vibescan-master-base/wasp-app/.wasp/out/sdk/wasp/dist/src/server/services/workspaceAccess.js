import { HttpError, prisma } from 'wasp/server';
import { getWorkspaceContextForUser, } from './workspaceFoundation';
export async function resolveWorkspaceScopedUser(user) {
    if (user.workspaceId) {
        return {
            id: user.id,
            workspaceId: user.workspaceId,
        };
    }
    const workspaceContext = await getWorkspaceContextForUser(prisma, user.id);
    return {
        id: user.id,
        workspaceId: workspaceContext.activeWorkspace.id,
    };
}
export async function requireWorkspaceScopedUser(user) {
    if (!user) {
        throw new HttpError(401, 'User not authenticated');
    }
    return resolveWorkspaceScopedUser(user);
}
export function buildWorkspaceOrLegacyOwnerWhere(user, ownerField = 'userId') {
    return {
        OR: [
            { workspaceId: user.workspaceId },
            { workspaceId: null, [ownerField]: user.id },
        ],
    };
}
export function buildNestedScanWorkspaceWhere(user) {
    return {
        OR: [
            { workspaceId: user.workspaceId },
            { workspaceId: null, userId: user.id },
        ],
    };
}
export function hasWorkspaceOrLegacyOwnership(record, user) {
    if (!record) {
        return false;
    }
    if (record.workspaceId) {
        return record.workspaceId === user.workspaceId;
    }
    return record.userId === user.id;
}
export function assertWorkspaceOrLegacyOwnership(record, user, notFoundMessage) {
    if (!hasWorkspaceOrLegacyOwnership(record, user)) {
        throw new HttpError(404, notFoundMessage);
    }
}
//# sourceMappingURL=workspaceAccess.js.map
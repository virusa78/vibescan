export type WorkspaceScopedUser = {
    id: string;
    workspaceId: string;
};
type UserLike = {
    id: string;
    workspaceId?: string | null;
};
type OwnershipLike = {
    workspaceId?: string | null;
    userId?: string | null;
};
export declare function resolveWorkspaceScopedUser(user: UserLike): Promise<WorkspaceScopedUser>;
export declare function requireWorkspaceScopedUser(user: UserLike | null | undefined): Promise<WorkspaceScopedUser>;
export declare function buildWorkspaceOrLegacyOwnerWhere(user: WorkspaceScopedUser, ownerField?: string): Record<string, unknown>;
export declare function buildNestedScanWorkspaceWhere(user: WorkspaceScopedUser): Record<string, unknown>;
export declare function hasWorkspaceOrLegacyOwnership(record: OwnershipLike | null | undefined, user: WorkspaceScopedUser): boolean;
export declare function assertWorkspaceOrLegacyOwnership(record: OwnershipLike | null | undefined, user: WorkspaceScopedUser, notFoundMessage: string): void;
export {};
//# sourceMappingURL=workspaceAccess.d.ts.map
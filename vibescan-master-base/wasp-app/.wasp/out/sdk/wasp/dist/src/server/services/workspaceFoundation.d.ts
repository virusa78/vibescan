type WorkspaceFoundationUserRecord = {
    id: string;
    email: string;
    username: string | null;
    displayName: string | null;
    activeWorkspaceId: string | null;
};
type OrganizationRecord = {
    id: string;
    name: string;
    slug: string;
    isPersonal: boolean;
};
type TeamRecord = {
    id: string;
    name: string;
    slug: string;
    isDefault: boolean;
};
type WorkspaceRecord = {
    id: string;
    name: string;
    slug: string;
    isPersonal: boolean;
};
type WorkspaceMembershipRow = {
    role: WorkspaceRoleValue;
    workspace: {
        id: string;
        name: string;
        slug: string;
        isPersonal: boolean;
        organization: {
            id: string;
            name: string;
            slug: string;
            isPersonal: boolean;
        };
        team: {
            id: string;
            name: string;
            slug: string;
            isDefault: boolean;
        } | null;
    };
};
type WorkspaceRoleValue = 'admin' | 'member' | 'viewer';
export type WorkspaceSummary = {
    id: string;
    name: string;
    slug: string;
    isPersonal: boolean;
    role: WorkspaceRoleValue;
    organization: {
        id: string;
        name: string;
        slug: string;
        isPersonal: boolean;
    };
    team: {
        id: string;
        name: string;
        slug: string;
        isDefault: boolean;
    } | null;
};
export type WorkspaceContext = {
    activeWorkspace: WorkspaceSummary;
    workspaces: WorkspaceSummary[];
    personalOrganizationId: string;
    personalWorkspaceId: string;
};
export type WorkspaceFoundationDatabase = {
    $transaction<T>(fn: (tx: WorkspaceFoundationDatabase) => Promise<T>): Promise<T>;
    user: {
        findUnique(args: unknown): Promise<WorkspaceFoundationUserRecord | null>;
        update(args: unknown): Promise<unknown>;
    };
    organization: {
        findFirst(args: unknown): Promise<OrganizationRecord | null>;
        create(args: unknown): Promise<OrganizationRecord>;
    };
    organizationMembership: {
        upsert(args: unknown): Promise<unknown>;
    };
    team: {
        findFirst(args: unknown): Promise<TeamRecord | null>;
        create(args: unknown): Promise<TeamRecord>;
    };
    teamMembership: {
        upsert(args: unknown): Promise<unknown>;
    };
    workspace: {
        findFirst(args: unknown): Promise<WorkspaceRecord | null>;
        create(args: unknown): Promise<WorkspaceRecord>;
    };
    workspaceMembership: {
        upsert(args: unknown): Promise<unknown>;
        findMany(args: unknown): Promise<WorkspaceMembershipRow[]>;
    };
};
type EnsuredWorkspaceFoundation = {
    activeWorkspaceId: string;
    organizationId: string;
    teamId: string;
    workspaceId: string;
};
export declare function ensureWorkspaceFoundationForUser(db: WorkspaceFoundationDatabase, userId: string): Promise<EnsuredWorkspaceFoundation>;
export declare function getWorkspaceContextForUser(db: WorkspaceFoundationDatabase, userId: string): Promise<WorkspaceContext>;
export {};
//# sourceMappingURL=workspaceFoundation.d.ts.map
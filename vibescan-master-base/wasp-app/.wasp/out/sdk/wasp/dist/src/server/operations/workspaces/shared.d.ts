import type { WorkspaceSummary } from '../../services/workspaceFoundation';
export type WorkspaceSummaryResponse = {
    id: string;
    name: string;
    slug: string;
    is_personal: boolean;
    role: 'admin' | 'member' | 'viewer';
    organization: {
        id: string;
        name: string;
        slug: string;
        is_personal: boolean;
    };
    team: {
        id: string;
        name: string;
        slug: string;
        is_default: boolean;
    } | null;
};
export type WorkspaceContextResponse = {
    active_workspace: WorkspaceSummaryResponse;
    workspaces: WorkspaceSummaryResponse[];
    personal_organization_id: string;
    personal_workspace_id: string;
};
export declare function mapWorkspaceSummaryResponse(workspace: WorkspaceSummary): WorkspaceSummaryResponse;
export declare function mapWorkspaceContextResponse(context: any): WorkspaceContextResponse;
//# sourceMappingURL=shared.d.ts.map
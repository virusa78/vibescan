import type { WorkspaceContext } from '../../services/workspaceFoundation';
export type ProfileResponse = {
    id: string;
    name: string | null;
    email: string;
    region: string;
    plan_tier: string;
    subscription_status: string | null;
    monthly_quota_used: number;
    monthly_quota_limit: number;
    org_id: string | null;
    org_role: string | null;
    org_name: string | null;
    org_slug: string | null;
    active_workspace_id: string | null;
    active_workspace_name: string | null;
    active_workspace_slug: string | null;
    active_workspace_role: string | null;
    workspace_count: number;
};
export type ProfileUserRecord = {
    id: string;
    displayName: string | null;
    email: string;
    region: string;
    plan: string;
    subscriptionStatus: string | null;
    monthlyQuotaUsed: number;
    monthlyQuotaLimit: number;
};
export declare function mapProfileResponse(user: ProfileUserRecord, workspaceContext: WorkspaceContext): ProfileResponse;
//# sourceMappingURL=profileResponse.d.ts.map
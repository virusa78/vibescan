export type AccountProfile = {
    email: string;
    plan_tier: string;
    subscription_status: string | null;
    monthly_quota_used: number;
    monthly_quota_limit: number;
    org_name?: string | null;
    org_slug?: string | null;
    active_workspace_name?: string | null;
    active_workspace_slug?: string | null;
    active_workspace_role?: string | null;
    workspace_count?: number | null;
};
export type AccountUser = {
    email?: string | null;
    plan?: string | null;
    subscriptionStatus?: string | null;
    monthlyQuotaUsed?: number | null;
    monthlyQuotaLimit?: number | null;
};
export declare function getAccountDisplayValues(user: AccountUser, profile?: AccountProfile | null): {
    email: string;
    planTier: string;
    subscriptionStatus: string;
    monthlyQuotaUsed: number;
    monthlyQuotaLimit: number;
    organizationName: string | null;
    organizationSlug: string | null;
    activeWorkspaceName: string | null;
    activeWorkspaceSlug: string | null;
    activeWorkspaceRole: string | null;
    workspaceCount: number;
};
//# sourceMappingURL=accountDisplay.d.ts.map
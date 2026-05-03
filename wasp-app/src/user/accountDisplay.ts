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

export function getAccountDisplayValues(
  user: AccountUser,
  profile?: AccountProfile | null,
) {
  return {
    email: profile?.email ?? user.email ?? "",
    planTier: profile?.plan_tier ?? user.plan ?? "free_trial",
    subscriptionStatus:
      profile?.subscription_status ?? user.subscriptionStatus ?? "inactive",
    monthlyQuotaUsed:
      profile?.monthly_quota_used ?? user.monthlyQuotaUsed ?? 0,
    monthlyQuotaLimit:
      profile?.monthly_quota_limit ?? user.monthlyQuotaLimit ?? 0,
    organizationName: profile?.org_name ?? null,
    organizationSlug: profile?.org_slug ?? null,
    activeWorkspaceName: profile?.active_workspace_name ?? null,
    activeWorkspaceSlug: profile?.active_workspace_slug ?? null,
    activeWorkspaceRole: profile?.active_workspace_role ?? null,
    workspaceCount: profile?.workspace_count ?? 0,
  };
}

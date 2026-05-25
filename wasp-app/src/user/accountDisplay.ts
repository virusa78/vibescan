export type AccountProfile = {
  email?: string | null;
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
  workspaceCount?: number | null;
};

export type AccountDisplay = {
  email: string;
  planTier: string;
  subscriptionStatus: string | null;
  monthlyQuotaUsed: number;
  monthlyQuotaLimit: number;
  organizationName: string | null;
  organizationSlug: string | null;
  activeWorkspaceName: string | null;
  activeWorkspaceSlug: string | null;
  activeWorkspaceRole: string | null;
  workspaceCount: number;
};

export function getAccountDisplayValues(
  user: AccountUser,
  profile?: AccountProfile | null,
): AccountDisplay {
  const base = {
    email: profile?.email ?? user.email ?? "",
    planTier: profile?.plan_tier ?? user.plan ?? "free_trial",
    subscriptionStatus:
      profile?.subscription_status ?? user.subscriptionStatus ?? "inactive",
    monthlyQuotaUsed:
      profile?.monthly_quota_used ?? user.monthlyQuotaUsed ?? 0,
    monthlyQuotaLimit:
      profile?.monthly_quota_limit ?? user.monthlyQuotaLimit ?? 0,
  } as any;

  // Conditionally add optional fields only when present / meaningful
  const orgName = profile?.org_name ?? null;
  const orgSlug = profile?.org_slug ?? null;
  const activeName = profile?.active_workspace_name ?? null;
  const activeSlug = profile?.active_workspace_slug ?? null;
  const activeRole = profile?.active_workspace_role ?? null;
  const wsCount = profile?.workspace_count ?? user.workspaceCount ?? 0;

  if (orgName != null) base.organizationName = orgName;
  if (orgSlug != null) base.organizationSlug = orgSlug;
  if (activeName != null) base.activeWorkspaceName = activeName;
  if (activeSlug != null) base.activeWorkspaceSlug = activeSlug;
  if (activeRole != null) base.activeWorkspaceRole = activeRole;
  if (wsCount && wsCount > 0) base.workspaceCount = wsCount;

  return base as AccountDisplay;
}


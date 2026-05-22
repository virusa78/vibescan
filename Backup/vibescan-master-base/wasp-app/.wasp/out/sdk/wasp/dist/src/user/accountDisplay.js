export function getAccountDisplayValues(user, profile) {
    return {
        email: profile?.email ?? user.email ?? "",
        planTier: profile?.plan_tier ?? user.plan ?? "free_trial",
        subscriptionStatus: profile?.subscription_status ?? user.subscriptionStatus ?? "inactive",
        monthlyQuotaUsed: profile?.monthly_quota_used ?? user.monthlyQuotaUsed ?? 0,
        monthlyQuotaLimit: profile?.monthly_quota_limit ?? user.monthlyQuotaLimit ?? 0,
        organizationName: profile?.org_name ?? null,
        organizationSlug: profile?.org_slug ?? null,
        activeWorkspaceName: profile?.active_workspace_name ?? null,
        activeWorkspaceSlug: profile?.active_workspace_slug ?? null,
        activeWorkspaceRole: profile?.active_workspace_role ?? null,
        workspaceCount: profile?.workspace_count ?? 0,
    };
}
//# sourceMappingURL=accountDisplay.js.map
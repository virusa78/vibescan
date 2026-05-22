export function mapProfileResponse(user, workspaceContext) {
    const activeWorkspace = workspaceContext.activeWorkspace;
    return {
        id: user.id,
        name: user.displayName || null,
        email: user.email,
        region: user.region,
        plan_tier: user.plan,
        subscription_status: user.subscriptionStatus,
        monthly_quota_used: user.monthlyQuotaUsed,
        monthly_quota_limit: user.monthlyQuotaLimit,
        org_id: activeWorkspace.organization.id,
        org_role: activeWorkspace.organization.isPersonal
            ? 'owner'
            : activeWorkspace.role === 'admin'
                ? 'admin'
                : 'member',
        org_name: activeWorkspace.organization.name,
        org_slug: activeWorkspace.organization.slug,
        active_workspace_id: activeWorkspace.id,
        active_workspace_name: activeWorkspace.name,
        active_workspace_slug: activeWorkspace.slug,
        active_workspace_role: activeWorkspace.role,
        workspace_count: workspaceContext.workspaces.length,
    };
}
//# sourceMappingURL=profileResponse.js.map
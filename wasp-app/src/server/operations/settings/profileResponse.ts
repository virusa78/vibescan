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

export function mapProfileResponse(
  user: ProfileUserRecord,
  workspaceContext: WorkspaceContext,
): ProfileResponse {
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

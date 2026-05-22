import type { WorkspaceContext, WorkspaceSummary } from '../../services/workspaceFoundation';

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

export function mapWorkspaceSummaryResponse(workspace: WorkspaceSummary): WorkspaceSummaryResponse {
  return {
    id: workspace.id,
    name: workspace.name,
    slug: workspace.slug,
    is_personal: workspace.isPersonal,
    role: workspace.role,
    organization: {
      id: workspace.organization.id,
      name: workspace.organization.name,
      slug: workspace.organization.slug,
      is_personal: workspace.organization.isPersonal,
    },
    team: workspace.team
      ? {
          id: workspace.team.id,
          name: workspace.team.name,
          slug: workspace.team.slug,
          is_default: workspace.team.isDefault,
        }
      : null,
  };
}

export function mapWorkspaceContextResponse(context: any): WorkspaceContextResponse {
  return {
    active_workspace: mapWorkspaceSummaryResponse(context.activeWorkspace),
    workspaces: context.workspaces.map(mapWorkspaceSummaryResponse),
    personal_organization_id: context.personalOrganizationId,
    personal_workspace_id: context.personalWorkspaceId,
  };
}

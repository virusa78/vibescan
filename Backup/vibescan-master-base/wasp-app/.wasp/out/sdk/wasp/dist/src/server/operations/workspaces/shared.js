export function mapWorkspaceSummaryResponse(workspace) {
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
export function mapWorkspaceContextResponse(context) {
    return {
        active_workspace: mapWorkspaceSummaryResponse(context.activeWorkspace),
        workspaces: context.workspaces.map(mapWorkspaceSummaryResponse),
        personal_organization_id: context.personalOrganizationId,
        personal_workspace_id: context.personalWorkspaceId,
    };
}
//# sourceMappingURL=shared.js.map
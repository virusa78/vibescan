import { requireWorkspaceScopedUser } from '../../services/workspaceAccess';
import { listGithubInstallationsForWorkspace } from '../../services/githubInstallationService';
export async function listGithubInstallations(_rawArgs, context) {
    const user = await requireWorkspaceScopedUser(context.user);
    const installations = await listGithubInstallationsForWorkspace(user.workspaceId);
    return {
        installations: installations.map((installation) => ({
            id: installation.id,
            github_installation_id: installation.githubInstallationId,
            workspace_id: installation.workspaceId,
            org_id: installation.orgId,
            account_login: installation.accountLogin,
            repository_selection: installation.repositorySelection,
            repos_scope: installation.reposScope,
            trigger_on_push: installation.triggerOnPush,
            trigger_on_pr: installation.triggerOnPr,
            target_branches: installation.targetBranches,
            fail_pr_on_severity: installation.failPrOnSeverity,
            available_repos: installation.availableRepos,
        })),
    };
}
//# sourceMappingURL=listGithubInstallations.js.map
import { requireWorkspaceScopedUser } from '../../services/workspaceAccess';
import { listGithubInstallationsForWorkspace } from '../../services/githubInstallationService';

export type GithubInstallationSummary = {
  id: string;
  github_installation_id: string;
  workspace_id: string | null;
  org_id: string | null;
  account_login: string | null;
  repository_selection: string;
  repos_scope: string[];
  trigger_on_push: boolean;
  trigger_on_pr: boolean;
  target_branches: string[];
  fail_pr_on_severity: string;
  available_repos: string[];
};


export async function listGithubInstallations(
  _rawArgs: unknown,
  context: any,
): Promise<{ installations: GithubInstallationSummary[] }> {
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

import { HttpError } from 'wasp/server';
import * as z from 'zod';
import { ensureArgsSchemaOrThrowHttpError } from '../../validation';
import { requireWorkspaceScopedUser } from '../../services/workspaceAccess';
import { getWorkspaceContextForUser, type WorkspaceFoundationDatabase } from '../../services/workspaceFoundation';
import { linkGithubInstallationToWorkspace } from '../../services/githubInstallationService';
import { prisma } from 'wasp/server';

const linkGithubInstallationInputSchema = z.object({
  installationId: z.string().trim().min(1),
});

export type LinkGithubInstallationInput = z.infer<typeof linkGithubInstallationInputSchema>;

export type LinkGithubInstallationResponse = {
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


export async function linkGithubInstallation(
  rawArgs: unknown,
  context: any,
): Promise<any> {
  const user = await requireWorkspaceScopedUser(context.user);
  const args = ensureArgsSchemaOrThrowHttpError(linkGithubInstallationInputSchema, rawArgs);
  const workspaceContext = await getWorkspaceContextForUser(
    prisma as unknown as WorkspaceFoundationDatabase,
    user.id,
  );

  if (!workspaceContext.activeWorkspace.organization.id) {
    throw new HttpError(422, 'Active workspace organization is required');
  }

  const linked = await linkGithubInstallationToWorkspace(
    args.installationId,
    workspaceContext.activeWorkspace.id,
    workspaceContext.activeWorkspace.organization.id,
  );

  return {
    id: linked.id,
    github_installation_id: linked.githubInstallationId,
    workspace_id: linked.workspaceId,
    org_id: linked.orgId,
    account_login: linked.accountLogin,
    repository_selection: linked.repositorySelection,
    repos_scope: linked.reposScope,
    trigger_on_push: linked.triggerOnPush,
    trigger_on_pr: linked.triggerOnPr,
    target_branches: linked.targetBranches,
    fail_pr_on_severity: linked.failPrOnSeverity,
    available_repos: linked.availableRepos,
  };
}

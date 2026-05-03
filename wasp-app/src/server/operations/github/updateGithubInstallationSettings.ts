import { HttpError } from 'wasp/server';
import * as z from 'zod';
import { ensureArgsSchemaOrThrowHttpError } from '../../validation';
import { requireWorkspaceScopedUser } from '../../services/workspaceAccess';
import { updateGithubInstallationSettings as updateInstallationSettings } from '../../services/githubInstallationService';

const updateGithubInstallationSettingsInputSchema = z.object({
  installationId: z.string().trim().min(1),
  repos_scope: z.array(z.string().trim().min(1)).max(500),
  trigger_on_push: z.boolean(),
  trigger_on_pr: z.boolean(),
  target_branches: z.array(z.string().trim().min(1)).max(50),
  fail_pr_on_severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
});

export type UpdateGithubInstallationSettingsInput = z.infer<typeof updateGithubInstallationSettingsInputSchema>;

export type UpdateGithubInstallationSettingsResponse = {
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


export async function updateGithubInstallationSettings(
  rawArgs: unknown,
  context: any,
): Promise<any> {
  const user = await requireWorkspaceScopedUser(context.user);
  const args = ensureArgsSchemaOrThrowHttpError(updateGithubInstallationSettingsInputSchema, rawArgs);

  const normalizedRepos = Array.from(
    new Set(args.repos_scope.map((value) => value.trim()).filter(Boolean)),
  ).sort();
  const normalizedBranches = Array.from(
    new Set(args.target_branches.map((value) => value.trim()).filter(Boolean)),
  );

  if (normalizedBranches.length === 0) {
    throw new HttpError(422, 'At least one target branch is required');
  }

  const updated = await updateInstallationSettings(args.installationId, user.workspaceId, {
    reposScope: normalizedRepos,
    triggerOnPush: args.trigger_on_push,
    triggerOnPr: args.trigger_on_pr,
    targetBranches: normalizedBranches,
    failPrOnSeverity: args.fail_pr_on_severity,
  });

  return {
    id: updated.id,
    github_installation_id: updated.githubInstallationId,
    workspace_id: updated.workspaceId,
    org_id: updated.orgId,
    account_login: updated.accountLogin,
    repository_selection: updated.repositorySelection,
    repos_scope: updated.reposScope,
    trigger_on_push: updated.triggerOnPush,
    trigger_on_pr: updated.triggerOnPr,
    target_branches: updated.targetBranches,
    fail_pr_on_severity: updated.failPrOnSeverity,
    available_repos: updated.availableRepos,
  };
}

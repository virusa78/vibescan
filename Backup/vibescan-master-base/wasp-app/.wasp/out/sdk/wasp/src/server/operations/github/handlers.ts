import type { Response } from 'express';
import { prisma } from 'wasp/server';
import type { HandlerContext, HandlerRequest } from '../../http/handlerTypes';
import { sendOperationError } from '../../http/httpErrors';
import type { PersistedGitHubScanContext } from '../../services/githubAppService';
import { verifyGitHubWebhookSignature } from '../../services/githubAppService';
import {
  getMappedGithubInstallationByInstallationId,
  removeGithubInstallation,
  syncGithubInstallation,
} from '../../services/githubInstallationService';
import { syncGitHubCheckRunForScan } from '../../services/githubCheckRunService';
import { submitGitHubScan } from '../../services/githubScanService';
import {
  isForkPullRequest,
  isRepositoryAllowedByInstallation,
  isTargetBranchAllowedByInstallation,
} from '../../services/githubWebhookFiltering';

type InstallationRecord = Awaited<ReturnType<typeof getMappedGithubInstallationByInstallationId>>;

function getHeaderValue(request: HandlerRequest, headerName: string): string | undefined {
  const rawValue = request.headers[headerName] ?? request.headers[headerName.toLowerCase()];
  return Array.isArray(rawValue) ? rawValue[0] : rawValue;
}

function getRawBodyBuffer(body: unknown): Buffer {
  if (Buffer.isBuffer(body)) {
    return body;
  }

  if (typeof body === 'string') {
    return Buffer.from(body, 'utf8');
  }

  return Buffer.from(JSON.stringify(body ?? {}), 'utf8');
}

function parseWebhookPayload(body: unknown): Record<string, unknown> {
  if (typeof body === 'string') {
    return JSON.parse(body) as Record<string, unknown>;
  }

  if (Buffer.isBuffer(body)) {
    return JSON.parse(body.toString('utf8')) as Record<string, unknown>;
  }

  if (body && typeof body === 'object' && !Array.isArray(body)) {
    return body as Record<string, unknown>;
  }

  return {};
}

async function resolveWorkspaceActorUserId(workspaceId: string): Promise<string | null> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { createdByUserId: true },
  });

  return workspace?.createdByUserId ?? null;
}

async function hasExistingDeliveryScan(workspaceId: string, deliveryId: string): Promise<any> {
  const existing = await prisma.scan.findFirst({
    where: {
      workspaceId,
      githubContext: {
        path: ['deliveryId'],
        equals: deliveryId,
      },
    },
    select: { id: true },
  });

  return Boolean(existing);
}

async function enqueueGithubWebhookScan(input: {
  installation: NonNullable<InstallationRecord>;
  deliveryId: string;
  repositoryFullName: string;
  repositoryHtmlUrl: string;
  repositoryId: number | undefined;
  repositoryPrivate: boolean | undefined;
  defaultBranch: string | null | undefined;
  eventType: 'push' | 'pull_request';
  ref?: string | null;
  branch?: string | null;
  commitSha?: string | null;
  pullRequestNumber?: number | null;
}): Promise<{ queued: boolean; reason?: string; scanId?: string }> {
  if (!input.installation.workspaceId) {
    return { queued: false, reason: 'installation_not_mapped' };
  }

  if (await hasExistingDeliveryScan(input.installation.workspaceId, input.deliveryId)) {
    return { queued: false, reason: 'duplicate_delivery' };
  }

  const actorUserId = await resolveWorkspaceActorUserId(input.installation.workspaceId);
  if (!actorUserId) {
    return { queued: false, reason: 'workspace_actor_not_found' };
  }

  const githubContext: PersistedGitHubScanContext = {
    source: 'github_app_webhook',
    installationId: input.installation.githubInstallationId.toString(),
    deliveryId: input.deliveryId,
    repositoryId: input.repositoryId,
    repositoryFullName: input.repositoryFullName,
    repositoryPrivate: input.repositoryPrivate,
    defaultBranch: input.defaultBranch ?? null,
    eventType: input.eventType,
    ref: input.ref ?? null,
    branch: input.branch ?? null,
    commitSha: input.commitSha ?? null,
    pullRequestNumber: input.pullRequestNumber ?? null,
  };

  const result = await submitGitHubScan(
    actorUserId,
    input.installation.workspaceId,
    input.repositoryHtmlUrl,
    githubContext,
  );

  await syncGitHubCheckRunForScan({
    prisma,
    scanId: result.scan.id,
    status: 'queued',
  });

  return {
    queued: true,
    scanId: result.scan.id,
  };
}

async function handlePushWebhook(
  payload: Record<string, unknown>,
  installation: NonNullable<InstallationRecord>,
  deliveryId: string,
): Promise<{ action: string; reason?: string; scanId?: string }> {
  if (!installation.triggerOnPush) {
    return { action: 'ignored', reason: 'push_trigger_disabled' };
  }

  const repository = (payload.repository && typeof payload.repository === 'object')
    ? payload.repository as Record<string, unknown>
    : null;
  const repositoryFullName = typeof repository?.full_name === 'string' ? repository.full_name : null;
  const repositoryHtmlUrl = typeof repository?.html_url === 'string' ? repository.html_url : null;
  const branch = typeof payload.ref === 'string' && payload.ref.startsWith('refs/heads/')
    ? payload.ref.slice('refs/heads/'.length)
    : null;

  if (!repositoryFullName || !repositoryHtmlUrl) {
    return { action: 'ignored', reason: 'missing_repository' };
  }

  if (!isRepositoryAllowedByInstallation(installation, repositoryFullName)) {
    return { action: 'ignored', reason: 'repository_not_in_scope' };
  }

  if (!isTargetBranchAllowedByInstallation(installation, branch)) {
    return { action: 'ignored', reason: 'branch_not_in_scope' };
  }

  if (payload.deleted === true) {
    return { action: 'ignored', reason: 'branch_deleted' };
  }

  const queued = await enqueueGithubWebhookScan({
    installation,
    deliveryId,
    repositoryFullName,
    repositoryHtmlUrl,
    repositoryId: typeof (repository as any)?.id === 'number' ? (repository as any).id : undefined,
    repositoryPrivate: typeof (repository as any)?.private === 'boolean' ? (repository as any).private : undefined,
    defaultBranch: typeof (repository as any)?.default_branch === 'string' ? (repository as any).default_branch : null,
    eventType: 'push',
    ref: typeof payload.ref === 'string' ? payload.ref : null,
    branch,
    commitSha: typeof payload.after === 'string' ? payload.after : null,
  });

  return queued.queued
    ? { action: 'queued', scanId: queued.scanId }
    : { action: 'ignored', reason: queued.reason };
}

async function handlePullRequestWebhook(
  payload: Record<string, unknown>,
  installation: NonNullable<InstallationRecord>,
  deliveryId: string,
): Promise<{ action: string; reason?: string; scanId?: string }> {
  if (!installation.triggerOnPr) {
    return { action: 'ignored', reason: 'pr_trigger_disabled' };
  }

  const action = typeof payload.action === 'string' ? payload.action : 'unknown';
  if (!['opened', 'reopened', 'synchronize', 'ready_for_review'].includes(action)) {
    return { action: 'ignored', reason: `pr_action_${action}` };
  }

  const repository = (payload.repository && typeof payload.repository === 'object')
    ? payload.repository as Record<string, unknown>
    : null;
  const pullRequest = (payload.pull_request && typeof payload.pull_request === 'object')
    ? payload.pull_request as Record<string, unknown>
    : null;
  const head = (pullRequest?.head && typeof pullRequest.head === 'object')
    ? pullRequest.head as Record<string, unknown>
    : null;
  const base = (pullRequest?.base && typeof pullRequest.base === 'object')
    ? pullRequest.base as Record<string, unknown>
    : null;
  const headRepository = (head?.repo && typeof head.repo === 'object')
    ? head.repo as Record<string, unknown>
    : null;
  const repositoryFullName = typeof repository?.full_name === 'string' ? repository.full_name : null;
  const repositoryHtmlUrl = typeof repository?.html_url === 'string' ? repository.html_url : null;
  const targetBranch = typeof base?.ref === 'string' ? base.ref : null;

  if (!repositoryFullName || !repositoryHtmlUrl) {
    return { action: 'ignored', reason: 'missing_repository' };
  }

  if (!isRepositoryAllowedByInstallation(installation, repositoryFullName)) {
    return { action: 'ignored', reason: 'repository_not_in_scope' };
  }

  if (!isTargetBranchAllowedByInstallation(installation, targetBranch)) {
    return { action: 'ignored', reason: 'branch_not_in_scope' };
  }

  if (isForkPullRequest(
    typeof headRepository?.full_name === 'string' ? headRepository.full_name : null,
    repositoryFullName,
  )) {
    return { action: 'ignored', reason: 'fork_pr_not_supported_yet' };
  }

  const queued = await enqueueGithubWebhookScan({
    installation,
    deliveryId,
    repositoryFullName,
    repositoryHtmlUrl,
    repositoryId: typeof (repository as any)?.id === 'number' ? (repository as any).id : undefined,
    repositoryPrivate: typeof (repository as any)?.private === 'boolean' ? (repository as any).private : undefined,
    defaultBranch: typeof (repository as any)?.default_branch === 'string' ? (repository as any).default_branch : null,
    eventType: 'pull_request',
    ref: typeof head?.ref === 'string' ? head.ref : null,
    branch: typeof head?.ref === 'string' ? head.ref : null,
    commitSha: typeof head?.sha === 'string' ? head.sha : null,
    pullRequestNumber: typeof payload.number === 'number' ? payload.number : null,
  });

  return queued.queued
    ? { action: 'queued', scanId: queued.scanId }
    : { action: 'ignored', reason: queued.reason };
}

export async function githubWebhookApiHandler(
  request: HandlerRequest,
  response: Response,
  _context: any,
) {
  try {
    const rawBody = getRawBodyBuffer(request.body);
    const signature = getHeaderValue(request, 'x-hub-signature-256');
    const eventName = getHeaderValue(request, 'x-github-event');
    const deliveryId = getHeaderValue(request, 'x-github-delivery') || 'unknown';

    if (!verifyGitHubWebhookSignature(rawBody, signature)) {
      response.status(401).json({
        error: 'unauthorized',
        message: 'Invalid GitHub webhook signature',
      });
      return;
    }

    const payload = parseWebhookPayload(request.body);
    const installationNode = payload.installation && typeof payload.installation === 'object'
      ? payload.installation as Record<string, unknown>
      : null;
    const installationId = installationNode?.id;

    if (!eventName) {
      response.status(400).json({
        error: 'validation_error',
        message: 'Missing GitHub event header',
      });
      return;
    }

    if ((eventName === 'installation' || eventName === 'installation_repositories' || eventName === 'push' || eventName === 'pull_request')
      && (typeof installationId !== 'number' && typeof installationId !== 'string')) {
      response.status(400).json({
        error: 'validation_error',
        message: 'Missing installation id',
      });
      return;
    }

    if (eventName === 'installation') {
      const action = typeof payload.action === 'string' ? payload.action : 'unknown';
      if (action === 'deleted') {
        await removeGithubInstallation(installationId as string | number);
        response.status(202).json({ status: 'ok', action: 'deleted', delivery_id: deliveryId });
        return;
      }

      await syncGithubInstallation(installationId as string | number);
      response.status(202).json({ status: 'ok', action: 'synced', delivery_id: deliveryId });
      return;
    }

    if (eventName === 'installation_repositories') {
      await syncGithubInstallation(installationId as string | number);
      response.status(202).json({ status: 'ok', action: 'repositories_synced', delivery_id: deliveryId });
      return;
    }

    if (eventName === 'push' || eventName === 'pull_request') {
      const installation = await getMappedGithubInstallationByInstallationId(
        installationId as string | number,
      );

      if (!installation) {
        await syncGithubInstallation(installationId as string | number);
      }

      const resolvedInstallation = await getMappedGithubInstallationByInstallationId(
        installationId as string | number,
      );

      if (!resolvedInstallation) {
        response.status(202).json({ status: 'ignored', reason: 'installation_not_found', delivery_id: deliveryId });
        return;
      }

      const result = eventName === 'push'
        ? await handlePushWebhook(payload, resolvedInstallation, deliveryId)
        : await handlePullRequestWebhook(payload, resolvedInstallation, deliveryId);

      response.status(202).json({
        status: result.action,
        reason: result.reason,
        scan_id: result.scanId,
        delivery_id: deliveryId,
      });
      return;
    }

    response.status(202).json({
      status: 'ignored',
      reason: `unsupported_event:${eventName}`,
      delivery_id: deliveryId,
    });
  } catch (error) {
    sendOperationError('github-webhook', error, response);
  }
}

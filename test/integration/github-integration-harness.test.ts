import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  buildInstallationWebhookPayload,
  buildPullRequestWebhookPayload,
  buildPushWebhookPayload,
  createGitHubIntegrationHarness,
  getGitHubIntegrationScenarioMenu,
} from '../support/githubIntegrationHarness';

const harness = createGitHubIntegrationHarness();

jest.mock('wasp/server', () => ({
  prisma: harness.prisma,
}));

jest.mock('../../wasp-app/src/server/config/runtime', () => ({
  getFrontendBaseUrl: () => 'https://app.vibescan.example',
}));

jest.mock('../../wasp-app/src/server/services/githubAppService', () => ({
  verifyGitHubWebhookSignature: harness.verifyGitHubWebhookSignature,
  createGitHubCheckRun: harness.createGitHubCheckRun,
  updateGitHubCheckRun: harness.updateGitHubCheckRun,
}));

jest.mock('../../wasp-app/src/server/services/githubInstallationService', () => ({
  getMappedGithubInstallationByInstallationId: harness.getMappedGithubInstallationByInstallationId,
  syncGithubInstallation: harness.syncGithubInstallation,
  removeGithubInstallation: harness.removeGithubInstallation,
}));

jest.mock('../../wasp-app/src/server/services/githubScanService', () => ({
  submitGitHubScan: harness.submitGitHubScan,
}));

import { githubWebhookApiHandler } from '../../wasp-app/src/server/operations/github/handlers';
import { syncGitHubCheckRunForScan } from '../../wasp-app/src/server/services/githubCheckRunService';

describe('github integration harness', () => {
  beforeEach(() => {
    harness.reset();
    harness.verifyGitHubWebhookSignature.mockClear();
    harness.getMappedGithubInstallationByInstallationId.mockClear();
    harness.syncGithubInstallation.mockClear();
    harness.removeGithubInstallation.mockClear();
    harness.submitGitHubScan.mockClear();
    harness.createGitHubCheckRun.mockClear();
    harness.updateGitHubCheckRun.mockClear();
    harness.prisma.workspace.findUnique.mockClear();
    harness.prisma.scan.findFirst.mockClear();
    harness.prisma.scan.findUnique.mockClear();
    harness.prisma.scan.update.mockClear();
    harness.verifyGitHubWebhookSignature.mockReturnValue(true);
    harness.seedWorkspace('workspace-1', 'user-1');
    harness.seedInstallation({
      githubInstallationId: BigInt(123),
      workspaceId: 'workspace-1',
      repositorySelection: 'selected',
      reposScope: ['acme/api'],
      triggerOnPush: true,
      triggerOnPr: true,
      targetBranches: ['main'],
    });
  });

  it('exposes a compact scenario menu without duplicates', () => {
    const menu = getGitHubIntegrationScenarioMenu();

    expect(menu).toEqual([
      expect.objectContaining({ id: 'push-flow' }),
      expect.objectContaining({ id: 'fork-pr-ignore' }),
      expect.objectContaining({ id: 'install-sync' }),
      expect.objectContaining({ id: 'duplicate-delivery' }),
      expect.objectContaining({ id: 'branch-scope' }),
      expect.objectContaining({ id: 'deleted-install' }),
    ]);

    expect(new Set(menu.map((scenario) => scenario.id)).size).toBe(menu.length);
    expect(menu).toHaveLength(6);
  });

  it('emulates push webhook -> scan enqueue -> check-run lifecycle', async () => {
    const payload = buildPushWebhookPayload({
      installationId: 123,
      repositoryFullName: 'acme/api',
      repositoryHtmlUrl: 'https://github.com/acme/api',
      defaultBranch: 'main',
      branch: 'main',
      after: 'abc123',
    });

    const response = harness.createResponseStub();
    await githubWebhookApiHandler(
      harness.createRequest({ event: 'push', deliveryId: 'delivery-push-1', payload }) as never,
      response as never,
      {} as never,
    );

    expect(response.statusCode).toBe(202);
    expect(response.body).toMatchObject({
      status: 'queued',
      delivery_id: 'delivery-push-1',
      scan_id: 'scan-1',
    });
    expect(harness.transcript).toContain('scan:created:scan-1');

    await syncGitHubCheckRunForScan({
      prisma: harness.prisma as never,
      scanId: 'scan-1',
      status: 'queued',
    });
    await syncGitHubCheckRunForScan({
      prisma: harness.prisma as never,
      scanId: 'scan-1',
      status: 'in_progress',
    });
    await syncGitHubCheckRunForScan({
      prisma: harness.prisma as never,
      scanId: 'scan-1',
      status: 'completed',
      findingsCount: 3,
    });

    expect(harness.transcript).toEqual([
      'scan:created:scan-1',
      'check-run:create:100:queued',
      'check-run:update:100:queued',
      'check-run:update:100:in_progress',
      'check-run:update:100:completed',
    ]);

    expect(harness.getCheckRun(100)).toMatchObject({
      id: 100,
      status: 'completed',
      conclusion: 'success',
      detailsUrl: 'https://app.vibescan.example/scans/scan-1',
    });
  });

  it('emulates a fork pull request being ignored before scan submission', async () => {
    const payload = buildPullRequestWebhookPayload({
      installationId: 123,
      repositoryFullName: 'acme/api',
      repositoryHtmlUrl: 'https://github.com/acme/api',
      headRepositoryFullName: 'someone/forked-repo',
      baseRef: 'main',
    });

    const response = harness.createResponseStub();
    await githubWebhookApiHandler(
      harness.createRequest({ event: 'pull_request', deliveryId: 'delivery-fork', payload }) as never,
      response as never,
      {} as never,
    );

    expect(response.statusCode).toBe(202);
    expect(response.body).toMatchObject({
      status: 'ignored',
      reason: 'fork_pr_not_supported_yet',
      delivery_id: 'delivery-fork',
    });
    expect(harness.transcript).toEqual([]);
  });

  it('emulates installation sync and deletion payloads', async () => {
    const createdResponse = harness.createResponseStub();
    await githubWebhookApiHandler(
      harness.createRequest({
        event: 'installation',
        deliveryId: 'delivery-install',
        payload: buildInstallationWebhookPayload({ installationId: 123, action: 'created' }),
      }) as never,
      createdResponse as never,
      {} as never,
    );

    expect(createdResponse.statusCode).toBe(202);
    expect(createdResponse.body).toMatchObject({
      status: 'ok',
      action: 'synced',
      delivery_id: 'delivery-install',
    });
    expect(harness.syncGithubInstallation).toHaveBeenCalledWith(123);

    const deletedResponse = harness.createResponseStub();
    await githubWebhookApiHandler(
      harness.createRequest({
        event: 'installation',
        deliveryId: 'delivery-delete',
        payload: buildInstallationWebhookPayload({ installationId: 123, action: 'deleted' }),
      }) as never,
      deletedResponse as never,
      {} as never,
    );

    expect(deletedResponse.statusCode).toBe(202);
    expect(deletedResponse.body).toMatchObject({
      status: 'ok',
      action: 'deleted',
      delivery_id: 'delivery-delete',
    });
    expect(harness.removeGithubInstallation).toHaveBeenCalledWith(123);
  });

  it('emulates duplicate webhook deliveries being ignored', async () => {
    harness.seedScan({
      id: 'existing-scan',
      workspaceId: 'workspace-1',
      userId: 'user-1',
      inputRef: 'https://github.com/acme/api',
      status: 'pending',
      githubContext: {
        deliveryId: 'delivery-dup',
      },
    });

    const payload = buildPushWebhookPayload({
      installationId: 123,
      repositoryFullName: 'acme/api',
      repositoryHtmlUrl: 'https://github.com/acme/api',
      defaultBranch: 'main',
      branch: 'main',
      after: 'abc123',
    });

    const response = harness.createResponseStub();
    await githubWebhookApiHandler(
      harness.createRequest({ event: 'push', deliveryId: 'delivery-dup', payload }) as never,
      response as never,
      {} as never,
    );

    expect(response.statusCode).toBe(202);
    expect(response.body).toMatchObject({
      status: 'ignored',
      reason: 'duplicate_delivery',
      delivery_id: 'delivery-dup',
    });
    expect(harness.submitGitHubScan).not.toHaveBeenCalled();
    expect(harness.transcript).toEqual([]);
  });

  it('emulates installation_repositories sync delivery', async () => {
    const payload = buildInstallationWebhookPayload({
      installationId: 123,
      action: 'new_permissions_accepted',
    });

    const response = harness.createResponseStub();
    await githubWebhookApiHandler(
      harness.createRequest({
        event: 'installation_repositories',
        deliveryId: 'delivery-install-repos',
        payload,
      }) as never,
      response as never,
      {} as never,
    );

    expect(response.statusCode).toBe(202);
    expect(response.body).toMatchObject({
      status: 'ok',
      action: 'repositories_synced',
      delivery_id: 'delivery-install-repos',
    });
    expect(harness.syncGithubInstallation).toHaveBeenCalledWith(123);
    expect(harness.transcript).toEqual(['installation:sync:123']);
  });

  it('emulates pull requests outside target branch scope being ignored', async () => {
    const payload = buildPullRequestWebhookPayload({
      installationId: 123,
      repositoryFullName: 'acme/api',
      repositoryHtmlUrl: 'https://github.com/acme/api',
      baseRef: 'release',
      headRepositoryFullName: 'acme/api',
    });

    const response = harness.createResponseStub();
    await githubWebhookApiHandler(
      harness.createRequest({
        event: 'pull_request',
        deliveryId: 'delivery-branch-scope',
        payload,
      }) as never,
      response as never,
      {} as never,
    );

    expect(response.statusCode).toBe(202);
    expect(response.body).toMatchObject({
      status: 'ignored',
      reason: 'branch_not_in_scope',
      delivery_id: 'delivery-branch-scope',
    });
    expect(harness.submitGitHubScan).not.toHaveBeenCalled();
    expect(harness.transcript).toEqual([]);
  });

  it('emulates deleted installations being ignored by later webhook deliveries', async () => {
    const deletedResponse = harness.createResponseStub();
    await githubWebhookApiHandler(
      harness.createRequest({
        event: 'installation',
        deliveryId: 'delivery-delete-install',
        payload: buildInstallationWebhookPayload({ installationId: 123, action: 'deleted' }),
      }) as never,
      deletedResponse as never,
      {} as never,
    );

    expect(deletedResponse.statusCode).toBe(202);
    expect(deletedResponse.body).toMatchObject({
      status: 'ok',
      action: 'deleted',
      delivery_id: 'delivery-delete-install',
    });
    expect(harness.removeGithubInstallation).toHaveBeenCalledWith(123);

    const pushResponse = harness.createResponseStub();
    await githubWebhookApiHandler(
      harness.createRequest({
        event: 'push',
        deliveryId: 'delivery-after-delete',
        payload: buildPushWebhookPayload({
          installationId: 123,
          repositoryFullName: 'acme/api',
          repositoryHtmlUrl: 'https://github.com/acme/api',
          defaultBranch: 'main',
          branch: 'main',
          after: 'abc123',
        }),
      }) as never,
      pushResponse as never,
      {} as never,
    );

    expect(pushResponse.statusCode).toBe(202);
    expect(pushResponse.body).toMatchObject({
      status: 'ignored',
      reason: 'installation_not_found',
      delivery_id: 'delivery-after-delete',
    });
    expect(harness.syncGithubInstallation).toHaveBeenCalledWith(123);
    expect(harness.submitGitHubScan).not.toHaveBeenCalled();
    expect(harness.transcript).toEqual([
      'installation:remove:123',
      'installation:sync:123',
    ]);
  });
});

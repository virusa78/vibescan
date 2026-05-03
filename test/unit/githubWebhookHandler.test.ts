import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { prisma } from '../mocks/wasp-server';

const verifyGitHubWebhookSignatureMock = jest.fn();
const getMappedGithubInstallationByInstallationIdMock = jest.fn<
  (installationId: string | number) => Promise<unknown>
>();
const syncGithubInstallationMock = jest.fn<
  (installationId: string | number) => Promise<void>
>();
const removeGithubInstallationMock = jest.fn<
  (installationId: string | number) => Promise<void>
>();
const submitGitHubScanMock = jest.fn<
  (
    actorUserId: string,
    workspaceId: string,
    repositoryHtmlUrl: string,
    githubContext: unknown,
  ) => Promise<{ scan: { id: string } }>
>();
const syncGitHubCheckRunForScanMock = jest.fn<
  (input: { prisma: unknown; scanId: string; status: 'queued' | 'in_progress' | 'completed' }) => Promise<void>
>();

jest.mock('../../wasp-app/src/server/services/githubAppService', () => ({
  verifyGitHubWebhookSignature: verifyGitHubWebhookSignatureMock,
}));

jest.mock('../../wasp-app/src/server/services/githubInstallationService', () => ({
  getMappedGithubInstallationByInstallationId: getMappedGithubInstallationByInstallationIdMock,
  syncGithubInstallation: syncGithubInstallationMock,
  removeGithubInstallation: removeGithubInstallationMock,
}));

jest.mock('../../wasp-app/src/server/services/githubScanService', () => ({
  submitGitHubScan: submitGitHubScanMock,
}));

jest.mock('../../wasp-app/src/server/services/githubCheckRunService', () => ({
  syncGitHubCheckRunForScan: syncGitHubCheckRunForScanMock,
}));

import { githubWebhookApiHandler } from '../../wasp-app/src/server/operations/github/handlers';

function createResponse() {
  const response = {
    status: jest.fn(),
    json: jest.fn(),
  };
  response.status.mockReturnValue(response);
  return response;
}

describe('githubWebhookApiHandler', () => {
  const prismaMock = prisma;

  beforeEach(() => {
    verifyGitHubWebhookSignatureMock.mockReset();
    getMappedGithubInstallationByInstallationIdMock.mockReset();
    syncGithubInstallationMock.mockReset();
    removeGithubInstallationMock.mockReset();
    submitGitHubScanMock.mockReset();
    syncGitHubCheckRunForScanMock.mockReset();
    prismaMock.scan.findFirst.mockReset();
    prismaMock.workspace.findUnique.mockReset();
  });

  it('ignores push events for branches outside installation scope', async () => {
    verifyGitHubWebhookSignatureMock.mockReturnValue(true);
    getMappedGithubInstallationByInstallationIdMock
      .mockResolvedValueOnce({
        githubInstallationId: BigInt(123),
        workspaceId: 'workspace-1',
        repositorySelection: 'selected',
        reposScope: ['acme/api'],
        triggerOnPush: true,
        triggerOnPr: true,
        targetBranches: ['main'],
      })
      .mockResolvedValueOnce({
        githubInstallationId: BigInt(123),
        workspaceId: 'workspace-1',
        repositorySelection: 'selected',
        reposScope: ['acme/api'],
        triggerOnPush: true,
        triggerOnPr: true,
        targetBranches: ['main'],
      });

    const request = {
      headers: {
        'x-hub-signature-256': 'sha256=ok',
        'x-github-event': 'push',
        'x-github-delivery': 'delivery-1',
      },
      body: {
        installation: { id: 123 },
        ref: 'refs/heads/feature-x',
        deleted: false,
        after: 'abc123',
        repository: {
          id: 10,
          full_name: 'acme/api',
          html_url: 'https://github.com/acme/api',
          default_branch: 'main',
          private: true,
        },
      },
    };
    const response = createResponse();

    await githubWebhookApiHandler(request as never, response as never, {} as never);

    expect(response.status).toHaveBeenCalledWith(202);
    expect(response.json).toHaveBeenCalledWith({
      status: 'ignored',
      reason: 'branch_not_in_scope',
      scan_id: undefined,
      delivery_id: 'delivery-1',
    });
    expect(submitGitHubScanMock).not.toHaveBeenCalled();
  });

  it('ignores duplicate deliveries instead of creating duplicate scans', async () => {
    verifyGitHubWebhookSignatureMock.mockReturnValue(true);
    getMappedGithubInstallationByInstallationIdMock
      .mockResolvedValueOnce({
        githubInstallationId: BigInt(123),
        workspaceId: 'workspace-1',
        repositorySelection: 'selected',
        reposScope: ['acme/api'],
        triggerOnPush: true,
        triggerOnPr: true,
        targetBranches: ['main'],
      })
      .mockResolvedValueOnce({
        githubInstallationId: BigInt(123),
        workspaceId: 'workspace-1',
        repositorySelection: 'selected',
        reposScope: ['acme/api'],
        triggerOnPush: true,
        triggerOnPr: true,
        targetBranches: ['main'],
      });
    prismaMock.scan.findFirst.mockResolvedValueOnce({ id: 'existing-scan' });

    const request = {
      headers: {
        'x-hub-signature-256': 'sha256=ok',
        'x-github-event': 'push',
        'x-github-delivery': 'delivery-dup',
      },
      body: {
        installation: { id: 123 },
        ref: 'refs/heads/main',
        deleted: false,
        after: 'abc123',
        repository: {
          id: 10,
          full_name: 'acme/api',
          html_url: 'https://github.com/acme/api',
          default_branch: 'main',
          private: true,
        },
      },
    };
    const response = createResponse();

    await githubWebhookApiHandler(request as never, response as never, {} as never);

    expect(response.status).toHaveBeenCalledWith(202);
    expect(response.json).toHaveBeenCalledWith({
      status: 'ignored',
      reason: 'duplicate_delivery',
      scan_id: undefined,
      delivery_id: 'delivery-dup',
    });
    expect(submitGitHubScanMock).not.toHaveBeenCalled();
  });

  it('queues a scan for allowed push events', async () => {
    verifyGitHubWebhookSignatureMock.mockReturnValue(true);
    getMappedGithubInstallationByInstallationIdMock
      .mockResolvedValueOnce({
        githubInstallationId: BigInt(123),
        workspaceId: 'workspace-1',
        repositorySelection: 'selected',
        reposScope: ['acme/api'],
        triggerOnPush: true,
        triggerOnPr: true,
        targetBranches: ['main'],
      })
      .mockResolvedValueOnce({
        githubInstallationId: BigInt(123),
        workspaceId: 'workspace-1',
        repositorySelection: 'selected',
        reposScope: ['acme/api'],
        triggerOnPush: true,
        triggerOnPr: true,
        targetBranches: ['main'],
      });
    prismaMock.scan.findFirst.mockResolvedValueOnce(null);
    prismaMock.workspace.findUnique.mockResolvedValueOnce({ createdByUserId: 'user-1' });
    submitGitHubScanMock.mockResolvedValueOnce({
      scan: { id: 'scan-123' },
    });

    const request = {
      headers: {
        'x-hub-signature-256': 'sha256=ok',
        'x-github-event': 'push',
        'x-github-delivery': 'delivery-ok',
      },
      body: {
        installation: { id: 123 },
        ref: 'refs/heads/main',
        deleted: false,
        after: 'abc123',
        repository: {
          id: 10,
          full_name: 'acme/api',
          html_url: 'https://github.com/acme/api',
          default_branch: 'main',
          private: true,
        },
      },
    };
    const response = createResponse();

    await githubWebhookApiHandler(request as never, response as never, {} as never);

    expect(submitGitHubScanMock).toHaveBeenCalled();
    expect(syncGitHubCheckRunForScanMock).toHaveBeenCalledWith({
      prisma: prismaMock,
      scanId: 'scan-123',
      status: 'queued',
    });
    expect(response.json).toHaveBeenCalledWith({
      status: 'queued',
      reason: undefined,
      scan_id: 'scan-123',
      delivery_id: 'delivery-ok',
    });
  });

  it('ignores pull requests when PR trigger is disabled', async () => {
    verifyGitHubWebhookSignatureMock.mockReturnValue(true);
    getMappedGithubInstallationByInstallationIdMock
      .mockResolvedValueOnce({
        githubInstallationId: BigInt(123),
        workspaceId: 'workspace-1',
        repositorySelection: 'selected',
        reposScope: ['acme/api'],
        triggerOnPush: true,
        triggerOnPr: false,
        targetBranches: ['main'],
      })
      .mockResolvedValueOnce({
        githubInstallationId: BigInt(123),
        workspaceId: 'workspace-1',
        repositorySelection: 'selected',
        reposScope: ['acme/api'],
        triggerOnPush: true,
        triggerOnPr: false,
        targetBranches: ['main'],
      });

    const request = {
      headers: {
        'x-hub-signature-256': 'sha256=ok',
        'x-github-event': 'pull_request',
        'x-github-delivery': 'delivery-pr',
      },
      body: {
        installation: { id: 123 },
        action: 'opened',
        number: 7,
        repository: {
          id: 10,
          full_name: 'acme/api',
          html_url: 'https://github.com/acme/api',
          default_branch: 'main',
          private: true,
        },
        pull_request: {
          head: {
            ref: 'feature-x',
            sha: 'def456',
            repo: { full_name: 'acme/api' },
          },
          base: {
            ref: 'main',
          },
        },
      },
    };
    const response = createResponse();

    await githubWebhookApiHandler(request as never, response as never, {} as never);

    expect(response.status).toHaveBeenCalledWith(202);
    expect(response.json).toHaveBeenCalledWith({
      status: 'ignored',
      reason: 'pr_trigger_disabled',
      scan_id: undefined,
      delivery_id: 'delivery-pr',
    });
  });
});

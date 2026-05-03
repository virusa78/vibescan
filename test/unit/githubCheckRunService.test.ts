import { afterAll, beforeEach, describe, expect, it, jest } from '@jest/globals';

const createGitHubCheckRunMock = jest.fn<
  (
    installationId: string,
    repositoryFullName: string,
    payload: unknown,
  ) => Promise<{ id: number; html_url?: string | null }>
>();
const updateGitHubCheckRunMock = jest.fn<
  (
    installationId: string,
    repositoryFullName: string,
    checkRunId: number | string,
    payload: unknown,
  ) => Promise<{ id: number; html_url?: string | null }>
>();

jest.mock('../../wasp-app/src/server/services/githubAppService', () => ({
  createGitHubCheckRun: createGitHubCheckRunMock,
  updateGitHubCheckRun: updateGitHubCheckRunMock,
}));

import { syncGitHubCheckRunForScan } from '../../wasp-app/src/server/services/githubCheckRunService';

describe('syncGitHubCheckRunForScan', () => {
  const originalFrontendUrl = process.env.WASP_WEB_CLIENT_URL;

  beforeEach(() => {
    createGitHubCheckRunMock.mockReset();
    updateGitHubCheckRunMock.mockReset();
    process.env.WASP_WEB_CLIENT_URL = 'https://app.vibescan.example';
  });

  afterAll(() => {
    if (originalFrontendUrl === undefined) {
      delete process.env.WASP_WEB_CLIENT_URL;
    } else {
      process.env.WASP_WEB_CLIENT_URL = originalFrontendUrl;
    }
  });

  it('creates a check run and persists its metadata when scan has GitHub context', async () => {
    const prisma = {
      scan: {
        findUnique: jest.fn(async () => ({
          id: 'scan-1',
          status: 'pending',
          githubContext: {
            installationId: '123',
            repositoryFullName: 'acme/repo',
            commitSha: 'abc123',
          },
        })),
        update: jest.fn(async () => ({})),
      },
      githubInstallation: {},
    };

    createGitHubCheckRunMock.mockResolvedValue({
      id: 444,
      html_url: 'https://github.com/acme/repo/runs/444',
    });

    await syncGitHubCheckRunForScan({
      prisma: prisma as never,
      scanId: 'scan-1',
      status: 'queued',
    });

    expect(createGitHubCheckRunMock).toHaveBeenCalledWith(
      '123',
      'acme/repo',
      expect.objectContaining({
        name: 'VibeScan',
        head_sha: 'abc123',
        status: 'queued',
        details_url: 'https://app.vibescan.example/scans/scan-1',
      }),
    );
    expect(prisma.scan.update).toHaveBeenCalledWith({
      where: { id: 'scan-1' },
      data: {
        githubContext: expect.objectContaining({
          installationId: '123',
          repositoryFullName: 'acme/repo',
          commitSha: 'abc123',
          checkRunId: 444,
          checkRunUrl: 'https://github.com/acme/repo/runs/444',
        }),
      },
    });
  });

  it('updates an existing check run on completion', async () => {
    const prisma = {
      scan: {
        findUnique: jest.fn(async () => ({
          id: 'scan-2',
          status: 'scanning',
          githubContext: {
            installationId: '123',
            repositoryFullName: 'acme/repo',
            commitSha: 'def456',
            checkRunId: 999,
            checkRunUrl: 'https://github.com/acme/repo/runs/999',
          },
        })),
        update: jest.fn(async () => ({})),
      },
      githubInstallation: {},
    };

    updateGitHubCheckRunMock.mockResolvedValue({
      id: 999,
      html_url: 'https://github.com/acme/repo/runs/999',
    });

    await syncGitHubCheckRunForScan({
      prisma: prisma as never,
      scanId: 'scan-2',
      status: 'completed',
      findingsCount: 7,
    });

    expect(updateGitHubCheckRunMock).toHaveBeenCalledWith(
      '123',
      'acme/repo',
      999,
      expect.objectContaining({
        status: 'completed',
        conclusion: 'success',
        details_url: 'https://app.vibescan.example/scans/scan-2',
        output: expect.objectContaining({
          title: 'VibeScan completed',
        }),
      }),
    );
  });

  it('does nothing when scan has no GitHub context', async () => {
    const prisma = {
      scan: {
        findUnique: jest.fn(async () => ({
          id: 'scan-3',
          status: 'pending',
          githubContext: null,
        })),
        update: jest.fn(async () => ({})),
      },
      githubInstallation: {},
    };

    await syncGitHubCheckRunForScan({
      prisma: prisma as never,
      scanId: 'scan-3',
      status: 'queued',
    });

    expect(createGitHubCheckRunMock).not.toHaveBeenCalled();
    expect(updateGitHubCheckRunMock).not.toHaveBeenCalled();
    expect(prisma.scan.update).not.toHaveBeenCalled();
  });
});

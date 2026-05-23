import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const prismaMock = {
  scan: {
    findUnique: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
  },
  githubInstallation: {
    findUnique: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
    findFirst: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
  },
};

jest.mock('../../wasp-app/src/server/config/runtime', () => ({
  getFrontendBaseUrl: () => 'https://app.vibescan.example',
}));

jest.mock('wasp/server', () => ({
  prisma: prismaMock,
}));

import {
  buildBlockingIssuesBySource,
  buildCiDecisionForScan,
  buildCiDecisionReason,
} from '../../wasp-app/src/server/services/ciDecisionService';

describe('ciDecisionService', () => {
  beforeEach(() => {
    prismaMock.scan.findUnique.mockReset();
    prismaMock.githubInstallation.findUnique.mockReset();
    prismaMock.githubInstallation.findFirst.mockReset();
  });

  it('counts blocking issues at or above the effective installation threshold', async () => {
    prismaMock.scan.findUnique.mockResolvedValueOnce({
      id: 'scan-1',
      workspaceId: 'workspace-1',
      inputType: 'github_app',
      inputRef: 'https://github.com/acme/repo',
      githubContext: { installationId: '123' },
      findings: [
        { source: 'grype', severity: 'HIGH' },
        { source: 'grype', severity: 'MEDIUM' },
        { source: 'snyk', severity: 'CRITICAL' },
      ],
    });
    prismaMock.githubInstallation.findUnique.mockResolvedValueOnce({
      failPrOnSeverity: 'HIGH',
    });

    const decision = await buildCiDecisionForScan(prismaMock as never, 'scan-1');

    expect(prismaMock.githubInstallation.findUnique).toHaveBeenCalledWith({
      where: { githubInstallationId: BigInt(123) },
      select: { failPrOnSeverity: true },
    });
    expect(decision).toMatchObject({
      scanId: 'scan-1',
      decision: 'fail',
      blockingIssues: 2,
      blockingIssuesBySource: {
        grype: 1,
        snyk: 1,
      },
      criticalIssues: 2,
      criticalIssuesBySource: {
        grype: 1,
        snyk: 1,
      },
      effectiveThreshold: 'HIGH',
      policySource: 'github_installation',
      scanUrl: 'https://app.vibescan.example/scans/scan-1',
      reportUrl: 'https://app.vibescan.example/reports/scan-1',
    });
    expect(decision.reason).toContain('2 findings at or above HIGH');
  });

  it('falls back to the default threshold when no installation policy matches', async () => {
    prismaMock.scan.findUnique.mockResolvedValueOnce({
      id: 'scan-2',
      workspaceId: 'workspace-1',
      inputType: 'github_app',
      inputRef: 'https://github.com/acme/repo',
      githubContext: null,
      findings: [
        { source: 'grype', severity: 'HIGH' },
        { source: 'codescoring_johnny', severity: 'MEDIUM' },
      ],
    });
    prismaMock.githubInstallation.findFirst.mockResolvedValueOnce(null);

    const decision = await buildCiDecisionForScan(prismaMock as never, 'scan-2');

    expect(decision).toMatchObject({
      decision: 'pass',
      blockingIssues: 0,
      blockingIssuesBySource: {},
      effectiveThreshold: 'CRITICAL',
      policySource: 'default',
    });
    expect(decision.reason).toBe('No findings at or above CRITICAL');
  });

  it('builds blocking counts by source for the configured threshold', () => {
    const counts = buildBlockingIssuesBySource(
      [
        { source: 'grype', severity: 'LOW' },
        { source: 'grype', severity: 'HIGH' },
        { source: 'snyk', severity: 'critical' },
        { source: 'trivy', severity: null },
      ],
      'HIGH',
    );

    expect(counts).toEqual({
      grype: 1,
      snyk: 1,
    });
  });

  it('builds human-readable reasons for passing scans', () => {
    expect(buildCiDecisionReason(0, 'CRITICAL', {})).toBe('No findings at or above CRITICAL');
  });
});

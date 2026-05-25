import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { prisma } from '../mocks/wasp-server';
import { getReport } from '../../wasp-app/src/server/operations/reports/getReport';

const prismaMock = prisma as any;

const trackedEnv = [
  'VIBESCAN_CYCLONEDX_CUTOVER_ENABLED',
  'VIBESCAN_CYCLONEDX_ROLLBACK_ENABLED',
  'VIBESCAN_CYCLONEDX_SHADOW_ENABLED',
];

function resetEnv() {
  for (const key of trackedEnv) {
    delete process.env[key];
  }
}

describe('getReport CycloneDX read path', () => {
  beforeEach(() => {
    resetEnv();
    prismaMock.user.findUnique.mockReset();
    prismaMock.scan.findUnique.mockReset();
    prismaMock.scan.findFirst.mockReset();
    prismaMock.finding.findMany.mockReset();
    prismaMock.vulnAcceptance = {
      findMany: jest.fn(),
    };
  });

  it('uses unified stats in cutover mode when ingestion meta is present', async () => {
    process.env.VIBESCAN_CYCLONEDX_CUTOVER_ENABLED = 'true';

    prismaMock.user.findUnique.mockResolvedValue({ id: 'user-1' });
    prismaMock.scan.findUnique.mockResolvedValue({
      id: 'scan-1',
      userId: 'user-1',
      status: 'done',
      findings: [
        { id: 'f-1', source: 'free', severity: 'LOW', cveId: 'CVE-1', packageName: 'a', installedVersion: '1' },
      ],
      scanDeltas: [{ deltaCount: 0 }],
      scanResults: [
        {
          rawOutput: {
            ingestionMeta: {
              resultStatus: 'ingested',
              unifiedStats: {
                vulnerabilityCount: 4,
                severityCounts: {
                  critical: 1,
                  high: 1,
                  medium: 1,
                  low: 1,
                  info: 0,
                },
              },
            },
          },
        },
      ],
    });
    prismaMock.vulnAcceptance.findMany.mockResolvedValue([]);

    const result = await getReport({ scanId: 'scan-1' }, { user: { id: 'user-1', workspaceId: 'workspace-1' } });

    expect(result.severity_breakdown).toEqual({
      critical: 1,
      high: 1,
      medium: 1,
      low: 1,
      info: 0,
    });
  });

  it('falls back to legacy findings in rollback mode even with ingestion meta present', async () => {
    process.env.VIBESCAN_CYCLONEDX_CUTOVER_ENABLED = 'true';
    process.env.VIBESCAN_CYCLONEDX_ROLLBACK_ENABLED = 'true';

    prismaMock.user.findUnique.mockResolvedValue({ id: 'user-1' });
    prismaMock.scan.findUnique.mockResolvedValue({
      id: 'scan-2',
      userId: 'user-1',
      status: 'done',
      findings: [
        { id: 'f-1', source: 'free', severity: 'HIGH', cveId: 'CVE-1', packageName: 'a', installedVersion: '1' },
        { id: 'f-2', source: 'enterprise', severity: 'LOW', cveId: 'CVE-2', packageName: 'b', installedVersion: '2' },
      ],
      scanDeltas: [{ deltaCount: 0 }],
      scanResults: [
        {
          rawOutput: {
            ingestionMeta: {
              resultStatus: 'ingested',
              unifiedStats: {
                vulnerabilityCount: 99,
                severityCounts: { critical: 99 },
              },
            },
          },
        },
      ],
    });
    prismaMock.vulnAcceptance.findMany.mockResolvedValue([]);

    const result = await getReport({ scanId: 'scan-2' }, { user: { id: 'user-1', workspaceId: 'workspace-1' } });

    expect(result.severity_breakdown).toEqual({
      critical: 0,
      high: 1,
      medium: 0,
      low: 1,
      info: 0,
    });
    expect(result.total_free).toBe(1);
    expect(result.total_enterprise).toBe(1);
  });

  it('throws 401 when user is not found', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    await expect(
      getReport({ scanId: 'scan-1' }, { user: { id: 'user-1', workspaceId: 'workspace-1' } })
    ).rejects.toMatchObject({
      statusCode: 401,
      message: 'User not found',
    });
  });

  it('throws 404 when scan is not found', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'user-1' });
    prismaMock.scan.findUnique.mockResolvedValue(null);

    await expect(
      getReport({ scanId: 'scan-1' }, { user: { id: 'user-1', workspaceId: 'workspace-1' } })
    ).rejects.toMatchObject({
      statusCode: 404,
      message: 'Scan not found',
    });
  });

  it('throws 404 when scan belongs to another user/workspace', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'user-1' });
    prismaMock.scan.findUnique.mockResolvedValue({
      id: 'scan-1',
      userId: 'other-user',
      workspaceId: 'other-workspace',
    });

    await expect(
      getReport({ scanId: 'scan-1' }, { user: { id: 'user-1', workspaceId: 'workspace-1' } })
    ).rejects.toMatchObject({
      statusCode: 404,
      message: 'Scan not found',
    });
  });

  it('correctly maps vulnerability status and annotations', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'user-1' });
    prismaMock.scan.findUnique.mockResolvedValue({
      id: 'scan-1',
      userId: 'user-1',
      status: 'error',
      findings: [
        {
          id: 'f-1',
          source: 'grype',
          severity: 'HIGH',
          cveId: 'CVE-1',
          packageName: 'lodash',
          installedVersion: '4.17.20',
          cvssScore: 8.8,
          fixedVersion: '4.17.21',
          description: 'prototype pollution',
          filePath: 'package.json',
          status: 'active',
          detectedData: { reportedBy: ['grype', 'snyk'] },
        },
      ],
      scanDeltas: [{ deltaCount: 2 }],
      scanResults: [],
    });

    const expDate = new Date('2026-12-31T00:00:00.000Z');
    prismaMock.vulnAcceptance.findMany.mockResolvedValue([
      {
        vulnerabilityId: 'f-1',
        status: 'accepted',
        reason: 'Internal usage only',
        expiresAt: expDate,
      },
    ]);

    const result = await getReport({ scanId: 'scan-1' }, { user: { id: 'user-1', workspaceId: 'workspace-1' } });

    expect(result.status).toBe('failed');
    expect(result.delta_count).toBe(2);
    expect(result.vulnerabilities).toHaveLength(1);
    expect(result.vulnerabilities[0]).toEqual({
      id: 'f-1',
      cveId: 'CVE-1',
      packageName: 'lodash',
      installedVersion: '4.17.20',
      severity: 'HIGH',
      cvssScore: 8.8,
      fixedVersion: '4.17.21',
      description: 'prototype pollution',
      source: 'grype',
      filePath: 'package.json',
      status: 'active',
      reportedBy: ['grype', 'snyk'],
      cveReferences: {
        nvd: 'https://nvd.nist.gov/vuln/detail/CVE-1',
        osv: 'https://osv.dev/vulnerability/CVE-1',
        cveDetails: 'https://www.cvedetails.com/cve/CVE-1/',
        mitre: 'https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-1',
      },
      annotation: {
        state: 'snoozed',
        reason: 'Internal usage only',
        expires_at: '2026-12-31T00:00:00.000Z',
      },
    });
  });

  it('correctly maps severity breakdown and source totals using grype/trivy/enterprise fallback', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'user-1' });
    prismaMock.scan.findUnique.mockResolvedValue({
      id: 'scan-1',
      userId: 'user-1',
      status: 'done',
      findings: [
        { id: 'f-1', source: 'grype', severity: 'HIGH', cveId: 'CVE-1', packageName: 'a', installedVersion: '1' },
        { id: 'f-2', source: 'trivy', severity: 'MEDIUM', cveId: 'CVE-2', packageName: 'b', installedVersion: '2' },
        { id: 'f-3', source: 'snyk', severity: 'CRITICAL', cveId: 'CVE-3', packageName: 'c', installedVersion: '3' },
      ],
      scanDeltas: [],
      scanResults: [
        {
          source: 'grype',
          vulnerabilities: [{}],
          rawOutput: {},
        },
        {
          source: 'trivy',
          vulnerabilities: [{}],
          rawOutput: {},
        },
        {
          source: 'snyk',
          vulnerabilities: [{}],
          rawOutput: {},
        },
      ],
    });
    prismaMock.vulnAcceptance.findMany.mockResolvedValue([]);

    const result = await getReport({ scanId: 'scan-1' }, { user: { id: 'user-1', workspaceId: 'workspace-1' } });

    expect(result.total_free).toBe(2); // grype + trivy
    expect(result.total_enterprise).toBe(1); // snyk
  });
});

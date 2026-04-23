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

    const result = await getReport({ scanId: 'scan-1' }, { user: { id: 'user-1' } });

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

    const result = await getReport({ scanId: 'scan-2' }, { user: { id: 'user-1' } });

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
});

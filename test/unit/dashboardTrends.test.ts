import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { getTrendSeries } from '../../wasp-app/src/server/operations/dashboard/getTrendSeries';

type ScanFindManyMock = jest.MockedFunction<
  () => Promise<Array<{ id: string; createdAt: Date }>>
>;
type ScanFindFirstMock = jest.MockedFunction<
  () => Promise<{ createdAt: Date } | null>
>;
type ScanResultFindManyMock = jest.MockedFunction<
  () => Promise<Array<{ source: string; vulnerabilities: Array<{ severity: string }>; scan: { createdAt: Date } }>>
>;
type ScanDeltaFindManyMock = jest.MockedFunction<
  () => Promise<Array<{ deltaCount: number; scan: { createdAt: Date } }>>
>;

describe('getTrendSeries', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-10T12:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('builds zero-filled daily buckets and aggregates scans, findings, and delta', async () => {
    const scanFindMany = jest.fn() as ScanFindManyMock;
    scanFindMany.mockResolvedValue([
      { id: 'scan-1', createdAt: new Date('2026-04-03T09:00:00.000Z') },
      { id: 'scan-2', createdAt: new Date('2026-04-05T09:00:00.000Z') },
    ]);

    const scanFindFirst = jest.fn() as ScanFindFirstMock;
    scanFindFirst.mockResolvedValue({ createdAt: new Date('2026-04-03T09:00:00.000Z') });

    const scanResultFindMany = jest.fn() as ScanResultFindManyMock;
    scanResultFindMany.mockResolvedValue([
      {
        source: 'grype',
        vulnerabilities: [{ severity: 'high' }, { severity: 'medium' }],
        scan: { createdAt: new Date('2026-04-03T09:00:00.000Z') },
      },
      {
        source: 'snyk',
        vulnerabilities: [{ severity: 'critical' }],
        scan: { createdAt: new Date('2026-04-05T09:00:00.000Z') },
      },
    ]);

    const scanDeltaFindMany = jest.fn() as ScanDeltaFindManyMock;
    scanDeltaFindMany.mockResolvedValue([
      { deltaCount: 2, scan: { createdAt: new Date('2026-04-03T09:00:00.000Z') } },
      { deltaCount: 1, scan: { createdAt: new Date('2026-04-05T09:00:00.000Z') } },
    ]);

    const context = {
      user: { id: 'user-1', workspaceId: 'workspace-1' },
      entities: {
        Scan: {
          findMany: scanFindMany,
          findFirst: scanFindFirst,
        },
        ScanResult: {
          findMany: scanResultFindMany,
        },
        ScanDelta: {
          findMany: scanDeltaFindMany,
        },
      },
    };

    const result = await getTrendSeries({ time_range: '7d' }, context);

    expect(result.time_range).toBe('7d');
    expect(result.granularity).toBe('day');
    expect(result.buckets).toHaveLength(8);
    expect(result.buckets.find((bucket) => bucket.bucket_start === '2026-04-03T00:00:00.000Z')).toEqual({
      bucket_start: '2026-04-03T00:00:00.000Z',
      scans: 1,
      findings: 2,
      delta: 2,
      findings_by_source: {
        grype: 2,
      },
    });
    expect(result.buckets.find((bucket) => bucket.bucket_start === '2026-04-05T00:00:00.000Z')).toEqual({
      bucket_start: '2026-04-05T00:00:00.000Z',
      scans: 1,
      findings: 1,
      delta: 1,
      findings_by_source: {
        snyk: 1,
      },
    });
    expect(result.totals).toEqual({
      scans: 2,
      findings: 3,
      delta: 3,
      findings_by_source: {
        grype: 2,
        snyk: 1,
      },
    });
  });
});

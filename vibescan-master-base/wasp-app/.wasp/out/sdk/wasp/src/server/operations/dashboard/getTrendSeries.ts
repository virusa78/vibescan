import { prisma } from 'wasp/server';
import * as z from 'zod';
import { ensureArgsSchemaOrThrowHttpError } from '../../validation';
import {
  buildNestedScanWorkspaceWhere,
  buildWorkspaceOrLegacyOwnerWhere,
  requireWorkspaceScopedUser,
} from '../../services/workspaceAccess';

const getTrendSeriesInputSchema = z.object({
  time_range: z.enum(['7d', '30d', 'all']).default('30d'),
  granularity: z.enum(['day', 'week']).optional(),
});

export type GetTrendSeriesInput = z.infer<typeof getTrendSeriesInputSchema>;
export type TrendGranularity = 'day' | 'week';

export interface TrendBucket {
  bucket_start: string;
  scans: number;
  findings: number;
  delta: number;
  findings_by_source: Record<string, number>;
}

export interface TrendSeriesResponse {
  time_range: '7d' | '30d' | 'all';
  granularity: TrendGranularity;
  buckets: TrendBucket[];
  totals: {
    scans: number;
    findings: number;
    delta: number;
    findings_by_source: Record<string, number>;
  };
}


function startOfUtcDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function startOfUtcWeek(value: Date): Date {
  const dayStart = startOfUtcDay(value);
  const dayOfWeek = dayStart.getUTCDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(dayStart);
  monday.setUTCDate(dayStart.getUTCDate() + diffToMonday);
  return monday;
}

function addGranularity(value: Date, granularity: TrendGranularity): Date {
  const next = new Date(value);
  if (granularity === 'week') {
    next.setUTCDate(next.getUTCDate() + 7);
    return next;
  }
  next.setUTCDate(next.getUTCDate() + 1);
  return next;
}

function normalizeBucketStart(value: Date, granularity: TrendGranularity): Date {
  return granularity === 'week' ? startOfUtcWeek(value) : startOfUtcDay(value);
}

function getDateRangeStart(
  timeRange: '7d' | '30d' | 'all',
  now: Date,
  earliestScanCreatedAt: Date | null,
): Date {
  if (timeRange === '7d') {
    return startOfUtcDay(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
  }
  if (timeRange === '30d') {
    return startOfUtcDay(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000));
  }
  if (earliestScanCreatedAt) {
    return startOfUtcWeek(earliestScanCreatedAt);
  }
  return startOfUtcDay(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000));
}

export async function getTrendSeries(
  rawArgs: unknown,
  context: any,
): Promise<any> {
  const user = await requireWorkspaceScopedUser(context.user);
  const args = ensureArgsSchemaOrThrowHttpError(getTrendSeriesInputSchema, rawArgs);
  const now = new Date();
  const granularity: TrendGranularity = args.granularity ?? (args.time_range === 'all' ? 'week' : 'day');
  const scanDelegate = context.entities?.Scan ?? prisma.scan;
  const scanResultDelegate = context.entities?.ScanResult ?? prisma.scanResult;
  const scanDeltaDelegate = context.entities?.ScanDelta ?? prisma.scanDelta;

  const earliestScan = args.time_range === 'all'
    ? await scanDelegate.findFirst({
        where: buildWorkspaceOrLegacyOwnerWhere(user),
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      })
    : null;

  const rangeStart = getDateRangeStart(args.time_range, now, earliestScan?.createdAt ?? null);
  const normalizedRangeStart = normalizeBucketStart(rangeStart, granularity);
  const normalizedRangeEnd = normalizeBucketStart(now, granularity);

  const bucketMap = new Map<string, TrendBucket>();
  for (
    let cursor = new Date(normalizedRangeStart);
    cursor.getTime() <= normalizedRangeEnd.getTime();
    cursor = addGranularity(cursor, granularity)
  ) {
    const key = cursor.toISOString();
    bucketMap.set(key, {
      bucket_start: key,
      scans: 0,
      findings: 0,
      delta: 0,
      findings_by_source: {},
    });
  }

  const [scans, scanResults, deltas] = await Promise.all([
    scanDelegate.findMany({
      where: {
        ...buildWorkspaceOrLegacyOwnerWhere(user),
        createdAt: { gte: normalizedRangeStart },
      },
      select: {
        id: true,
        createdAt: true,
      },
    }),
    scanResultDelegate.findMany({
      where: {
        scan: {
          ...buildNestedScanWorkspaceWhere(user),
          createdAt: {
            gte: normalizedRangeStart,
          },
        },
      },
      select: {
        source: true,
        vulnerabilities: true,
        scan: {
          select: {
            createdAt: true,
          },
        },
      },
    }),
    scanDeltaDelegate.findMany({
      where: {
        scan: {
          ...buildNestedScanWorkspaceWhere(user),
          createdAt: {
            gte: normalizedRangeStart,
          },
        },
      },
      select: {
        deltaCount: true,
        scan: {
          select: {
            createdAt: true,
          },
        },
      },
    }),
  ]);

  for (const scan of scans) {
    const bucketStart = normalizeBucketStart(scan.createdAt, granularity).toISOString();
    const bucket = bucketMap.get(bucketStart);
    if (bucket) {
      bucket.scans += 1;
    }
  }

  for (const result of scanResults) {
    const bucketStart = normalizeBucketStart(result.scan.createdAt, granularity).toISOString();
    const bucket = bucketMap.get(bucketStart);
    if (bucket) {
      const findingsCount = Array.isArray(result.vulnerabilities) ? result.vulnerabilities.length : 0;
      bucket.findings += findingsCount;
      bucket.findings_by_source[result.source] = (bucket.findings_by_source[result.source] ?? 0) + findingsCount;
    }
  }

  for (const delta of deltas) {
    const bucketStart = normalizeBucketStart(delta.scan.createdAt, granularity).toISOString();
    const bucket = bucketMap.get(bucketStart);
    if (bucket) {
      bucket.delta += Number(delta.deltaCount ?? 0);
    }
  }

  const buckets = [...bucketMap.values()].sort(
    (a, b) => new Date(a.bucket_start).getTime() - new Date(b.bucket_start).getTime(),
  );

  const totals = buckets.reduce(
    (acc, bucket) => ({
      scans: acc.scans + bucket.scans,
      findings: acc.findings + bucket.findings,
      delta: acc.delta + bucket.delta,
      findings_by_source: Object.entries(bucket.findings_by_source).reduce<Record<string, number>>(
        (sourceAccumulator, [source, count]) => {
          sourceAccumulator[source] = (acc.findings_by_source[source] ?? 0) + count;
          return sourceAccumulator;
        },
        { ...acc.findings_by_source },
      ),
    }),
    { scans: 0, findings: 0, delta: 0, findings_by_source: {} as Record<string, number> },
  );

  return {
    time_range: args.time_range,
    granularity,
    buckets,
    totals,
  };
}

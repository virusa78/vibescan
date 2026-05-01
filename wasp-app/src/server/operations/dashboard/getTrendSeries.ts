import { HttpError } from 'wasp/server';
import * as z from 'zod';
import { ensureArgsSchemaOrThrowHttpError } from '../../validation';

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
}

export interface TrendSeriesResponse {
  time_range: '7d' | '30d' | 'all';
  granularity: TrendGranularity;
  buckets: TrendBucket[];
  totals: {
    scans: number;
    findings: number;
    delta: number;
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

export async function getTrendSeries(rawArgs: any, context: any): Promise<any> {
  if (!context.user) {
    throw new HttpError(401, 'User not authenticated');
  }

  const args = ensureArgsSchemaOrThrowHttpError(getTrendSeriesInputSchema, rawArgs);
  const now = new Date();
  const granularity: TrendGranularity = args.granularity ?? (args.time_range === 'all' ? 'week' : 'day');

  const earliestScan = args.time_range === 'all'
    ? await context.entities.Scan.findFirst({
        where: { userId: context.user.id },
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
    });
  }

  const [scans, findings, deltas] = await Promise.all([
    context.entities.Scan.findMany({
      where: {
        userId: context.user.id,
        createdAt: { gte: normalizedRangeStart },
      },
      select: {
        id: true,
        createdAt: true,
      },
    }),
    context.entities.Finding.findMany({
      where: {
        userId: context.user.id,
        status: 'active',
        scan: {
          createdAt: {
            gte: normalizedRangeStart,
          },
        },
      },
      select: {
        scan: {
          select: {
            createdAt: true,
          },
        },
      },
    }),
    context.entities.ScanDelta.findMany({
      where: {
        scan: {
          userId: context.user.id,
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

  for (const finding of findings) {
    const bucketStart = normalizeBucketStart(finding.scan.createdAt, granularity).toISOString();
    const bucket = bucketMap.get(bucketStart);
    if (bucket) {
      bucket.findings += 1;
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
    }),
    { scans: 0, findings: 0, delta: 0 },
  );

  return {
    time_range: args.time_range,
    granularity,
    buckets,
    totals,
  } as any;
}

import { prisma } from 'wasp/server';
import * as z from 'zod';
import { ensureArgsSchemaOrThrowHttpError } from '../../validation';
import type { AuthenticatedScanUser, ScanStatusValue } from './shared.js';
import {
  buildNestedScanWorkspaceWhere,
  buildWorkspaceOrLegacyOwnerWhere,
  requireWorkspaceScopedUser,
} from '../../services/workspaceAccess';

const getScanStatsInputSchema = z.object({
  time_range: z.string().default('30d'),
});

export type GetScanStatsInput = z.infer<typeof getScanStatsInputSchema>;

export interface ScanStatsResponse {
  total_scans: number;
  by_status: {
    pending: number;
    scanning: number;
    done: number;
    error: number;
    cancelled: number;
  };
  by_severity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  scan_rate: {
    per_day: number;
    per_week: number;
  };
  by_source: Record<string, number>;
  time_range: string;
}


const trackedStatuses: Record<ScanStatusValue, number> = {
  pending: 0,
  scanning: 0,
  done: 0,
  error: 0,
  cancelled: 0,
};

type SeverityBucket = 'critical' | 'high' | 'medium' | 'low' | 'info';

export async function getScanStats(
  rawArgs: unknown,
  context: any,
): Promise<any> {
  const user = await requireWorkspaceScopedUser(context.user);
  const args = ensureArgsSchemaOrThrowHttpError(getScanStatsInputSchema, rawArgs);

  const now = new Date();
  let fromDate = new Date(0);

  if (args.time_range === '7d') {
    fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else if (args.time_range === '30d') {
    fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  const where = {
    ...buildWorkspaceOrLegacyOwnerWhere(user),
    createdAt: { gte: fromDate },
  };

  const scans = await prisma.scan.findMany({
    where,
    select: {
      id: true,
      status: true,
      createdAt: true,
    },
  });

  const byStatus = { ...trackedStatuses };

  scans.forEach((scan) => {
    if (scan.status in byStatus) {
      byStatus[scan.status as keyof typeof byStatus]++;
    }
  });

  const [findings, scanResults] = await Promise.all([
    prisma.finding.findMany({
      where: {
        scanId: { in: scans.map((scan) => scan.id) },
        status: 'active',
      },
      select: {
        severity: true,
      },
    }),
    prisma.scanResult.findMany({
      where: {
        scan: {
          ...buildNestedScanWorkspaceWhere(user),
          createdAt: { gte: fromDate },
        },
      },
      select: {
        source: true,
        vulnerabilities: true,
      },
    }),
  ]);

  const bySeverity = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };
  const bySource = scanResults.reduce<Record<string, number>>((accumulator, result) => {
    accumulator[result.source] = Array.isArray(result.vulnerabilities) ? result.vulnerabilities.length : 0;
    return accumulator;
  }, {});

  findings.forEach((finding) => {
    const severity = finding.severity.toLowerCase() as SeverityBucket;
    if (severity in bySeverity) {
      bySeverity[severity as keyof typeof bySeverity]++;
    }
  });

  const daysInRange = Math.max(1, (now.getTime() - fromDate.getTime()) / (24 * 60 * 60 * 1000));
  const scanRate = {
    per_day: parseFloat((scans.length / daysInRange).toFixed(2)),
    per_week: parseFloat(((scans.length / daysInRange) * 7).toFixed(2)),
  };

  return {
    total_scans: scans.length,
    by_status: byStatus,
    by_severity: bySeverity,
    scan_rate: scanRate,
    by_source: bySource,
    time_range: args.time_range,
  };
}

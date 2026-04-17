import type { Scan } from 'wasp/entities';
import { HttpError } from 'wasp/server';
import * as z from 'zod';
import { ensureArgsSchemaOrThrowHttpError } from '../../validation';

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
  time_range: string;
}

export async function getScanStats(rawArgs: any, context: any): Promise<ScanStatsResponse> {
  if (!context.user) {
    throw new HttpError(401, 'User not authenticated');
  }

  const args = ensureArgsSchemaOrThrowHttpError(getScanStatsInputSchema, rawArgs);

  const now = new Date();
  let fromDate = new Date(0);

  if (args.time_range === '7d') {
    fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else if (args.time_range === '30d') {
    fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  const where = {
    userId: context.user.id,
    createdAt: { gte: fromDate },
  };

  const scans = await context.entities.Scan.findMany({
    where,
    select: {
      id: true,
      status: true,
      createdAt: true,
    },
  });

  const byStatus = {
    pending: 0,
    scanning: 0,
    done: 0,
    error: 0,
    cancelled: 0,
  };

  scans.forEach(scan => {
    if (scan.status in byStatus) {
      byStatus[scan.status as keyof typeof byStatus]++;
    }
  });

  const findings = await context.entities.Finding.findMany({
    where: {
      scanId: { in: scans.map(s => s.id) },
      status: 'active',
    },
    select: {
      severity: true,
    },
  });

  const bySeverity = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };

  findings.forEach(finding => {
    const severity = finding.severity.toLowerCase();
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
    time_range: args.time_range,
  };
}

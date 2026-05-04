import { HttpError, prisma } from 'wasp/server';
import * as z from 'zod';
import { ensureArgsSchemaOrThrowHttpError } from '../../validation';
import {
  buildNestedScanWorkspaceWhere,
  buildWorkspaceOrLegacyOwnerWhere,
  requireWorkspaceScopedUser,
} from '../../services/workspaceAccess';

const getDashboardMetricsInputSchema = z.object({
  time_range: z.enum(['7d', '30d', 'all']).default('30d'),
});

export type GetDashboardMetricsInput = z.infer<typeof getDashboardMetricsInputSchema>;

export interface MetricsResponse {
  total_scans: number;
  scans_this_month: number;
  total_vulnerabilities: number;
  avg_severity: string | null;
  quota_used: number;
  quota_limit: number;
  plan_tier: string;
  vulnerabilities_by_source: Record<string, number>;
  time_range: string;
}


function getDateRangeStart(timeRange: string): Date {
  const now = new Date();
  switch (timeRange) {
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case '30d':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case 'all':
      return new Date('2000-01-01');
    default:
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }
}

function calculateAverageSeverity(findings: Array<{ severity: string }>): string | null {
  if (findings.length === 0) return null;

  const severityMap: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1, INFO: 0 };
  const total = findings.reduce((sum, f) => sum + (severityMap[f.severity] || 0), 0);
  const average = total / findings.length;

  if (average >= 3.5) return 'CRITICAL';
  if (average >= 2.5) return 'HIGH';
  if (average >= 1.5) return 'MEDIUM';
  if (average >= 0.5) return 'LOW';
  return 'INFO';
}

export async function getDashboardMetrics(
  rawArgs: unknown,
  context: any,
): Promise<any> {
  const user = await requireWorkspaceScopedUser(context.user);
  const args = ensureArgsSchemaOrThrowHttpError(getDashboardMetricsInputSchema, rawArgs);
  const dateRangeStart = getDateRangeStart(args.time_range);
  const createdAtFilter = {
    gte: args.time_range === 'all' ? undefined : dateRangeStart,
  };
  const scanScopeWhere = {
    ...buildWorkspaceOrLegacyOwnerWhere(user),
    createdAt: createdAtFilter,
  };

  // Count total scans for user in time range
  const totalScans = await prisma.scan.count({
    where: scanScopeWhere,
  });

  // Count scans this month (calendar month)
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const scansThisMonth = await prisma.scan.count({
    where: {
      ...buildWorkspaceOrLegacyOwnerWhere(user),
      createdAt: {
        gte: monthStart,
      },
    },
  });

  // Count total vulnerabilities across all scans in time range
  const [findings, scanResults] = await Promise.all([
    prisma.finding.findMany({
      where: {
        scan: {
          ...buildNestedScanWorkspaceWhere(user),
          createdAt: createdAtFilter,
        },
        status: 'active', // Only count active findings
      },
      select: {
        severity: true,
      },
    }),
    prisma.scanResult.findMany({
      where: {
        scan: {
          ...buildNestedScanWorkspaceWhere(user),
          createdAt: createdAtFilter,
        },
      },
      select: {
        source: true,
        vulnerabilities: true,
      },
    }),
  ]);

  const totalVulnerabilities = findings.length;
  const avgSeverity = calculateAverageSeverity(findings);
  const vulnerabilitiesBySource = scanResults.reduce<Record<string, number>>((accumulator, result) => {
    accumulator[result.source] = Array.isArray(result.vulnerabilities) ? result.vulnerabilities.length : 0;
    return accumulator;
  }, {});

  // Get user quota info
  const userRecord = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      monthlyQuotaUsed: true,
      monthlyQuotaLimit: true,
      plan: true,
    },
  });

  if (!userRecord) {
    throw new HttpError(404, 'User not found');
  }

  return {
    total_scans: totalScans,
    scans_this_month: scansThisMonth,
    total_vulnerabilities: totalVulnerabilities,
    avg_severity: avgSeverity,
    quota_used: userRecord.monthlyQuotaUsed,
    quota_limit: userRecord.monthlyQuotaLimit,
    plan_tier: userRecord.plan,
    vulnerabilities_by_source: vulnerabilitiesBySource,
    time_range: args.time_range,
  };
}

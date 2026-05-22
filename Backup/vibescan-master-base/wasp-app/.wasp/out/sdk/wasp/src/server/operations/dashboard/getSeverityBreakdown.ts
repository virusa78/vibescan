import { prisma } from 'wasp/server';
import * as z from 'zod';
import { ensureArgsSchemaOrThrowHttpError } from '../../validation';
import {
  buildNestedScanWorkspaceWhere,
  requireWorkspaceScopedUser,
} from '../../services/workspaceAccess';

const getSeverityBreakdownInputSchema = z.object({
  time_range: z.enum(['7d', '30d', 'all']).default('30d'),
});

export type GetSeverityBreakdownInput = z.infer<typeof getSeverityBreakdownInputSchema>;

export interface SeverityBreakdownResponse {
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
  total: number;
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

export async function getSeverityBreakdown(
  rawArgs: unknown,
  context: any
): Promise<any> {
  const user = await requireWorkspaceScopedUser(context.user);
  const args = ensureArgsSchemaOrThrowHttpError(getSeverityBreakdownInputSchema, rawArgs);
  const dateRangeStart = getDateRangeStart(args.time_range);

  // Query all findings for user's scans in the time range
  const findings = await prisma.finding.findMany({
    where: {
      status: 'active', // Only count active findings
      scan: {
        ...buildNestedScanWorkspaceWhere(user),
        createdAt: {
          gte: args.time_range === 'all' ? undefined : dateRangeStart,
        },
      },
    },
    select: {
      severity: true,
    },
  });

  // Count by severity
  const breakdown = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };

  for (const finding of findings) {
    const severity = finding.severity.toLowerCase();
    if (severity in breakdown) {
      breakdown[severity as keyof typeof breakdown]++;
    }
  }

  const total = findings.length;

  return {
    critical: breakdown.critical,
    high: breakdown.high,
    medium: breakdown.medium,
    low: breakdown.low,
    info: breakdown.info,
    total,
    time_range: args.time_range,
  };
}

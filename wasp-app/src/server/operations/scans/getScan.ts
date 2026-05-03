import { HttpError, prisma } from 'wasp/server';
import * as z from 'zod';
import { ensureArgsSchemaOrThrowHttpError } from '../../validation';
import { countJsonArrayItems, type AuthenticatedScanUser } from './shared.js';
import {
  buildWorkspaceOrLegacyOwnerWhere,
  requireWorkspaceScopedUser,
} from '../../services/workspaceAccess';

const getScanInputSchema = z.object({
  scan_id: z.string().uuid(),
});

export type GetScanInput = z.infer<typeof getScanInputSchema>;

export interface ScanDetailResponse {
  scan: {
    id: string;
    status: string;
    inputType: string;
    inputRef: string;
    planAtSubmission: string;
    planned_sources: string[];
    created_at: Date;
    completed_at: Date | null;
    error_message: string | null;
  };
  results_summary: {
    free_count: number;
    enterprise_count: number;
    total_count: number;
    counts_by_source: Record<string, number>;
  };
  delta_summary: {
    delta_count: number;
    delta_by_severity: Record<string, number>;
    is_locked: boolean;
  };
  status: string;
}

type ScanRecord = {
  id: string;
  status: string;
  inputType: string;
  inputRef: string;
  planAtSubmission: string;
  plannedSources?: string[] | null;
  createdAt: Date;
  completedAt: Date | null;
  errorMessage: string | null;
};

type ScanResultRecord = {
  source: string;
  vulnerabilities: unknown;
};

type ScanDeltaRecord = {
  deltaBySeverity: unknown;
  deltaCount: number;
  isLocked?: boolean | null;
};


function toSeverityDeltaMap(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const entries = Object.entries(value as Record<string, unknown>).filter(([, count]) => typeof count === 'number');
  return Object.fromEntries(entries) as Record<string, number>;
}

function buildCountsBySource(results: ScanResultRecord[]): Record<string, number> {
  return results.reduce<Record<string, number>>((accumulator, result) => {
    accumulator[result.source] = countJsonArrayItems(result.vulnerabilities);
    return accumulator;
  }, {});
}

function getLegacyCompatibilityCounts(countsBySource: Record<string, number>): {
  freeCount: number;
  enterpriseCount: number;
  totalCount: number;
} {
  const freeCount = countsBySource.grype ?? 0;
  const totalCount = Object.values(countsBySource).reduce((sum, count) => sum + count, 0);
  const enterpriseCount = totalCount - freeCount;

  return {
    freeCount,
    enterpriseCount,
    totalCount,
  };
}

export async function getScan(rawArgs: unknown, context: any): Promise<any> {
  const user = await requireWorkspaceScopedUser(context.user);
  const args = ensureArgsSchemaOrThrowHttpError(getScanInputSchema, rawArgs);

  const scan = await prisma.scan.findFirst({
    where: {
      id: args.scan_id,
      ...buildWorkspaceOrLegacyOwnerWhere(user),
    },
  }) as ScanRecord | null;

  if (!scan) {
    throw new HttpError(404, 'Scan not found or unauthorized');
  }

  const scanResults = await prisma.scanResult.findMany({
    where: { scanId: scan.id },
  }) as ScanResultRecord[];

  const countsBySource = buildCountsBySource(scanResults);
  const compatibilityCounts = getLegacyCompatibilityCounts(countsBySource);

  const scanDelta = await prisma.scanDelta.findUnique({
    where: { scanId: scan.id },
  }) as ScanDeltaRecord | null;

  const deltaBySeverity = toSeverityDeltaMap(scanDelta?.deltaBySeverity);
  const deltaCount = scanDelta?.deltaCount || 0;

  return {
    scan: {
      id: scan.id,
      status: scan.status,
      inputType: scan.inputType,
      inputRef: scan.inputRef,
      planAtSubmission: scan.planAtSubmission,
      planned_sources: Array.isArray(scan.plannedSources) ? scan.plannedSources : [],
      created_at: scan.createdAt,
      completed_at: scan.completedAt,
      error_message: scan.errorMessage,
    },
    results_summary: {
      free_count: compatibilityCounts.freeCount,
      enterprise_count: compatibilityCounts.enterpriseCount,
      total_count: compatibilityCounts.totalCount,
      counts_by_source: countsBySource,
    },
    delta_summary: {
      delta_count: deltaCount,
      delta_by_severity: deltaBySeverity,
      is_locked: scanDelta?.isLocked ?? false,
    },
    status: scan.status,
  };
}

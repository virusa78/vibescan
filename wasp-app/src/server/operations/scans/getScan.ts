import type { Scan, ScanResult, ScanDelta } from 'wasp/entities';
import { HttpError } from 'wasp/server';
import * as z from 'zod';
import { ensureArgsSchemaOrThrowHttpError } from '../../validation';

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
    created_at: Date;
    completed_at: Date | null;
    error_message: string | null;
  };
  results_summary: {
    free_count: number;
    enterprise_count: number;
    total_count: number;
  };
  delta_summary: {
    delta_count: number;
    delta_by_severity: Record<string, number>;
    is_locked: boolean;
  };
  status: string;
}

export async function getScan(rawArgs: any, context: any): Promise<ScanDetailResponse> {
  if (!context.user) {
    throw new HttpError(401, 'User not authenticated');
  }

  const args = ensureArgsSchemaOrThrowHttpError(getScanInputSchema, rawArgs);

  const scan = await context.entities.Scan.findFirst({
    where: {
      id: args.scan_id,
      userId: context.user.id,
    },
  });

  if (!scan) {
    throw new HttpError(404, 'Scan not found or unauthorized');
  }

  const scanResults = await context.entities.ScanResult.findMany({
    where: { scanId: scan.id },
  });

  const freeResult = scanResults.find(r => r.source === 'free');
  const enterpriseResult = scanResults.find(r => r.source === 'enterprise');

  const freeCount = freeResult ? (freeResult.vulnerabilities as any[]).length || 0 : 0;
  const enterpriseCount = enterpriseResult ? (enterpriseResult.vulnerabilities as any[]).length || 0 : 0;

  const scanDelta = await context.entities.ScanDelta.findUnique({
    where: { scanId: scan.id },
  });

  const deltaBySeverity = scanDelta?.deltaBySeverity || {};
  const deltaCount = scanDelta?.deltaCount || 0;
  const isLocked = scanDelta?.isLocked || false;

  return {
    scan: {
      id: scan.id,
      status: scan.status,
      inputType: scan.inputType,
      inputRef: scan.inputRef,
      planAtSubmission: scan.planAtSubmission,
      created_at: scan.createdAt,
      completed_at: scan.completedAt,
      error_message: scan.errorMessage,
    },
    results_summary: {
      free_count: freeCount,
      enterprise_count: enterpriseCount,
      total_count: freeCount + enterpriseCount,
    },
    delta_summary: {
      delta_count: deltaCount,
      delta_by_severity: deltaBySeverity as Record<string, number>,
      is_locked: isLocked,
    },
    status: scan.status,
  };
}

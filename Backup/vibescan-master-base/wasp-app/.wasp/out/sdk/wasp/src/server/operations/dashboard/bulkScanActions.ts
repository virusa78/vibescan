import { HttpError } from 'wasp/server';
import * as z from 'zod';
import { ensureArgsSchemaOrThrowHttpError } from '../../validation';
import { cancelScan } from '../scans/cancelScan';
import { submitScanSubmission } from '../../services/scanSubmissionService.js';

const bulkInputSchema = z.object({
  scanIds: z.array(z.string().uuid()).min(1).max(100),
});

const exportInputSchema = bulkInputSchema.extend({
  format: z.enum(['csv', 'jsonl']),
});

type BulkScanArgs = z.infer<typeof bulkInputSchema>;
type ExportScanArgs = z.infer<typeof exportInputSchema>;

type BulkItemResult = {
  scanId: string;
  success: boolean;
  error?: string;
  message?: string;
};

type OwnedScanRow = {
  id: string;
  status: string;
  inputRef: string;
  inputType: string;
  createdAt: Date;
  completedAt: Date | null;
  planAtSubmission: string;
  _count?: {
    findings?: number;
  };
};


type HttpErrorLike = {
  data?: {
    error?: string;
  };
};

function ensureUser(context: any): { id: string } {
  if (!context.user) {
    throw new HttpError(401, 'User not authenticated');
  }

  return context.user;
}

function normalizeScanInputType(inputType: string): 'github' | 'sbom' | 'source_zip' | null {
  if (inputType === 'github_app' || inputType === 'github') return 'github';
  if (inputType === 'sbom_upload' || inputType === 'sbom') return 'sbom';
  if (inputType === 'source_zip') return 'source_zip';
  return null;
}

async function loadOwnedScans(context: any, userId: string, scanIds: string[]) {
  const scans = await context.entities.Scan.findMany({
    where: {
      id: { in: scanIds },
      userId,
    },
    select: {
      id: true,
      status: true,
      inputRef: true,
      inputType: true,
      createdAt: true,
      completedAt: true,
      planAtSubmission: true,
      _count: {
        select: {
          findings: true,
        },
      },
    },
  });

  const typedScans = scans as OwnedScanRow[];
  const byId = new Map(typedScans.map((scan) => [scan.id, scan]));

  const ordered = scanIds.map((scanId) => byId.get(scanId) ?? null);
  return ordered;
}

export async function bulkCancelScans(rawArgs: unknown, context: any): Promise<{
  requested: number;
  succeeded: number;
  failed: number;
  results: BulkItemResult[];
}> {
  const user = ensureUser(context);
  const args: BulkScanArgs = ensureArgsSchemaOrThrowHttpError(bulkInputSchema, rawArgs);

  const scanRows = await loadOwnedScans(context, user.id, args.scanIds);
  const results: BulkItemResult[] = [];

  for (const [index, scan] of scanRows.entries()) {
    const scanId = args.scanIds[index];
    if (!scan) {
      results.push({ scanId, success: false, error: 'not_found' });
      continue;
    }

    try {
      const response = await cancelScan({ scan_id: scan.id }, context);
      results.push({ scanId: scan.id, success: true, message: response.message });
    } catch (error: unknown) {
      const errorCode = (error as HttpErrorLike)?.data?.error || 'cancel_failed';
      results.push({ scanId: scan.id, success: false, error: errorCode });
    }
  }

  const succeeded = results.filter((item) => item.success).length;
  return {
    requested: args.scanIds.length,
    succeeded,
    failed: results.length - succeeded,
    results,
  };
}

export async function bulkRerunScans(rawArgs: unknown, context: any): Promise<{
  requested: number;
  succeeded: number;
  failed: number;
  results: BulkItemResult[];
}> {
  const user = ensureUser(context);
  const args: BulkScanArgs = ensureArgsSchemaOrThrowHttpError(bulkInputSchema, rawArgs);

  const scanRows = await loadOwnedScans(context, user.id, args.scanIds);
  const results: BulkItemResult[] = [];

  for (const [index, scan] of scanRows.entries()) {
    const scanId = args.scanIds[index];
    if (!scan) {
      results.push({ scanId, success: false, error: 'not_found' });
      continue;
    }

    const normalizedInputType = normalizeScanInputType(scan.inputType);
    if (!normalizedInputType || !scan.inputRef?.trim()) {
      results.push({ scanId: scan.id, success: false, error: 'missing_source_input' });
      continue;
    }

    try {
      await submitScanSubmission({
        userId: user.id,
        workspaceId: (user as any).workspaceId || user.id,
        inputType: normalizedInputType,
        inputRef: scan.inputRef,
      });

      results.push({ scanId: scan.id, success: true, message: 'queued' });
    } catch (error: unknown) {
      const errorCode = (error as HttpErrorLike)?.data?.error || 'rerun_failed';
      results.push({ scanId: scan.id, success: false, error: errorCode });
    }
  }

  const succeeded = results.filter((item) => item.success).length;
  return {
    requested: args.scanIds.length,
    succeeded,
    failed: results.length - succeeded,
    results,
  };
}

function escapeCsv(value: unknown): string {
  const text = String(value ?? '');
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export async function exportScans(rawArgs: unknown, context: any): Promise<{
  format: 'csv' | 'jsonl';
  filename: string;
  content: string;
  exported: number;
  skipped: number;
}> {
  const user = ensureUser(context);
  const args: ExportScanArgs = ensureArgsSchemaOrThrowHttpError(exportInputSchema, rawArgs);

  const scanRows = await loadOwnedScans(context, user.id, args.scanIds);
  const validRows = scanRows.filter((scan): scan is NonNullable<typeof scan> => scan !== null);

  const now = new Date().toISOString().replace(/[:.]/g, '-');

  if (args.format === 'jsonl') {
    const content = validRows
      .map((scan) => JSON.stringify({
        id: scan.id,
        status: scan.status,
        inputType: scan.inputType,
        inputRef: scan.inputRef,
        planAtSubmission: scan.planAtSubmission,
        createdAt: scan.createdAt,
        completedAt: scan.completedAt,
        findingsCount: scan._count?.findings ?? 0,
      }))
      .join('\n');

    return {
      format: 'jsonl',
      filename: `vibescan-scans-${now}.jsonl`,
      content,
      exported: validRows.length,
      skipped: args.scanIds.length - validRows.length,
    };
  }

  const header = ['id', 'status', 'inputType', 'inputRef', 'planAtSubmission', 'createdAt', 'completedAt', 'findingsCount'];
  const lines = [header.join(',')];

  for (const scan of validRows) {
    const row = [
      scan.id,
      scan.status,
      scan.inputType,
      scan.inputRef,
      scan.planAtSubmission,
      scan.createdAt instanceof Date ? scan.createdAt.toISOString() : String(scan.createdAt ?? ''),
      scan.completedAt instanceof Date ? scan.completedAt.toISOString() : (scan.completedAt ? String(scan.completedAt) : ''),
      scan._count?.findings ?? 0,
    ];
    lines.push(row.map(escapeCsv).join(','));
  }

  return {
    format: 'csv',
    filename: `vibescan-scans-${now}.csv`,
    content: lines.join('\n'),
    exported: validRows.length,
    skipped: args.scanIds.length - validRows.length,
  };
}

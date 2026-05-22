import { readFileSync, existsSync } from 'fs';
import type { Prisma, PrismaClient, ScanSource } from '@prisma/client';
import { HttpError } from 'wasp/server';
import { normalizeDastFindings } from '../operations/scans/normalizeFindings.js';
import { persistNormalizedFindingsForScan } from './findingPersistenceService.js';
import { finalizeScanIfReady, handleScannerFailure } from './scanLifecycleService.js';

type DastImportPrismaClient = Pick<PrismaClient, 'scan' | 'scanResult' | 'finding' | 'user' | 'githubInstallation'>;
const DAST_SOURCE = 'dast' as unknown as ScanSource;

export type DastImportRequest = {
  prisma: DastImportPrismaClient;
  scanId: string;
  userId: string;
  inputRef: string;
  loggerLabel?: string;
};

export type DastImportResult = {
  findingsCount: number;
  scanResultId: string | null;
};

async function ensureDastScanStarted(
  prisma: DastImportPrismaClient,
  scanId: string,
  loggerLabel: string,
): Promise<boolean> {
  const scan = await prisma.scan.findUnique({
    where: { id: scanId },
    select: { id: true, status: true },
  });

  if (!scan) {
    console.log(`[${loggerLabel}] Scan ${scanId} not found, skipping`);
    return false;
  }

  if (scan.status === 'done' || scan.status === 'cancelled') {
    console.log(`[${loggerLabel}] Scan ${scanId} is no longer active (status: ${scan.status}), skipping`);
    return false;
  }

  if (scan.status === 'pending') {
    await prisma.scan.update({
      where: { id: scanId },
      data: { status: 'scanning' },
    });
  }

  return true;
}

export async function importDastReportForScan(
  input: DastImportRequest,
): Promise<DastImportResult> {
  const loggerLabel = input.loggerLabel || 'DAST Importer';

  try {
    const started = await ensureDastScanStarted(input.prisma, input.scanId, loggerLabel);
    if (!started) {
      return {
        findingsCount: 0,
        scanResultId: null,
      };
    }

    if (!existsSync(input.inputRef)) {
      throw new HttpError(404, 'DAST report file not found', { detail: `File path: ${input.inputRef}` });
    }

    const fileContent = readFileSync(input.inputRef, 'utf8');
    const rawOutput = JSON.parse(fileContent);
    const findings = normalizeDastFindings(rawOutput);

    const scanResult = await input.prisma.scanResult.upsert({
      where: {
        scanId_source: {
          scanId: input.scanId,
          source: DAST_SOURCE,
        },
      },
      create: {
        scanId: input.scanId,
        source: DAST_SOURCE,
        rawOutput: rawOutput as unknown as Prisma.InputJsonValue,
        vulnerabilities: findings as unknown as Prisma.InputJsonValue,
        scannerVersion: 'dast-import',
        cveDbTimestamp: new Date(),
        durationMs: 0,
      },
      update: {
        rawOutput: rawOutput as unknown as Prisma.InputJsonValue,
        vulnerabilities: findings as unknown as Prisma.InputJsonValue,
        scannerVersion: 'dast-import',
        cveDbTimestamp: new Date(),
        durationMs: 0,
      },
    });

    await persistNormalizedFindingsForScan({
      prisma: input.prisma,
      scanId: input.scanId,
      userId: input.userId,
      source: 'dast',
      findings,
    });

    await finalizeScanIfReady({
      prisma: input.prisma,
      scanId: input.scanId,
      userId: input.userId,
      findingsCount: findings.length,
      loggerLabel,
    });

    return {
      findingsCount: findings.length,
      scanResultId: scanResult.id,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await handleScannerFailure({
      prisma: input.prisma,
      scanId: input.scanId,
      userId: input.userId,
      scannerId: 'dast',
      errorMessage: `${loggerLabel} failed: ${errorMessage}`,
      loggerLabel,
    });

    throw error;
  }
}

import type { Prisma, PrismaClient, ScanSource } from '@prisma/client';
import type { ScannerResultSource } from '../lib/scanners/providerSelection.js';
import type { ScannerFindingForPersistence } from './scannerExecutionTypes.js';
import {
  buildProjectFindingFingerprint,
  persistProjectFindingsForScan,
} from './projectFindingLifecycleService.js';

type FindingPersistencePrismaClient = Pick<PrismaClient, 'finding' | 'scan' | 'projectFinding' | 'project'>;
export type PersistedFindingSource = ScannerResultSource | 'dast';

export type PersistNormalizedFindingsInput = {
  prisma: FindingPersistencePrismaClient;
  scanId: string;
  userId: string;
  source: PersistedFindingSource;
  findings: ScannerFindingForPersistence[];
};

export async function persistNormalizedFindingsForScan(
  input: PersistNormalizedFindingsInput,
): Promise<number> {
  let persistedCount = 0;

  for (const finding of input.findings) {
    const fingerprint = buildProjectFindingFingerprint(finding);

    const existingFinding = await input.prisma.finding.findUnique({
      where: {
        scanId_fingerprint: {
          scanId: input.scanId,
          fingerprint,
        },
      },
      select: {
        source: true,
        detectedData: true,
      },
    });

    const previousReportedBy = existingFinding?.detectedData
      && typeof existingFinding.detectedData === 'object'
      && !Array.isArray(existingFinding.detectedData)
      && Array.isArray((existingFinding.detectedData as Record<string, unknown>).reportedBy)
      ? ((existingFinding.detectedData as Record<string, unknown>).reportedBy as string[])
      : existingFinding?.source
        ? [existingFinding.source]
        : [];

    const reportedBy = Array.from(new Set([...previousReportedBy, input.source])).sort();
    const detectedData = {
      ...finding,
      reportedBy,
    };

    await input.prisma.finding.upsert({
      where: {
        scanId_fingerprint: {
          scanId: input.scanId,
          fingerprint,
        },
      },
      create: {
        scanId: input.scanId,
        userId: input.userId,
        fingerprint,
        cveId: finding.cveId,
        packageName: finding.package,
        installedVersion: finding.version,
        severity: finding.severity.toUpperCase(),
        cvssScore: finding.cvssScore,
        fixedVersion: finding.fixedVersion,
        description: finding.description,
        source: input.source as ScanSource,
        detectedData: detectedData as unknown as Prisma.InputJsonValue,
      },
      update: {
        severity: finding.severity.toUpperCase(),
        cvssScore: finding.cvssScore,
        fixedVersion: finding.fixedVersion,
        description: finding.description,
        detectedData: detectedData as unknown as Prisma.InputJsonValue,
      },
    });

    persistedCount += 1;
  }

  await persistProjectFindingsForScan({
    prisma: input.prisma,
    scanId: input.scanId,
    source: input.source,
    findings: input.findings,
  });

  return persistedCount;
}

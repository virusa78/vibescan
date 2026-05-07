import type { Prisma, PrismaClient } from '@prisma/client';
import type { SeverityLevel } from '../../ingestion/cyclonedx-contracts.js';

export interface DeltaBreakdown {
  totalFreeCount: number;
  totalEnterpriseCount: number;
  deltaCount: number;
  deltaBySeverity: Record<string, number>;
}

const ENTERPRISE_SOURCES = ['snyk', 'codescoring_johnny', 'owasp'];
const FREE_SOURCES = ['grype', 'trivy'];

/**
 * Calculate the delta between free and enterprise scanner results for a single scan.
 * "Delta" findings are those found by enterprise scanners but NOT by free scanners.
 */
export async function calculateScanDelta(
  prisma: Pick<PrismaClient, 'finding' | 'scanDelta'>,
  scanId: string,
): Promise<DeltaBreakdown> {
  const allFindings = await prisma.finding.findMany({
    where: { scanId },
    select: {
      severity: true,
      detectedData: true,
    },
  });

  let totalFreeCount = 0;
  let totalEnterpriseCount = 0;
  let deltaCount = 0;
  const deltaBySeverity: Record<string, number> = {};

  for (const finding of allFindings) {
    const detectedData = finding.detectedData as any;
    const reportedBy: string[] = Array.isArray(detectedData?.reportedBy) ? detectedData.reportedBy : [];

    const foundByFree = reportedBy.some((source) => FREE_SOURCES.includes(source));
    const foundByEnterprise = reportedBy.some((source) => ENTERPRISE_SOURCES.includes(source));

    if (foundByFree) {
      totalFreeCount++;
    }

    if (foundByEnterprise) {
      totalEnterpriseCount++;
      
      // If found by enterprise but NOT by free, it's a delta finding
      if (!foundByFree) {
        deltaCount++;
        const sev = finding.severity.toUpperCase();
        deltaBySeverity[sev] = (deltaBySeverity[sev] || 0) + 1;
      }
    }
  }

  return {
    totalFreeCount,
    totalEnterpriseCount,
    deltaCount,
    deltaBySeverity,
  };
}

/**
 * Update the ScanDelta record with fresh calculations.
 */
export async function updateScanDelta(
  prisma: Pick<PrismaClient, 'finding' | 'scanDelta'>,
  scanId: string,
): Promise<void> {
  const breakdown = await calculateScanDelta(prisma, scanId);

  await prisma.scanDelta.update({
    where: { scanId },
    data: {
      totalFreeCount: breakdown.totalFreeCount,
      totalEnterpriseCount: breakdown.totalEnterpriseCount,
      deltaCount: breakdown.deltaCount,
      deltaBySeverity: breakdown.deltaBySeverity as Prisma.InputJsonValue,
    },
  });
}

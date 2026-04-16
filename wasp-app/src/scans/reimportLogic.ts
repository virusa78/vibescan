import { createHash } from 'crypto';
import type { PrismaClient } from '@prisma/client';
import type { ScanSource } from '@prisma/client';

/**
 * Finding with normalized structure before/after fingerprinting
 */
export interface NormalizedFinding {
  cveId: string;
  packageName: string;
  installedVersion: string;
  filePath?: string;
  severity: string;
  cvssScore?: number;
  fixedVersion?: string;
  description?: string;
  source: ScanSource;
  detectedData?: any;
}

/**
 * Reimport result tracking changes across scans
 */
export interface ReimportResult {
  new: NormalizedFinding[];
  mitigated: Array<{ findingId: string; mitigatedAt: Date; mitigatedInScanId: string }>;
  updated: Array<{
    findingId: string;
    prevSeverity: string;
    newSeverity: string;
    prevFixVersion?: string;
    newFixVersion?: string;
    changedAt: Date;
  }>;
  unchanged: string[];
}

/**
 * Compute deterministic fingerprint for finding deduplication
 * Uses: cve_id + package_name + installed_version + file_path
 * Does NOT include: severity, description, cvss_score (these can change with CVE DB updates)
 */
export function computeFingerprint(finding: NormalizedFinding): string {
  const key = `${finding.cveId}|${finding.packageName}|${finding.installedVersion}|${finding.filePath || ''}`;
  return createHash('sha256').update(key).digest('hex');
}

/**
 * Compare two finding sets and identify changes using fingerprint-based deduplication
 */
export function computeReimportDelta(
  oldFindings: NormalizedFinding[],
  newFindings: NormalizedFinding[],
): ReimportResult {
  const result: ReimportResult = {
    new: [],
    mitigated: [],
    updated: [],
    unchanged: [],
  };

  // Build lookup maps by fingerprint
  const oldByFingerprint = new Map<string, NormalizedFinding>();
  const oldFingerprintIds = new Map<string, string>(); // fingerprint -> finding.id
  
  oldFindings.forEach(f => {
    const fp = computeFingerprint(f);
    oldByFingerprint.set(fp, f);
  });

  // Build new findings lookup
  const newByFingerprint = new Map<string, NormalizedFinding>();
  newFindings.forEach(f => {
    const fp = computeFingerprint(f);
    newByFingerprint.set(fp, f);
  });

  // Process new findings
  newByFingerprint.forEach((newFinding, fingerprint) => {
    if (oldByFingerprint.has(fingerprint)) {
      const oldFinding = oldByFingerprint.get(fingerprint)!;

      // Check if severity or fixed_version changed (CVE DB update)
      if (
        oldFinding.severity !== newFinding.severity ||
        oldFinding.fixedVersion !== newFinding.fixedVersion
      ) {
        result.updated.push({
          findingId: oldFinding.cveId, // placeholder - will be replaced with DB ID later
          prevSeverity: oldFinding.severity,
          newSeverity: newFinding.severity,
          prevFixVersion: oldFinding.fixedVersion,
          newFixVersion: newFinding.fixedVersion,
          changedAt: new Date(),
        });
      } else {
        // Finding unchanged
        result.unchanged.push(fingerprint);
      }
    } else {
      // New finding (first time seen)
      result.new.push(newFinding);
    }
  });

  // Check for mitigated findings (were in old scan, not in new scan)
  oldByFingerprint.forEach((oldFinding, fingerprint) => {
    if (!newByFingerprint.has(fingerprint)) {
      result.mitigated.push({
        findingId: oldFinding.cveId, // placeholder - will be replaced with DB ID later
        mitigatedAt: new Date(),
        mitigatedInScanId: '', // will be set by caller
      });
    }
  });

  return result;
}

/**
 * Simpler version that works with Wasp entities
 * Returns summary of changes (transactions handled by caller in operations.ts)
 */
export function computeReimportSummary(
  reimportResult: ReimportResult,
): { newCount: number; mitigatedCount: number; updatedCount: number; unchangedCount: number } {
  return {
    newCount: reimportResult.new.length,
    mitigatedCount: reimportResult.mitigated.length,
    updatedCount: reimportResult.updated.length,
    unchangedCount: reimportResult.unchanged.length,
  };
}

/**
 * Apply reimport result to database with proper transaction handling
 * Creates new findings, updates severity/fix info, marks mitigated findings
 * 
 * @deprecated Use individual entity operations instead (for Wasp compatibility)
 */
export async function applyReimportResult(
  prisma: PrismaClient,
  reimportResult: ReimportResult,
  scanId: string,
  userId: string,
): Promise<{ newCount: number; mitigatedCount: number; updatedCount: number; unchangedCount: number }> {
  try {
    // Transaction to apply all changes atomically
    await prisma.$transaction(async (tx) => {
      // 1. Insert new findings
      for (const finding of reimportResult.new) {
        const fingerprint = computeFingerprint(finding);
        
        // Check if this fingerprint already exists in this scan (race condition safety)
        const existing = await tx.finding.findFirst({
          where: {
            scanId,
            fingerprint,
          },
        });

        if (!existing) {
          await tx.finding.create({
            data: {
              scanId,
              userId,
              fingerprint,
              cveId: finding.cveId,
              packageName: finding.packageName,
              installedVersion: finding.installedVersion,
              filePath: finding.filePath,
              severity: finding.severity,
              cvssScore: finding.cvssScore ? parseFloat(finding.cvssScore.toString()) : null,
              fixedVersion: finding.fixedVersion,
              description: finding.description,
              source: finding.source,
              detectedData: finding.detectedData,
              status: 'active',
            },
          });
        }
      }

      // 2. Update findings with severity/fix changes
      for (const change of reimportResult.updated) {
        // Find the actual finding in this scan
        const finding = await tx.finding.findFirst({
          where: {
            cveId: change.findingId,
            scanId,
          },
        });

        if (finding) {
          // Update severity and fixed_version
          await tx.finding.update({
            where: { id: finding.id },
            data: {
              severity: change.newSeverity,
              fixedVersion: change.newFixVersion,
              updatedAt: change.changedAt,
            },
          });

          // Log to history
          await tx.findingHistory.create({
            data: {
              findingId: finding.id,
              event: 'severity_changed',
              prevValue: change.prevSeverity,
              newValue: change.newSeverity,
              metadata: {
                prevFixVersion: change.prevFixVersion,
                newFixVersion: change.newFixVersion,
              },
            },
          });
        }
      }

      // 3. Mark mitigated findings
      for (const item of reimportResult.mitigated) {
        const finding = await tx.finding.findFirst({
          where: {
            cveId: item.findingId,
            status: 'active', // Only mitigate active findings
          },
          orderBy: { createdAt: 'desc' },
        });

        if (finding) {
          await tx.finding.update({
            where: { id: finding.id },
            data: {
              status: 'mitigated',
              mitigatedAt: item.mitigatedAt,
              mitigatedInScanId: scanId,
            },
          });

          // Log to history
          await tx.findingHistory.create({
            data: {
              findingId: finding.id,
              event: 'auto_mitigated',
              metadata: {
                mitigatedInScanId: scanId,
              },
            },
          });
        }
      }

      // 4. Update scan_deltas with reimport_summary
      const reimportSummary = {
        new_count: reimportResult.new.length,
        mitigated_count: reimportResult.mitigated.length,
        updated_count: reimportResult.updated.length,
        unchanged_count: reimportResult.unchanged.length,
      };

      // Scan should already have a delta record from scan creation
      // Just update the reimport_summary field
      const existingDelta = await tx.scanDelta.findUnique({
        where: { scanId },
      });

      if (existingDelta) {
        await tx.scanDelta.update({
          where: { scanId },
          data: {
            reimportSummary: reimportSummary as any,
          },
        });
      }
    });

    return computeReimportSummary(reimportResult);
  } catch (error) {
    console.error('Failed to apply reimport result:', error);
    throw error;
  }
}

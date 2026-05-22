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
    detectedData?: unknown;
}
/**
 * Reimport result tracking changes across scans
 */
export interface ReimportResult {
    new: NormalizedFinding[];
    mitigated: Array<{
        findingId: string;
        mitigatedAt: Date;
        mitigatedInScanId: string;
    }>;
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
export declare function computeFingerprint(finding: NormalizedFinding): string;
/**
 * Compare two finding sets and identify changes using fingerprint-based deduplication
 */
export declare function computeReimportDelta(oldFindings: NormalizedFinding[], newFindings: NormalizedFinding[]): ReimportResult;
/**
 * Simpler version that works with Wasp entities
 * Returns summary of changes (transactions handled by caller in operations.ts)
 */
export declare function computeReimportSummary(reimportResult: ReimportResult): {
    newCount: number;
    mitigatedCount: number;
    updatedCount: number;
    unchangedCount: number;
};
/**
 * Apply reimport result to database with proper transaction handling
 * Creates new findings, updates severity/fix info, marks mitigated findings
 *
 * @deprecated Use individual entity operations instead (for Wasp compatibility)
 */
export declare function applyReimportResult(prisma: PrismaClient, reimportResult: ReimportResult, scanId: string, userId: string): Promise<{
    newCount: number;
    mitigatedCount: number;
    updatedCount: number;
    unchangedCount: number;
}>;
//# sourceMappingURL=reimportLogic.d.ts.map
/**
 * Normalize scanner outputs (Grype, Codescoring) to shared Finding schema
 */
export interface NormalizedFinding {
    cveId: string;
    severity: "critical" | "high" | "medium" | "low" | "info";
    package: string;
    version: string;
    fixedVersion?: string;
    description: string;
    cvssScore: number;
    source: "grype" | "codescoring_johnny" | "snyk";
}
/**
 * Normalize Grype JSON output to Finding array
 * Expected Grype format:
 * {
 *   "matches": [
 *     {
 *       "vulnerability": { "id": "CVE-...", "severity": "...", "cvssScore": ... },
 *       "artifact": { "name": "package", "version": "1.0" },
 *       "matchDetails": [{ "found": ... }]
 *     }
 *   ]
 * }
 */
export declare function normalizeGrypeFindings(rawOutput: unknown): NormalizedFinding[];
/**
 * Normalize Codescoring/BlackDuck JSON output to Finding array
 * Expected format:
 * {
 *   "components": [
 *     {
 *       "name": "package",
 *       "version": "1.0",
 *       "vulnerabilities": [
 *         { "cveId": "CVE-...", "severity": "...", "cvssScore": ... }
 *       ]
 *     }
 *   ]
 * }
 */
export declare function normalizeCodescoringFindings(rawOutput: unknown): NormalizedFinding[];
/**
 * Compute fingerprint for deduplication
 * Fingerprint = hash(cveId + package + version + filePath)
 * Used to track the same vulnerability across multiple scans
 */
export declare function computeFindingFingerprint(cveId: string, packageName: string, version: string, filePath?: string): string;
//# sourceMappingURL=normalizeFindings.d.ts.map
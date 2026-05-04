/**
 * Grype Scanner Utility - Executes Grype CLI and parses output
 * Grype is the free vulnerability scanner (Anchore)
 */
import type { NormalizedComponent } from '../../services/inputAdapterService.js';
export interface GrypeFinding {
    cveId: string;
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
    package: string;
    version: string;
    fixedVersion?: string;
    description: string;
    cvssScore: number;
    source: 'grype';
}
export type GrypeRawOutput = {
    matches?: GrypeMatch[];
};
type GrypeMatch = {
    vulnerability?: {
        id?: string;
        severity?: string;
        cvssScore?: {
            baseScore?: string | number;
        };
        description?: string;
        fix?: {
            versions?: string[];
        };
    };
    artifact?: {
        name?: string;
        version?: string;
    };
};
export type GrypeScanRun = {
    rawOutput: GrypeRawOutput;
    findings: GrypeFinding[];
    durationMs: number;
};
/**
 * Execute Grype CLI with timeout
 * @param sbomPath Path to SBOM file
 * @param timeoutMs Timeout in milliseconds (default: 5 minutes)
 * @returns Grype JSON output
 */
export declare function executeGrypeCli(sbomPath: string, timeoutMs?: number): Promise<GrypeRawOutput>;
/**
 * Parse Grype JSON output into normalized findings
 */
export declare function parseGrypOutput(rawOutput: GrypeRawOutput): GrypeFinding[];
/**
 * Main function: Scan components with Grype
 * @param components Normalized components to scan
 * @param scanId Unique scan ID for temporary files
 * @param timeoutMs Timeout in milliseconds
 * @returns Array of vulnerabilities found
 */
export declare function scanWithGrype(components: NormalizedComponent[], scanId: string, timeoutMs?: number): Promise<GrypeFinding[]>;
export declare function scanWithGrypeDetailed(components: NormalizedComponent[], scanId: string, timeoutMs?: number): Promise<GrypeScanRun>;
/**
 * Check if Grype is installed
 */
export declare function isGrypInstalled(): boolean;
export {};
//# sourceMappingURL=grypeScannerUtil.d.ts.map
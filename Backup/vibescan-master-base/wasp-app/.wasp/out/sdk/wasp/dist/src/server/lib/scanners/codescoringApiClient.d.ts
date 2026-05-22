/**
 * Codescoring/Johnny Scanner - Handles enterprise vulnerability scanning via SSH.
 * The Johnny CLI on the remote machine handles the actual scanner logic and API communication.
 * Local configuration only requires SSH host, user, and private key.
 */
import type { NormalizedComponent } from '../../services/inputAdapterService.js';
export interface CodescoringFinding {
    cveId: string;
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
    package: string;
    version: string;
    fixedVersion?: string;
    description: string;
    cvssScore: number;
    source: 'codescoring_johnny';
}
export type CodescoringRawOutput = {
    bomFormat?: string;
    components?: CodescoringComponentRecord[];
    vulnerabilities?: CodescoringVulnerabilityRecord[];
};
export type CodescoringScanRun = {
    rawOutput: CodescoringRawOutput;
    findings: CodescoringFinding[];
    durationMs: number;
    scannerVersion: string;
};
type CodescoringComponentRecord = {
    ['bom-ref']?: string;
    bomRef?: string;
    purl?: string;
    name?: string;
    version?: string;
    vulnerabilities?: Array<{
        cveId?: string;
        severity?: string;
        cvssScore?: number | string;
        description?: string;
        fixedVersion?: string;
    }>;
};
type CodescoringVulnerabilityRecord = {
    id?: string;
    bomRef?: string;
    cveId?: string;
    severity?: string;
    packageName?: string;
    component?: string;
    version?: string;
    fixedVersion?: string;
    description?: string;
    cvssScore?: number | string;
    ratings?: Array<{
        severity?: string;
        score?: string | number;
    }>;
    affects?: Array<{
        ref?: string;
    }>;
    fixes?: Array<{
        version?: string;
    }>;
};
/**
 * Main function: Scan components with Codescoring (SSH mode with Johnny CLI)
 * Falls back to mock if SSH not configured
 * @param components Normalized components to scan
 * @param scanId Unique scan ID
 * @param input Input details (inputType, inputRef)
 * @returns Array of vulnerabilities found
 */
export declare function scanWithCodescoring(components: NormalizedComponent[], scanId: string, input?: {
    inputType: string;
    inputRef: string;
}): Promise<CodescoringFinding[]>;
export declare function scanWithCodescoringDetailed(components: NormalizedComponent[], scanId: string, input?: {
    inputType: string;
    inputRef: string;
}): Promise<CodescoringScanRun>;
/**
 * Check if Codescoring SSH is configured
 */
export declare function isCodescoringConfigured(): boolean;
export {};
//# sourceMappingURL=codescoringApiClient.d.ts.map
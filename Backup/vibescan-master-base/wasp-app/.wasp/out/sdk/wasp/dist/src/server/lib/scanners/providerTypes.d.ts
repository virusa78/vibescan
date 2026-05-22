import type { NormalizedComponent } from '../../services/inputAdapterService.js';
import type { NormalizedFinding } from '../../operations/scans/normalizeFindings.js';
export type ScannerProviderKind = 'grype' | 'codescoring-johnny' | 'snyk';
export type ScannerCredentialSource = {
    mode: 'environment';
} | {
    mode: 'user-secret';
    userId: string;
};
export type ScannerResolvedCredentials = {
    source: 'none' | 'environment' | 'user-secret';
    values: {
        token?: string;
        orgId?: string;
    };
    userId?: string;
};
export type ScannerExecutionContext = {
    scanId: string;
    userId: string;
    inputType: 'source_zip' | 'sbom_upload' | 'github_app';
    inputRef: string;
    credentialSource?: ScannerCredentialSource;
    resolvedCredentials?: ScannerResolvedCredentials;
};
export type ScannerHealthState = {
    configured: boolean;
    healthy: boolean | null;
    message?: string | null;
};
export type ScannerScanResult = {
    provider: ScannerProviderKind;
    rawOutput: unknown;
    findings: NormalizedFinding[];
    durationMs: number;
    scannerVersion?: string;
};
export interface ScannerProvider {
    kind: ScannerProviderKind;
    displayName: string;
    supportsUserSecrets: boolean;
    getHealth(context?: Partial<ScannerExecutionContext>): Promise<ScannerHealthState>;
    scanComponents(components: NormalizedComponent[], context: ScannerExecutionContext): Promise<ScannerScanResult>;
}
//# sourceMappingURL=providerTypes.d.ts.map
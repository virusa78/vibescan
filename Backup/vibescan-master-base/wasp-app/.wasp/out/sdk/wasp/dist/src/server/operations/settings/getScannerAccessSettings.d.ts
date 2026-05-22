import { type ScannerHealthSnapshot } from '../../services/scannerHealthMonitor.js';
export type ScannerAccessResponse = {
    snyk_api_key_attached: boolean;
    snyk_api_key_preview: string | null;
    snyk_enabled: boolean;
    snyk_ready: boolean;
    snyk_ready_reason: string | null;
    snyk_credential_source: 'environment' | 'user-secret' | null;
    scanner_health: Record<'johnny' | 'snyk', ScannerHealthSnapshot>;
};
export declare function getScannerAccessSettings(_args: unknown, context: any): Promise<any>;
//# sourceMappingURL=getScannerAccessSettings.d.ts.map
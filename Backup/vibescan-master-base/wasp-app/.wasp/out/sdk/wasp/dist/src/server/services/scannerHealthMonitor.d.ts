import { type RemoteCommandExecutor } from '../lib/scanners/remoteSsh.js';
type ScannerKind = 'johnny' | 'snyk';
export interface ScannerHealthSnapshot {
    kind: ScannerKind;
    configured: boolean;
    healthy: boolean | null;
    checkedAt: string | null;
    healthyAt: string | null;
    host: string | null;
    probeDirectory: string | null;
    probeCommand: string | null;
    error: string | null;
}
export declare function getScannerHealthSnapshot(): Record<ScannerKind, ScannerHealthSnapshot>;
export declare function refreshScannerHealth(executor?: RemoteCommandExecutor): Promise<Record<ScannerKind, ScannerHealthSnapshot>>;
export declare function startScannerHealthMonitor(): void;
export declare function stopScannerHealthMonitor(): void;
export {};
//# sourceMappingURL=scannerHealthMonitor.d.ts.map
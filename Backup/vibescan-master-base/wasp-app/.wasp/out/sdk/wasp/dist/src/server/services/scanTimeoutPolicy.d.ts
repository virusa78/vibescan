declare const DEFAULT_SCAN_TIMEOUT_MS: number;
declare const DEFAULT_SWEEP_INTERVAL_MS: number;
export declare function parsePositiveInteger(value: string | undefined, fallback: number): number;
export declare function getScanTimeoutMs(envValue?: string | undefined): number;
export declare function getScanSweepIntervalMs(envValue?: string | undefined): number;
export declare function isScanExpired(createdAt: Date, now?: Date, timeoutMs?: number): boolean;
export { DEFAULT_SCAN_TIMEOUT_MS, DEFAULT_SWEEP_INTERVAL_MS };
//# sourceMappingURL=scanTimeoutPolicy.d.ts.map
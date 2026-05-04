const DEFAULT_SCAN_TIMEOUT_MS = 24 * 60 * 60 * 1000;
const DEFAULT_SWEEP_INTERVAL_MS = 5 * 60 * 1000;
export function parsePositiveInteger(value, fallback) {
    const parsed = Number.parseInt(value ?? '', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
export function getScanTimeoutMs(envValue = process.env.SCAN_TIMEOUT_MS) {
    return parsePositiveInteger(envValue, DEFAULT_SCAN_TIMEOUT_MS);
}
export function getScanSweepIntervalMs(envValue = process.env.SCAN_TIMEOUT_SWEEP_INTERVAL_MS) {
    return parsePositiveInteger(envValue, DEFAULT_SWEEP_INTERVAL_MS);
}
export function isScanExpired(createdAt, now = new Date(), timeoutMs = getScanTimeoutMs()) {
    return now.getTime() - createdAt.getTime() >= timeoutMs;
}
export { DEFAULT_SCAN_TIMEOUT_MS, DEFAULT_SWEEP_INTERVAL_MS };
//# sourceMappingURL=scanTimeoutPolicy.js.map
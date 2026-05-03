const DEFAULT_SCAN_TIMEOUT_MS = 24 * 60 * 60 * 1000;
const DEFAULT_SWEEP_INTERVAL_MS = 5 * 60 * 1000;

export function parsePositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getScanTimeoutMs(envValue: string | undefined = process.env.SCAN_TIMEOUT_MS): number {
  return parsePositiveInteger(envValue, DEFAULT_SCAN_TIMEOUT_MS);
}

export function getScanSweepIntervalMs(
  envValue: string | undefined = process.env.SCAN_TIMEOUT_SWEEP_INTERVAL_MS,
): number {
  return parsePositiveInteger(envValue, DEFAULT_SWEEP_INTERVAL_MS);
}

export function isScanExpired(
  createdAt: Date,
  now: Date = new Date(),
  timeoutMs: number = getScanTimeoutMs(),
): boolean {
  return now.getTime() - createdAt.getTime() >= timeoutMs;
}

export { DEFAULT_SCAN_TIMEOUT_MS, DEFAULT_SWEEP_INTERVAL_MS };

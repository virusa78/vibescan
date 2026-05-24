export type ScannerLineupStatus = 'planned' | 'completed' | 'failed' | 'missing';

export type ScanResultLike = {
  vulnerabilities?: unknown;
  rawOutput?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isFailedScannerResult(rawOutput: unknown): boolean {
  if (!isRecord(rawOutput)) {
    return false;
  }

  return rawOutput.failed === true || rawOutput.unconfigured === true;
}

export function getScannerLineupStatus(result?: ScanResultLike | null): ScannerLineupStatus {
  if (!result) {
    return 'missing';
  }

  return isFailedScannerResult(result.rawOutput) ? 'failed' : 'completed';
}

export function getScannerResultSummary(result?: ScanResultLike | null): string {
  if (!result) {
    return 'Not run';
  }

  if (isFailedScannerResult(result.rawOutput)) {
    return 'Failed';
  }

  const findingsCount = Array.isArray(result.vulnerabilities) ? result.vulnerabilities.length : 0;
  return findingsCount === 0 ? '0 findings' : `${findingsCount} findings`;
}

export function getScannerResultDetail(result?: ScanResultLike | null): string | null {
  if (!result || !isFailedScannerResult(result.rawOutput) || !isRecord(result.rawOutput)) {
    return null;
  }

  const error = result.rawOutput.error;
  return typeof error === 'string' && error.trim().length > 0 ? error : null;
}

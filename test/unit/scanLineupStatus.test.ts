import { describe, expect, it } from '@jest/globals';
import {
  getScannerLineupStatus,
  getScannerResultSummary,
  isFailedScannerResult,
} from '../../wasp-app/src/dashboard/scanLineupStatus';

describe('scanLineupStatus', () => {
  it('treats missing results as not run', () => {
    expect(getScannerLineupStatus(undefined)).toBe('missing');
    expect(getScannerResultSummary(undefined)).toBe('Not run');
  });

  it('treats a successful empty result as zero findings', () => {
    const result = {
      vulnerabilities: [],
      rawOutput: {
        provider: 'grype',
      },
    };

    expect(isFailedScannerResult(result.rawOutput)).toBe(false);
    expect(getScannerLineupStatus(result)).toBe('completed');
    expect(getScannerResultSummary(result)).toBe('0 findings');
  });

  it('treats populated successful results as completed', () => {
    const result = {
      vulnerabilities: [{ id: 'one' }, { id: 'two' }],
      rawOutput: {
        provider: 'codescoring_johnny',
      },
    };

    expect(getScannerLineupStatus(result)).toBe('completed');
    expect(getScannerResultSummary(result)).toBe('2 findings');
  });

  it('treats failed or unconfigured results as failed', () => {
    const failedResult = {
      vulnerabilities: [],
      rawOutput: {
        failed: true,
        error: 'scanner crashed',
      },
    };

    const unconfiguredResult = {
      vulnerabilities: [],
      rawOutput: {
        unconfigured: true,
      },
    };

    expect(getScannerLineupStatus(failedResult)).toBe('failed');
    expect(getScannerResultSummary(failedResult)).toBe('Failed');
    expect(getScannerLineupStatus(unconfiguredResult)).toBe('failed');
    expect(getScannerResultSummary(unconfiguredResult)).toBe('Failed');
  });
});

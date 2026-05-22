import { describe, expect, it } from '@jest/globals';
import {
  getPlannedScannerSources,
  getScannerLineupEntry,
} from '../../wasp-app/src/client/utils/scannerLineup';

describe('scannerLineup', () => {
  it('returns the four base scanners when snyk is unavailable', () => {
    expect(getPlannedScannerSources(null)).toEqual([
      'grype',
      'trivy',
      'codescoring_johnny',
      'owasp',
    ]);
  });

  it('adds snyk when the key is ready', () => {
    expect(getPlannedScannerSources({
      snyk_enabled: true,
      snyk_ready: true,
      snyk_credential_source: 'user-secret',
    })).toEqual([
      'grype',
      'trivy',
      'codescoring_johnny',
      'owasp',
      'snyk',
    ]);
  });

  it('maps scanner names to readable labels', () => {
    expect(getScannerLineupEntry('codescoring_johnny').label).toBe('Johnny');
    expect(getScannerLineupEntry('snyk').label).toBe('Snyk');
  });
});


import { afterEach, describe, expect, it } from '@jest/globals';
import { getScannerMonthlyLimit, getScannerMonthlyPolicy } from '../../wasp-app/src/server/config/scannerPolicy';

const trackedEnv = {
  VIBESCAN_SCANNER_MONTHLY_LIMITS_JSON: process.env.VIBESCAN_SCANNER_MONTHLY_LIMITS_JSON,
};

describe('scannerPolicy', () => {
  afterEach(() => {
    process.env.VIBESCAN_SCANNER_MONTHLY_LIMITS_JSON = trackedEnv.VIBESCAN_SCANNER_MONTHLY_LIMITS_JSON;
  });

  it('keeps starter codescoring limited by default', () => {
    const policy = getScannerMonthlyPolicy();
    expect(policy.starter['codescoring-johnny']).toBe(1);
    expect(getScannerMonthlyLimit('starter', 'snyk')).toBe(Infinity);
  });

  it('supports backend override JSON for provider limits', () => {
    process.env.VIBESCAN_SCANNER_MONTHLY_LIMITS_JSON = JSON.stringify({
      pro: {
        'codescoring-johnny': 7,
        snyk: 3,
      },
    });

    expect(getScannerMonthlyLimit('pro', 'codescoring-johnny')).toBe(7);
    expect(getScannerMonthlyLimit('pro', 'snyk')).toBe(3);
    expect(getScannerMonthlyLimit('enterprise', 'snyk')).toBe(Infinity);
  });
});

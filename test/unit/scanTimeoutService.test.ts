import { afterEach, describe, expect, it } from '@jest/globals';
import {
  getScanTimeoutMs,
  isScanExpired,
} from '../../wasp-app/src/server/services/scanTimeoutPolicy';

describe('scanTimeoutService', () => {
  const originalTimeout = process.env.SCAN_TIMEOUT_MS;

  afterEach(() => {
    if (originalTimeout === undefined) {
      delete process.env.SCAN_TIMEOUT_MS;
    } else {
      process.env.SCAN_TIMEOUT_MS = originalTimeout;
    }
  });

  it('uses the configured timeout when it is valid', () => {
    process.env.SCAN_TIMEOUT_MS = '1800000';

    expect(getScanTimeoutMs()).toBe(1800000);
  });

  it('falls back to the default timeout for invalid values', () => {
    process.env.SCAN_TIMEOUT_MS = 'not-a-number';

    expect(getScanTimeoutMs()).toBe(24 * 60 * 60 * 1000);
  });

  it('treats scans older than the timeout as expired', () => {
    const now = new Date('2026-04-20T12:00:00.000Z');
    const createdAt = new Date('2026-04-19T11:59:59.000Z');

    expect(isScanExpired(createdAt, now, 24 * 60 * 60 * 1000)).toBe(true);
  });

  it('treats scans newer than the timeout as active', () => {
    const now = new Date('2026-04-20T12:00:00.000Z');
    const createdAt = new Date('2026-04-20T11:30:00.000Z');

    expect(isScanExpired(createdAt, now, 24 * 60 * 60 * 1000)).toBe(false);
  });
});

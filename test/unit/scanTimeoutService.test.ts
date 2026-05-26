import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  getScanTimeoutMs,
  isScanExpired,
  getScanSweepIntervalMs,
} from '../../wasp-app/src/server/services/scanTimeoutPolicy';

const mockCancelScan = jest.fn() as any;
const mockRefundQuota = jest.fn() as any;

const mockPrisma = {
  scan: {
    findMany: jest.fn() as any,
  },
};

jest.mock('wasp/server', () => ({
  prisma: mockPrisma,
}));

jest.mock('../../wasp-app/src/server/operations/scans/orchestrator.js', () => ({
  cancelScan: (...args: any[]) => mockCancelScan(...args),
}));

jest.mock('../../wasp-app/src/server/services/quotaService.js', () => ({
  quotaService: {
    refundQuota: (...args: any[]) => mockRefundQuota(...args),
  },
}));

describe('scanTimeoutPolicy', () => {
  const originalTimeout = process.env.SCAN_TIMEOUT_MS;
  const originalSweep = process.env.SCAN_TIMEOUT_SWEEP_INTERVAL_MS;

  afterEach(() => {
    if (originalTimeout === undefined) {
      delete process.env.SCAN_TIMEOUT_MS;
    } else {
      process.env.SCAN_TIMEOUT_MS = originalTimeout;
    }
    if (originalSweep === undefined) {
      delete process.env.SCAN_TIMEOUT_SWEEP_INTERVAL_MS;
    } else {
      process.env.SCAN_TIMEOUT_SWEEP_INTERVAL_MS = originalSweep;
    }
  });

  it('uses the configured timeout when it is valid', () => {
    process.env.SCAN_TIMEOUT_MS = '1800000';
    expect(getScanTimeoutMs()).toBe(1800000);
  });

  it('falls back to the default timeout for invalid or non-positive values', () => {
    process.env.SCAN_TIMEOUT_MS = 'not-a-number';
    expect(getScanTimeoutMs()).toBe(24 * 60 * 60 * 1000);

    process.env.SCAN_TIMEOUT_MS = '-500';
    expect(getScanTimeoutMs()).toBe(24 * 60 * 60 * 1000);

    process.env.SCAN_TIMEOUT_MS = '0';
    expect(getScanTimeoutMs()).toBe(24 * 60 * 60 * 1000);
  });

  it('uses the configured sweep interval when it is valid', () => {
    process.env.SCAN_TIMEOUT_SWEEP_INTERVAL_MS = '60000';
    expect(getScanSweepIntervalMs()).toBe(60000);
  });

  it('falls back to default sweep interval for invalid/negative values', () => {
    process.env.SCAN_TIMEOUT_SWEEP_INTERVAL_MS = 'not-a-number';
    expect(getScanSweepIntervalMs()).toBe(5 * 60 * 1000);

    process.env.SCAN_TIMEOUT_SWEEP_INTERVAL_MS = '-10';
    expect(getScanSweepIntervalMs()).toBe(5 * 60 * 1000);
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

  it('uses default values for now and timeoutMs if omitted in isScanExpired', () => {
    // default timeout is 24 hours (86400000 ms)
    const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000);
    const recentDate = new Date(Date.now() - 10 * 60 * 1000);

    expect(isScanExpired(oldDate)).toBe(true);
    expect(isScanExpired(recentDate)).toBe(false);
  });
});

describe('scanTimeoutService', () => {
  let consoleErrorSpy: any;
  let consoleLogSpy: any;

  beforeEach(() => {
    mockCancelScan.mockReset();
    mockRefundQuota.mockReset();
    mockPrisma.scan.findMany.mockReset();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(async () => {
    const { stopScanTimeoutSweeper } = await import('../../wasp-app/src/server/services/scanTimeoutService');
    await stopScanTimeoutSweeper();
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
    jest.useRealTimers();
  });

  it('sweeps expired scans and refunds quota on successful cancellation', async () => {
    const staleScan = { id: 'scan-123', userId: 'user-77', createdAt: new Date() };
    mockPrisma.scan.findMany.mockResolvedValueOnce([staleScan]);
    mockCancelScan.mockResolvedValueOnce(true);

    const { sweepExpiredScans } = await import('../../wasp-app/src/server/services/scanTimeoutService');
    const count = await sweepExpiredScans(new Date());

    expect(count).toBe(1);
    expect(mockCancelScan).toHaveBeenCalledWith('scan-123', expect.stringContaining('Scan timed out'));
    expect(mockRefundQuota).toHaveBeenCalledWith('user-77', 'scan-123', 'scan_timeout');
  });

  it('skips incrementing count and refunding quota if cancellation fails', async () => {
    const staleScan = { id: 'scan-123', userId: 'user-77', createdAt: new Date() };
    mockPrisma.scan.findMany.mockResolvedValueOnce([staleScan]);
    mockCancelScan.mockResolvedValueOnce(false);

    const { sweepExpiredScans } = await import('../../wasp-app/src/server/services/scanTimeoutService');
    const count = await sweepExpiredScans(new Date());

    expect(count).toBe(0);
    expect(mockRefundQuota).not.toHaveBeenCalled();
  });

  it('returns 0 immediately if another sweep is already running', async () => {
    const { sweepExpiredScans } = await import('../../wasp-app/src/server/services/scanTimeoutService');
    
    // We mock findMany to stay unresolved until we say so
    let resolveFindMany: any;
    const findManyPromise = new Promise((resolve) => {
      resolveFindMany = resolve;
    });
    mockPrisma.scan.findMany.mockReturnValueOnce(findManyPromise);

    const firstSweepPromise = sweepExpiredScans(new Date());
    
    // While first is running, start second
    const secondSweepResult = await sweepExpiredScans(new Date());
    expect(secondSweepResult).toBe(0);

    // Clean up
    resolveFindMany([]);
    await firstSweepPromise;
  });

  it('starts and stops the timeout sweeper, and ignores duplicate calls', async () => {
    const { startScanTimeoutSweeper, stopScanTimeoutSweeper } = await import('../../wasp-app/src/server/services/scanTimeoutService');
    mockPrisma.scan.findMany.mockResolvedValue([]);
    
    startScanTimeoutSweeper();
    // Call again to hit early return branch
    startScanTimeoutSweeper();

    await stopScanTimeoutSweeper();
    // Stop again when null to hit early return branch
    await stopScanTimeoutSweeper();
  });

  it('handles and logs sweep errors during initial sweep', async () => {
    const { startScanTimeoutSweeper, stopScanTimeoutSweeper } = await import('../../wasp-app/src/server/services/scanTimeoutService');
    
    mockPrisma.scan.findMany.mockRejectedValueOnce(new Error('Db connection error'));

    startScanTimeoutSweeper();
    
    // Wait for the async initial sweep catch handler to execute
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(consoleErrorSpy).toHaveBeenCalledWith('[ScanTimeout] Initial sweep failed:', expect.any(Error));

    await stopScanTimeoutSweeper();
  });

  it('handles and logs sweep errors during periodic interval sweeps', async () => {
    const setIntervalSpy = jest.spyOn(global, 'setInterval');
    const { startScanTimeoutSweeper, stopScanTimeoutSweeper } = await import('../../wasp-app/src/server/services/scanTimeoutService');
    
    mockPrisma.scan.findMany.mockResolvedValue([]); // initial sweep succeeds
    startScanTimeoutSweeper();

    // Wait for initial sweep to finish so sweepRunning resets to false
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(setIntervalSpy).toHaveBeenCalled();
    const sweepCallback = setIntervalSpy.mock.calls[0][0] as () => Promise<void>;

    // Next sweep will fail
    mockPrisma.scan.findMany.mockRejectedValueOnce(new Error('Interval sweep db error'));

    // Manually trigger the callback
    await sweepCallback();

    // Wait for the async catch handler to execute
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(consoleErrorSpy).toHaveBeenCalledWith('[ScanTimeout] Sweep failed:', expect.any(Error));

    await stopScanTimeoutSweeper();
    setIntervalSpy.mockRestore();
  });
});

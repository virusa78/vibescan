import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  refreshScannerHealth,
  getScannerHealthSnapshot,
  startScannerHealthMonitor,
  stopScannerHealthMonitor,
} from '../../wasp-app/src/server/services/scannerHealthMonitor';

describe('scannerHealthMonitor', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(global, 'setInterval');
    jest.spyOn(global, 'clearInterval');
    
    // Clear variables to check fallbacks
    delete process.env.CODESCORING_SSH_HOST;
    delete process.env.CODESCORING_SSH_USER;
    delete process.env.CODESCORING_SSH_PORT;
    delete process.env.CODESCORING_SSH_IDENTITY_FILE;
    delete process.env.CODESCORING_JOHNNY_HEALTH_DIR;
    delete process.env.CODESCORING_JOHNNY_HEALTH_COMMAND;
    delete process.env.SNYK_SSH_HOST;
    delete process.env.SNYK_SSH_USER;
    delete process.env.SNYK_SSH_PORT;
    delete process.env.SNYK_SSH_IDENTITY_FILE;
    delete process.env.SNYK_HEALTH_DIR;
    delete process.env.SNYK_HEALTH_COMMAND;
    delete process.env.SCANNER_HEALTH_INTERVAL_MS;
    delete process.env.SCANNER_HEALTH_TIMEOUT_MS;
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    stopScannerHealthMonitor();
    process.env = { ...originalEnv };
  });

  it('marks johnny healthy when the remote probe succeeds and leaves snyk unconfigured', async () => {
    process.env.CODESCORING_SSH_HOST = 'johnny.codescoring.internal';
    process.env.CODESCORING_SSH_USER = 'scanner';
    process.env.CODESCORING_SSH_PORT = '22';
    process.env.CODESCORING_JOHNNY_HEALTH_DIR = '/opt/johnny';
    process.env.CODESCORING_JOHNNY_HEALTH_COMMAND = 'ls -la /opt/johnny && timeout 10s /opt/johnny/johnny';

    const executor = jest.fn(() => ({
      status: 0,
      stdout: 'ok',
      stderr: '',
      error: null,
    }));

    const snapshot = await refreshScannerHealth(executor);

    expect(executor).toHaveBeenCalledTimes(1);
    expect(snapshot.johnny.healthy).toBe(true);
    expect(snapshot.johnny.configured).toBe(true);
    expect(snapshot.johnny.probeCommand).toContain('/opt/johnny/johnny');
    expect(snapshot.snyk.configured).toBe(false);
    expect(getScannerHealthSnapshot().johnny.healthy).toBe(true);
  });

  it('captures probe failures as unhealthy status', async () => {
    process.env.CODESCORING_SSH_HOST = 'johnny.codescoring.internal';
    
    const executor = jest.fn(() => ({
      status: 2,
      stdout: '',
      stderr: 'missing binary',
      error: null,
    }));

    const snapshot = await refreshScannerHealth(executor);

    expect(snapshot.johnny.healthy).toBe(false);
    expect(snapshot.johnny.error).toContain('missing binary');
  });

  it('handles remote command execution error object', async () => {
    process.env.CODESCORING_SSH_HOST = 'johnny.codescoring.internal';
    
    const executor = jest.fn(() => ({
      status: null,
      stdout: '',
      stderr: '',
      error: new Error('SSH connection timeout'),
    }));

    const snapshot = await refreshScannerHealth(executor);

    expect(snapshot.johnny.healthy).toBe(false);
    expect(snapshot.johnny.error).toBe('SSH connection timeout');
  });

  it('handles default probe commands and fallback dirs when not explicitly set', async () => {
    process.env.CODESCORING_SSH_HOST = 'johnny.codescoring.internal';
    process.env.CODESCORING_SSH_USER = 'user';
    process.env.CODESCORING_SSH_PORT = 'invalid-port'; // check port parsing fallback
    process.env.CODESCORING_SSH_REMOTE_TMP_DIR = '/tmp/remote'; // check dir fallback

    process.env.SNYK_SSH_HOST = 'snyk.internal';

    const executor = jest.fn(() => ({
      status: 0,
      stdout: 'ok',
      stderr: '',
      error: null,
    }));

    const snapshot = await refreshScannerHealth(executor);

    // Verify CODESCORING Johnny config fallback
    expect(snapshot.johnny.probeDirectory).toBe('/tmp/remote');
    expect(snapshot.johnny.probeCommand).toContain('timeout 10s');
    expect(snapshot.johnny.probeCommand).toContain('johnny');

    // Verify SNYK config fallback
    expect(snapshot.snyk.configured).toBe(true);
    expect(snapshot.snyk.probeDirectory).toBe('/opt/snyk');
    expect(snapshot.snyk.probeCommand).toContain('snyk');
  });

  it('uses default fallback directory /tmp for johnny if no env is set', async () => {
    process.env.CODESCORING_SSH_HOST = 'johnny.internal';
    const executor = jest.fn(() => ({ status: 0, stdout: '', stderr: '', error: null }));
    const snapshot = await refreshScannerHealth(executor);
    expect(snapshot.johnny.probeDirectory).toBe('/tmp');
  });

  it('applies custom scan intervals and timeouts', async () => {
    process.env.CODESCORING_SSH_HOST = 'johnny.internal';
    process.env.SCANNER_HEALTH_INTERVAL_MS = '10000';
    process.env.SCANNER_HEALTH_TIMEOUT_MS = '2000';


    startScannerHealthMonitor();

    // Verify interval registration
    expect(global.setInterval).toHaveBeenCalledWith(expect.any(Function), 10000);
  });

  it('falls back to default interval and timeout if invalid values are passed', async () => {
    process.env.CODESCORING_SSH_HOST = 'johnny.internal';
    process.env.SCANNER_HEALTH_INTERVAL_MS = 'not-a-number';
    process.env.SCANNER_HEALTH_TIMEOUT_MS = '-50';


    startScannerHealthMonitor();
    
    // Default: 5 * 60 * 1000 = 300000 ms
    expect(global.setInterval).toHaveBeenCalledWith(expect.any(Function), 300000);
  });

  it('returns current health state early if a health refresh is already running', async () => {
    process.env.CODESCORING_SSH_HOST = 'johnny.internal';
    
    // Start health refresh, then trigger a second one concurrently
    const executor = jest.fn(() => ({ status: 0, stdout: '', stderr: '', error: null }));

    const promise1 = refreshScannerHealth(executor);
    const promise2 = refreshScannerHealth(executor);

    await Promise.all([promise1, promise2]);

    // Executor should only run once because the second refresh returned early
    expect(executor).toHaveBeenCalledTimes(1);
  });

  it('handles start and stop monitor states gracefully', () => {
    // Start once
    startScannerHealthMonitor();
    const firstTimer = (global.setInterval as any).mock.results[0].value;

    // Start again (should be a no-op if already running)
    startScannerHealthMonitor();
    expect(global.setInterval).toHaveBeenCalledTimes(1);

    // Stop monitor
    stopScannerHealthMonitor();
    expect(global.clearInterval).toHaveBeenCalledWith(firstTimer);

    // Stop again (no-op)
    stopScannerHealthMonitor();
    expect(global.clearInterval).toHaveBeenCalledTimes(1);
  });
});


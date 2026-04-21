import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { refreshScannerHealth, getScannerHealthSnapshot } from '../../wasp-app/src/server/services/scannerHealthMonitor';

describe('scannerHealthMonitor', () => {
  const originalEnv = {
    CODESCORING_SSH_HOST: process.env.CODESCORING_SSH_HOST,
    CODESCORING_SSH_USER: process.env.CODESCORING_SSH_USER,
    CODESCORING_SSH_PORT: process.env.CODESCORING_SSH_PORT,
    CODESCORING_SSH_IDENTITY_FILE: process.env.CODESCORING_SSH_IDENTITY_FILE,
    CODESCORING_JOHNNY_HEALTH_DIR: process.env.CODESCORING_JOHNNY_HEALTH_DIR,
    CODESCORING_JOHNNY_HEALTH_COMMAND: process.env.CODESCORING_JOHNNY_HEALTH_COMMAND,
    SNYK_SSH_HOST: process.env.SNYK_SSH_HOST,
  };

  beforeEach(() => {
    process.env.CODESCORING_SSH_HOST = 'johnny.codescoring.internal';
    process.env.CODESCORING_SSH_USER = 'scanner';
    process.env.CODESCORING_SSH_PORT = '22';
    process.env.CODESCORING_JOHNNY_HEALTH_DIR = '/opt/johnny';
    process.env.CODESCORING_JOHNNY_HEALTH_COMMAND = 'ls -la /opt/johnny && timeout 10s /opt/johnny/johnny';
    delete process.env.SNYK_SSH_HOST;
  });

  afterEach(() => {
    process.env.CODESCORING_SSH_HOST = originalEnv.CODESCORING_SSH_HOST;
    process.env.CODESCORING_SSH_USER = originalEnv.CODESCORING_SSH_USER;
    process.env.CODESCORING_SSH_PORT = originalEnv.CODESCORING_SSH_PORT;
    process.env.CODESCORING_SSH_IDENTITY_FILE = originalEnv.CODESCORING_SSH_IDENTITY_FILE;
    process.env.CODESCORING_JOHNNY_HEALTH_DIR = originalEnv.CODESCORING_JOHNNY_HEALTH_DIR;
    process.env.CODESCORING_JOHNNY_HEALTH_COMMAND = originalEnv.CODESCORING_JOHNNY_HEALTH_COMMAND;
    process.env.SNYK_SSH_HOST = originalEnv.SNYK_SSH_HOST;
  });

  it('marks johnny healthy when the remote probe succeeds and leaves snyk unconfigured', async () => {
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
});

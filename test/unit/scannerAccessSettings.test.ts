import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { prisma } from '../mocks/wasp-server';
import * as secretEncryption from '../../wasp-app/src/server/utils/secretEncryption';
const getScannerHealthSnapshotMock = jest.fn();
const getSnykScannerReadinessMock = jest.fn();

jest.mock('../../wasp-app/src/server/services/scannerHealthMonitor', () => ({
  getScannerHealthSnapshot: getScannerHealthSnapshotMock,
}));

jest.mock('../../wasp-app/src/server/services/scannerReadinessService', () => ({
  getSnykScannerReadiness: getSnykScannerReadinessMock,
}));

import { getScannerAccessSettings, updateScannerAccessSettings } from '../../wasp-app/src/server/operations/settings';

const prismaMock = prisma as any;

describe('scanner access settings operations', () => {
  const originalEncryptionKey = process.env.ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = Buffer.alloc(32, 'scanner-access-test-key').toString('hex').slice(0, 64);
    prismaMock.user.findUnique.mockReset();
    prismaMock.user.update.mockReset();
    prismaMock.scannerUsageLedger.count.mockReset();
    getSnykScannerReadinessMock.mockReset();
    (getSnykScannerReadinessMock as any).mockResolvedValue({
      enabled: false,
      ready: false,
      credentialMode: 'auto',
      credentialSource: null,
      reason: 'Snyk requires key',
      hasEnvironmentToken: false,
      hasUserSecret: false,
    });
    getScannerHealthSnapshotMock.mockReturnValue({
      johnny: {
        kind: 'johnny',
        configured: true,
        healthy: true,
        checkedAt: '2026-05-24T00:00:00.000Z',
        healthyAt: '2026-05-24T00:00:00.000Z',
        host: 'codescoring.local',
        probeDirectory: '/tmp',
        probeCommand: 'test',
        error: null,
      },
      snyk: {
        kind: 'snyk',
        configured: true,
        healthy: true,
        checkedAt: '2026-05-24T00:00:00.000Z',
        healthyAt: '2026-05-24T00:00:00.000Z',
        host: 'snyk.local',
        probeDirectory: '/opt/snyk',
        probeCommand: 'test',
        error: null,
      },
    });
  });

  it('returns attachment state and preview for stored snyk key', async () => {
    const encrypted = secretEncryption.encryptSecret('snyk-token-1234567890');
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: 'user-1',
      plan: 'pro',
      snykApiKeyEncrypted: encrypted,
    });
    prismaMock.scannerUsageLedger.count.mockResolvedValueOnce(0);

    const result = await getScannerAccessSettings({}, { user: { id: 'user-1' } });

    expect(result.snyk_api_key_attached).toBe(true);
    expect(result.snyk_api_key_preview).toBe('snyk...7890');
    expect(result.scanner_health.johnny.kind).toBe('johnny');
    expect(result.scanner_choices.find((choice: any) => choice.source === 'codescoring_johnny')?.selectable).toBe(true);
  });

  it('disables Johnny when the monthly limit is exhausted', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: 'user-1',
      plan: 'free_trial',
      snykApiKeyEncrypted: null,
    });
    prismaMock.scannerUsageLedger.count.mockResolvedValueOnce(1);

    const result = await getScannerAccessSettings({}, { user: { id: 'user-1' } });
    const johnnyChoice = result.scanner_choices.find((choice: any) => choice.source === 'codescoring_johnny');

    expect(johnnyChoice?.selectable).toBe(false);
    expect(johnnyChoice?.status).toBe('cooling_down');
    expect(johnnyChoice?.disabled_reason).toContain('cooling down');
  });

  it('stores a new snyk key and returns updated attachment state', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: 'user-1',
      plan: 'pro',
      snykApiKeyEncrypted: null,
    });
    prismaMock.user.update.mockResolvedValueOnce({});
    prismaMock.scannerUsageLedger.count.mockResolvedValueOnce(0);

    const result = await updateScannerAccessSettings(
      {
        snyk_api_key: '  snyk-token-abcdef123456  ',
      },
      { user: { id: 'user-1' } },
    );

    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-1' },
        data: {
          snykApiKeyEncrypted: expect.any(String),
        },
      }),
    );

    expect(result.snyk_api_key_attached).toBe(true);
    expect(result.snyk_api_key_preview).toBe('snyk...3456');
  });

  it('clears a snyk key when the field is blank', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: 'user-1',
      plan: 'pro',
      snykApiKeyEncrypted: secretEncryption.encryptSecret('snyk-token-abcdef123456'),
    });
    prismaMock.user.update.mockResolvedValueOnce({});
    prismaMock.scannerUsageLedger.count.mockResolvedValueOnce(0);

    const result = await updateScannerAccessSettings(
      {
        snyk_api_key: '   ',
      },
      { user: { id: 'user-1' } },
    );

    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          snykApiKeyEncrypted: null,
        },
      }),
    );

    expect(result.snyk_api_key_attached).toBe(false);
    expect(result.snyk_api_key_preview).toBeNull();
  });

  it('throws 401 on get when user is not authenticated', async () => {
    await expect(getScannerAccessSettings({}, {})).rejects.toMatchObject({
      statusCode: 401,
      message: 'User not authenticated',
    });
  });

  it('throws 401 on update when user is not authenticated', async () => {
    await expect(updateScannerAccessSettings({}, {})).rejects.toMatchObject({
      statusCode: 401,
      message: 'User not authenticated',
    });
  });

  it('throws 404 on get when user is not found', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(null);

    await expect(
      getScannerAccessSettings({}, { user: { id: 'user-1' } })
    ).rejects.toMatchObject({
      statusCode: 404,
      message: 'User not found',
    });
  });

  it('throws 404 on update when user is not found', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(null);

    await expect(
      updateScannerAccessSettings({}, { user: { id: 'user-1' } })
    ).rejects.toMatchObject({
      statusCode: 404,
      message: 'User not found',
    });
  });

  it('returns exact short secret preview if key length <= 8', async () => {
    const encrypted = secretEncryption.encryptSecret('snyk-1');
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: 'user-1',
      plan: 'pro',
      snykApiKeyEncrypted: encrypted,
    });
    prismaMock.scannerUsageLedger.count.mockResolvedValueOnce(0);

    const result = await getScannerAccessSettings({}, { user: { id: 'user-1' } });

    expect(result.snyk_api_key_preview).toBe('snyk-1');
  });

  it('returns null preview if decryption fails due to invalid cipher', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: 'user-1',
      plan: 'pro',
      snykApiKeyEncrypted: 'invalid-encrypted-ciphertext',
    });
    prismaMock.scannerUsageLedger.count.mockResolvedValueOnce(0);

    const result = await getScannerAccessSettings({}, { user: { id: 'user-1' } });

    expect(result.snyk_api_key_preview).toBeNull();
  });

  it('disables Johnny and marks status unavailable if Johnny is unconfigured', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: 'user-1',
      plan: 'pro',
      snykApiKeyEncrypted: null,
    });
    prismaMock.scannerUsageLedger.count.mockResolvedValueOnce(0);
    getScannerHealthSnapshotMock.mockReturnValue({
      johnny: { kind: 'johnny', configured: false, healthy: true },
      snyk: { kind: 'snyk', configured: true, healthy: true },
    });

    const result = await getScannerAccessSettings({}, { user: { id: 'user-1' } });
    const johnnyChoice = result.scanner_choices.find((choice: any) => choice.source === 'codescoring_johnny');

    expect(johnnyChoice?.selectable).toBe(false);
    expect(johnnyChoice?.status).toBe('unavailable');
    expect(johnnyChoice?.disabled_reason).toBe('Johnny is not configured on this server');
  });

  it('disables Johnny and marks status unavailable if Johnny is unhealthy', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: 'user-1',
      plan: 'pro',
      snykApiKeyEncrypted: null,
    });
    prismaMock.scannerUsageLedger.count.mockResolvedValueOnce(0);
    getScannerHealthSnapshotMock.mockReturnValue({
      johnny: { kind: 'johnny', configured: true, healthy: false, error: 'Connection timed out' },
      snyk: { kind: 'snyk', configured: true, healthy: true },
    });

    const result = await getScannerAccessSettings({}, { user: { id: 'user-1' } });
    const johnnyChoice = result.scanner_choices.find((choice: any) => choice.source === 'codescoring_johnny');

    expect(johnnyChoice?.selectable).toBe(false);
    expect(johnnyChoice?.status).toBe('unavailable');
    expect(johnnyChoice?.disabled_reason).toBe('Connection timed out');
  });

  it('disables Johnny and falls back to default error message if Johnny is unhealthy with no error details', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: 'user-1',
      plan: 'pro',
      snykApiKeyEncrypted: null,
    });
    prismaMock.scannerUsageLedger.count.mockResolvedValueOnce(0);
    getScannerHealthSnapshotMock.mockReturnValue({
      johnny: { kind: 'johnny', configured: true, healthy: false, error: null },
      snyk: { kind: 'snyk', configured: true, healthy: true },
    });

    const result = await getScannerAccessSettings({}, { user: { id: 'user-1' } });
    const johnnyChoice = result.scanner_choices.find((choice: any) => choice.source === 'codescoring_johnny');

    expect(johnnyChoice?.disabled_reason).toBe('Johnny is unhealthy right now');
  });

  it('clears a snyk key when the field is null', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: 'user-1',
      plan: 'pro',
      snykApiKeyEncrypted: secretEncryption.encryptSecret('snyk-token-abcdef123456'),
    });
    prismaMock.user.update.mockResolvedValueOnce({});
    prismaMock.scannerUsageLedger.count.mockResolvedValueOnce(0);

    const result = await updateScannerAccessSettings(
      { snyk_api_key: null },
      { user: { id: 'user-1' } }
    );

    expect(result.snyk_api_key_attached).toBe(false);
    expect(result.snyk_api_key_preview).toBeNull();
  });

  it('no-ops update if snyk_api_key is undefined in arguments', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: 'user-1',
      plan: 'pro',
      snykApiKeyEncrypted: secretEncryption.encryptSecret('original-key'),
    });
    prismaMock.scannerUsageLedger.count.mockResolvedValueOnce(0);

    await updateScannerAccessSettings({}, { user: { id: 'user-1' } });

    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('handles unlimited monthly limit plan for Johnny', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: 'user-1',
      plan: 'unlimited_plan',
      snykApiKeyEncrypted: null,
    });
    prismaMock.scannerUsageLedger.count.mockResolvedValueOnce(50);

    const result = await getScannerAccessSettings({}, { user: { id: 'user-1' } });
    const johnnyChoice = result.scanner_choices.find((choice: any) => choice.source === 'codescoring_johnny');

    expect(johnnyChoice?.selectable).toBe(true);
    expect(johnnyChoice?.status).toBe('available');
    expect(johnnyChoice?.cooldown_reset_at).toBeNull();
    expect(johnnyChoice?.usage?.limit).toBe(0);
    expect(johnnyChoice?.usage?.remaining).toBe(999999);
  });

  it('returns exact short secret preview on update if key length <= 8', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: 'user-1',
      plan: 'pro',
      snykApiKeyEncrypted: null,
    });
    prismaMock.user.update.mockResolvedValueOnce({});
    prismaMock.scannerUsageLedger.count.mockResolvedValueOnce(0);

    const result = await updateScannerAccessSettings(
      { snyk_api_key: 'short' },
      { user: { id: 'user-1' } }
    );

    expect(result.snyk_api_key_preview).toBe('short');
  });

  it('returns null preview on update if decryption fails due to invalid cipher', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: 'user-1',
      plan: 'pro',
      snykApiKeyEncrypted: null,
    });
    prismaMock.user.update.mockResolvedValueOnce({});
    prismaMock.scannerUsageLedger.count.mockResolvedValueOnce(0);

    // Mock encryptSecret to return a bad cipher that will fail decryption
    const encryptMock = jest.spyOn(secretEncryption, 'encryptSecret');
    encryptMock.mockReturnValueOnce('bad-cipher-text');

    const result = await updateScannerAccessSettings(
      { snyk_api_key: 'trigger-fail' },
      { user: { id: 'user-1' } }
    );

    expect(result.snyk_api_key_preview).toBeNull();
    encryptMock.mockRestore();
  });

  it('returns ready status for snyk when snyk scanner is ready', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: 'user-1',
      plan: 'pro',
      snykApiKeyEncrypted: null,
    });
    prismaMock.scannerUsageLedger.count.mockResolvedValueOnce(0);
    (getSnykScannerReadinessMock as any).mockResolvedValueOnce({
      enabled: true,
      ready: true,
      credentialSource: { mode: 'environment' },
      reason: null,
    });

    const result = await getScannerAccessSettings({}, { user: { id: 'user-1' } });
    const snykChoice = result.scanner_choices.find((choice: any) => choice.source === 'snyk');

    expect(snykChoice?.selectable).toBe(true);
    expect(snykChoice?.status).toBe('available');
    expect(result.snyk_ready).toBe(true);
    expect(result.snyk_credential_source).toBe('environment');
  });

  afterEach(() => {
    process.env.ENCRYPTION_KEY = originalEncryptionKey;
  });
});

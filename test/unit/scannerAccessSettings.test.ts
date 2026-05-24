import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { prisma } from '../mocks/wasp-server';
import { encryptSecret } from '../../wasp-app/src/server/utils/secretEncryption';
const getScannerHealthSnapshotMock = jest.fn();

jest.mock('../../wasp-app/src/server/services/scannerHealthMonitor', () => ({
  getScannerHealthSnapshot: getScannerHealthSnapshotMock,
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
    const encrypted = encryptSecret('snyk-token-1234567890');
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
      snykApiKeyEncrypted: encryptSecret('snyk-token-abcdef123456'),
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

  afterEach(() => {
    process.env.ENCRYPTION_KEY = originalEncryptionKey;
  });
});

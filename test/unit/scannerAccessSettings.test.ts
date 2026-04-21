import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { prisma } from '../mocks/wasp-server';
import { encryptSecret } from '../../wasp-app/src/server/utils/secretEncryption';
import { getScannerAccessSettings, updateScannerAccessSettings } from '../../wasp-app/src/server/operations/settings';

const prismaMock = prisma;

describe('scanner access settings operations', () => {
  const originalEncryptionKey = process.env.ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = Buffer.alloc(32, 'scanner-access-test-key').toString('hex').slice(0, 64);
    prismaMock.user.findUnique.mockReset();
    prismaMock.user.update.mockReset();
  });

  it('returns attachment state and preview for stored snyk key', async () => {
    const encrypted = encryptSecret('snyk-token-1234567890');
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: 'user-1',
      snykApiKeyEncrypted: encrypted,
    });

    const result = await getScannerAccessSettings({}, { user: { id: 'user-1' } });

    expect(result.snyk_api_key_attached).toBe(true);
    expect(result.snyk_api_key_preview).toBe('snyk...7890');
    expect(result.scanner_health.johnny.kind).toBe('johnny');
  });

  it('stores a new snyk key and returns updated attachment state', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: 'user-1',
      snykApiKeyEncrypted: null,
    });
    prismaMock.user.update.mockResolvedValueOnce({});

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
          snykApiKeyEncrypted: expect.any(Buffer),
        },
      }),
    );

    expect(result.snyk_api_key_attached).toBe(true);
    expect(result.snyk_api_key_preview).toBe('snyk...3456');
  });

  it('clears a snyk key when the field is blank', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: 'user-1',
      snykApiKeyEncrypted: encryptSecret('snyk-token-abcdef123456'),
    });
    prismaMock.user.update.mockResolvedValueOnce({});

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

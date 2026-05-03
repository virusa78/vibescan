import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { getSnykScannerReadiness } from '../../wasp-app/src/server/services/scannerReadinessService';

type ReadinessPrismaStub = {
  user: {
    findUnique: jest.Mock;
  };
};

const trackedEnv = {
  VIBESCAN_ENABLE_SNYK_SCANNER: process.env.VIBESCAN_ENABLE_SNYK_SCANNER,
  VIBESCAN_SNYK_CREDENTIAL_MODE: process.env.VIBESCAN_SNYK_CREDENTIAL_MODE,
  SNYK_TOKEN: process.env.SNYK_TOKEN,
};

describe('scannerReadinessService', () => {
  afterEach(() => {
    process.env.VIBESCAN_ENABLE_SNYK_SCANNER = trackedEnv.VIBESCAN_ENABLE_SNYK_SCANNER;
    process.env.VIBESCAN_SNYK_CREDENTIAL_MODE = trackedEnv.VIBESCAN_SNYK_CREDENTIAL_MODE;
    process.env.SNYK_TOKEN = trackedEnv.SNYK_TOKEN;
  });

  it('reports ready when environment token is available', async () => {
    process.env.VIBESCAN_ENABLE_SNYK_SCANNER = 'true';
    delete process.env.VIBESCAN_SNYK_CREDENTIAL_MODE;
    process.env.SNYK_TOKEN = 'env-token';

    const readiness = await getSnykScannerReadiness(
      { user: { findUnique: jest.fn() } } as unknown as ReadinessPrismaStub,
      'user-1',
    );

    expect(readiness.ready).toBe(true);
    expect(readiness.credentialSource).toEqual({ mode: 'environment' });
  });

  it('reports ready when user-secret mode is configured and the key is attached', async () => {
    process.env.VIBESCAN_ENABLE_SNYK_SCANNER = 'true';
    process.env.VIBESCAN_SNYK_CREDENTIAL_MODE = 'user-secret';
    delete process.env.SNYK_TOKEN;

    const findUnique = jest.fn() as jest.MockedFunction<() => Promise<{ snykApiKeyEncrypted: Buffer }>>;
    findUnique.mockResolvedValue({ snykApiKeyEncrypted: Buffer.from('encrypted') });
    const readiness = await getSnykScannerReadiness(
      {
        user: {
          findUnique,
        },
      } as ReadinessPrismaStub,
      'user-77',
    );

    expect(readiness.ready).toBe(true);
    expect(readiness.credentialSource).toEqual({ mode: 'user-secret', userId: 'user-77' });
  });

  it('reports not ready when feature is enabled but no API key exists', async () => {
    process.env.VIBESCAN_ENABLE_SNYK_SCANNER = 'true';
    delete process.env.VIBESCAN_SNYK_CREDENTIAL_MODE;
    delete process.env.SNYK_TOKEN;

    const findUnique = jest.fn() as jest.MockedFunction<() => Promise<{ snykApiKeyEncrypted: null }>>;
    findUnique.mockResolvedValue({ snykApiKeyEncrypted: null });
    const readiness = await getSnykScannerReadiness(
      { user: { findUnique } } as ReadinessPrismaStub,
      'user-2',
    );

    expect(readiness.ready).toBe(false);
    expect(readiness.reason).toMatch(/API key/i);
  });
});

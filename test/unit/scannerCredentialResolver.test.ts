import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { encryptSecret } from '../../wasp-app/src/server/utils/secretEncryption';
import { resolveCredentialsForProvider } from '../../wasp-app/src/server/services/scannerCredentialResolver';

type ResolverPrismaStub = {
  user: {
    findUnique: jest.Mock;
  };
};

describe('scannerCredentialResolver', () => {
  const originalEnv = {
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
    SNYK_TOKEN: process.env.SNYK_TOKEN,
    SNYK_ORG_ID: process.env.SNYK_ORG_ID,
  };

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = Buffer.alloc(32, 'scanner-cred-test-key').toString('hex').slice(0, 64);
    delete process.env.SNYK_TOKEN;
    process.env.SNYK_ORG_ID = 'org-123';
  });

  afterEach(() => {
    process.env.ENCRYPTION_KEY = originalEnv.ENCRYPTION_KEY;
    process.env.SNYK_TOKEN = originalEnv.SNYK_TOKEN;
    process.env.SNYK_ORG_ID = originalEnv.SNYK_ORG_ID;
  });

  it('returns environment credentials for snyk when token is configured', async () => {
    process.env.SNYK_TOKEN = 'env-snyk-token';

    const credentials = await resolveCredentialsForProvider(
      { user: { findUnique: jest.fn() } } as unknown as ResolverPrismaStub,
      'snyk',
      { mode: 'environment' },
    );

    expect(credentials).toEqual({
      source: 'environment',
      values: {
        token: 'env-snyk-token',
        orgId: 'org-123',
      },
    });
  });

  it('decrypts user-secret credentials for snyk', async () => {
    const findUnique = jest.fn() as jest.MockedFunction<() => Promise<{ snykApiKeyEncrypted: Buffer }>>;
    findUnique.mockResolvedValue({
      snykApiKeyEncrypted: encryptSecret('user-snyk-token'),
    });
    const prisma = {
      user: {
        findUnique,
      },
    } as ResolverPrismaStub;

    const credentials = await resolveCredentialsForProvider(
      prisma,
      'snyk',
      { mode: 'user-secret', userId: 'user-7' },
    );

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-7' },
      select: { snykApiKeyEncrypted: true },
    });
    expect(credentials).toEqual({
      source: 'user-secret',
      userId: 'user-7',
      values: {
        token: 'user-snyk-token',
        orgId: 'org-123',
      },
    });
  });
});

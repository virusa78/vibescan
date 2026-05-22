import type { PrismaClient } from '@prisma/client';
import { decryptSecret } from '../utils/secretEncryption.js';
import type {
  ScannerCredentialSource,
  ScannerProviderKind,
  ScannerResolvedCredentials,
} from '../lib/scanners/providerTypes.js';
import { getSnykOrgId } from '../config/runtime.js';

type CredentialResolverPrismaClient = Pick<PrismaClient, 'user'>;

export async function resolveCredentialsForProvider(
  prisma: CredentialResolverPrismaClient,
  providerKind: ScannerProviderKind,
  credentialSource: ScannerCredentialSource | undefined,
): Promise<ScannerResolvedCredentials> {
  if (providerKind !== 'snyk') {
    return {
      source: 'none',
      values: {},
    };
  }

  const orgId = getSnykOrgId();

  if (!credentialSource || credentialSource.mode === 'environment') {
    return {
      source: 'environment',
      values: {
        token: process.env.SNYK_TOKEN?.trim() || undefined,
        orgId,
      },
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: credentialSource.userId },
    select: { snykApiKeyEncrypted: true },
  });

  if (!user) {
    throw new Error(`Unable to resolve Snyk credentials: user ${credentialSource.userId} not found`);
  }

  const token = user.snykApiKeyEncrypted
    ? decryptSecret(user.snykApiKeyEncrypted)
    : undefined;

  return {
    source: 'user-secret',
    values: {
      token,
      orgId,
    },
    userId: credentialSource.userId,
  };
}

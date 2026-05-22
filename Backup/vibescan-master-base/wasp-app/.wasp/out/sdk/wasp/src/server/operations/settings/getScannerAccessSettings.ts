import { HttpError, prisma } from 'wasp/server';
import { decryptSecret } from '../../utils/secretEncryption.js';
import { getScannerHealthSnapshot, type ScannerHealthSnapshot } from '../../services/scannerHealthMonitor.js';
import { getSnykScannerReadiness } from '../../services/scannerReadinessService.js';

export type ScannerAccessResponse = {
  snyk_api_key_attached: boolean;
  snyk_api_key_preview: string | null;
  snyk_enabled: boolean;
  snyk_ready: boolean;
  snyk_ready_reason: string | null;
  snyk_credential_source: 'environment' | 'user-secret' | null;
  scanner_health: Record<'johnny' | 'snyk', ScannerHealthSnapshot>;
};


function buildSecretPreview(secret: string): string {
  if (secret.length <= 8) {
    return secret;
  }

  return `${secret.slice(0, 4)}...${secret.slice(-4)}`;
}

function getScannerAccessPreview(encryptedKey: Buffer | null): string | null {
  if (!encryptedKey) {
    return null;
  }

  try {
    return buildSecretPreview(decryptSecret(encryptedKey));
  } catch {
    return null;
  }
}

export async function getScannerAccessSettings(
  _args: unknown,
  context: any
): Promise<any> {
  if (!context.user) {
    throw new HttpError(401, 'User not authenticated');
  }

  const user = await prisma.user.findUnique({
    where: { id: context.user.id },
    select: {
      id: true,
      snykApiKeyEncrypted: true,
    },
  });

  if (!user) {
    throw new HttpError(404, 'User not found');
  }

  const snykReadiness = await getSnykScannerReadiness(prisma, context.user.id);

  return {
    snyk_api_key_attached: !!user.snykApiKeyEncrypted,
    snyk_api_key_preview: getScannerAccessPreview(user.snykApiKeyEncrypted),
    snyk_enabled: snykReadiness.enabled,
    snyk_ready: snykReadiness.ready,
    snyk_ready_reason: snykReadiness.reason,
    snyk_credential_source: snykReadiness.credentialSource?.mode ?? null,
    scanner_health: getScannerHealthSnapshot(),
  };
}

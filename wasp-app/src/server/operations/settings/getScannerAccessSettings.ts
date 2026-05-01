import { HttpError, prisma } from 'wasp/server';
import { decryptSecret } from '../../utils/secretEncryption.js';
import { getScannerHealthSnapshot, type ScannerHealthSnapshot } from '../../services/scannerHealthMonitor.js';

export type ScannerAccessResponse = {
  snyk_api_key_attached: boolean;
  snyk_api_key_preview: string | null;
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
  _args: any,
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

  return {
    snyk_api_key_attached: !!user.snykApiKeyEncrypted,
    snyk_api_key_preview: getScannerAccessPreview(user.snykApiKeyEncrypted),
    scanner_health: getScannerHealthSnapshot(),
  } as any;
}

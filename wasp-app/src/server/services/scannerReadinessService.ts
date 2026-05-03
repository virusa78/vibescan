import type { PrismaClient } from '@prisma/client';
import {
  getSnykCredentialMode,
  isSnykScanningEnabled,
} from '../config/runtime.js';
import type { ScannerCredentialSource } from '../lib/scanners/providerTypes.js';

type ScannerReadinessPrismaClient = Pick<PrismaClient, 'user'>;

export type SnykScannerReadiness = {
  enabled: boolean;
  ready: boolean;
  credentialMode: 'auto' | 'environment' | 'user-secret';
  credentialSource: ScannerCredentialSource | null;
  reason: string | null;
  hasEnvironmentToken: boolean;
  hasUserSecret: boolean;
};

export async function getSnykScannerReadiness(
  prisma: ScannerReadinessPrismaClient,
  userId?: string,
): Promise<SnykScannerReadiness> {
  const enabled = isSnykScanningEnabled();
  const credentialMode = getSnykCredentialMode();
  const hasEnvironmentToken = !!process.env.SNYK_TOKEN?.trim();
  const userSecretRecord = userId
    ? await prisma.user.findUnique({
        where: { id: userId },
        select: { snykApiKeyEncrypted: true },
      })
    : null;
  const hasUserSecret = !!userSecretRecord?.snykApiKeyEncrypted;

  if (!enabled) {
    return {
      enabled: false,
      ready: false,
      credentialMode,
      credentialSource: null,
      reason: 'Snyk scanner feature flag is disabled',
      hasEnvironmentToken,
      hasUserSecret,
    };
  }

  if (credentialMode === 'environment') {
    return {
      enabled: true,
      ready: hasEnvironmentToken,
      credentialMode,
      credentialSource: hasEnvironmentToken ? { mode: 'environment' } : null,
      reason: hasEnvironmentToken ? null : 'Snyk environment token is not configured',
      hasEnvironmentToken,
      hasUserSecret,
    };
  }

  if (credentialMode === 'user-secret') {
    return {
      enabled: true,
      ready: !!(userId && hasUserSecret),
      credentialMode,
      credentialSource: userId && hasUserSecret ? { mode: 'user-secret', userId } : null,
      reason: userId
        ? hasUserSecret
          ? null
          : 'User Snyk API key is not attached'
        : 'User context is required for Snyk user-secret mode',
      hasEnvironmentToken,
      hasUserSecret,
    };
  }

  if (hasEnvironmentToken) {
    return {
      enabled: true,
      ready: true,
      credentialMode,
      credentialSource: { mode: 'environment' },
      reason: null,
      hasEnvironmentToken,
      hasUserSecret,
    };
  }

  if (userId && hasUserSecret) {
    return {
      enabled: true,
      ready: true,
      credentialMode,
      credentialSource: { mode: 'user-secret', userId },
      reason: null,
      hasEnvironmentToken,
      hasUserSecret,
    };
  }

  return {
    enabled: true,
    ready: false,
    credentialMode,
    credentialSource: null,
    reason: 'Snyk requires an API key from environment or user settings',
    hasEnvironmentToken,
    hasUserSecret,
  };
}

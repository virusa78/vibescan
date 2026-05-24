import { HttpError, prisma } from 'wasp/server';
import { decryptSecret } from '../../utils/secretEncryption.js';
import { getScannerHealthSnapshot, type ScannerHealthSnapshot } from '../../services/scannerHealthMonitor.js';
import { getSnykScannerReadiness } from '../../services/scannerReadinessService.js';
import { getScannerMonthlyLimit, isUnlimitedScannerMonthlyLimit } from '../../config/scannerPolicy.js';
import { getScannerUsagePeriodKey } from '../../services/scannerUsageService.js';

export type ScannerAccessResponse = {
  snyk_api_key_attached: boolean;
  snyk_api_key_preview: string | null;
  snyk_enabled: boolean;
  snyk_ready: boolean;
  snyk_ready_reason: string | null;
  snyk_credential_source: 'environment' | 'user-secret' | null;
  scanner_health: Record<'johnny' | 'snyk', ScannerHealthSnapshot>;
  scanner_choices: Array<{
    source: 'grype' | 'trivy' | 'codescoring_johnny' | 'owasp' | 'snyk';
    label: string;
    description: string;
    selectable: boolean;
    selected_by_default: boolean;
    status: 'available' | 'cooling_down' | 'unavailable';
    disabled_reason: string | null;
    cooldown_reset_at: string | null;
    usage?: {
      used: number;
      limit: number;
      remaining: number;
      reset_at: string | null;
    };
  }>;
};


function buildSecretPreview(secret: string): string {
  if (secret.length <= 8) {
    return secret;
  }

  return `${secret.slice(0, 4)}...${secret.slice(-4)}`;
}

function getScannerAccessPreview(encryptedKey: string | null): string | null {
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
      plan: true,
      snykApiKeyEncrypted: true,
    },
  });

  if (!user) {
    throw new HttpError(404, 'User not found');
  }

  const snykReadiness = await getSnykScannerReadiness(prisma, context.user.id);
  const scannerHealth = getScannerHealthSnapshot();
  const johnnyLimit = getScannerMonthlyLimit(user.plan, 'codescoring-johnny');
  const johnnyPeriodKey = getScannerUsagePeriodKey();
  const johnnyUsed = await prisma.scannerUsageLedger.count({
    where: {
      userId: user.id,
      provider: 'codescoring-johnny',
      periodKey: johnnyPeriodKey,
    },
  });
  const johnnyRemaining = isUnlimitedScannerMonthlyLimit(johnnyLimit) ? Number.POSITIVE_INFINITY : Math.max(0, johnnyLimit - johnnyUsed);
  const now = new Date();
  const nextMonthReset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const johnnyCooldownResetAt = isUnlimitedScannerMonthlyLimit(johnnyLimit) ? null : nextMonthReset.toISOString();
  const johnnyCoolingDown = !isUnlimitedScannerMonthlyLimit(johnnyLimit) && johnnyUsed >= johnnyLimit;
  const johnnyCanSelect =
    scannerHealth.johnny.configured &&
    scannerHealth.johnny.healthy !== false &&
    !johnnyCoolingDown;

  const johnnyDisabledReason = !scannerHealth.johnny.configured
    ? 'Johnny is not configured on this server'
    : scannerHealth.johnny.healthy === false
      ? scannerHealth.johnny.error || 'Johnny is unhealthy right now'
      : johnnyCoolingDown
        ? `Johnny is cooling down until ${new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(nextMonthReset)}.`
        : null;
  const johnnyStatus = !scannerHealth.johnny.configured || scannerHealth.johnny.healthy === false
    ? 'unavailable'
    : johnnyCoolingDown
      ? 'cooling_down'
      : 'available';

  return {
    snyk_api_key_attached: !!user.snykApiKeyEncrypted,
    snyk_api_key_preview: getScannerAccessPreview(user.snykApiKeyEncrypted),
    snyk_enabled: snykReadiness.enabled,
    snyk_ready: snykReadiness.ready,
    snyk_ready_reason: snykReadiness.reason,
    snyk_credential_source: snykReadiness.credentialSource?.mode ?? null,
    scanner_health: scannerHealth,
    scanner_choices: [
      {
        source: 'grype',
        label: 'Grype',
        description: 'Free lane for dependency vulnerabilities.',
        selectable: true,
        selected_by_default: true,
        status: 'available',
        disabled_reason: null,
        cooldown_reset_at: null,
      },
      {
        source: 'trivy',
        label: 'Trivy',
        description: 'Free SBOM lane for CycloneDX imports and package analysis.',
        selectable: true,
        selected_by_default: true,
        status: 'available',
        disabled_reason: null,
        cooldown_reset_at: null,
      },
      {
        source: 'codescoring_johnny',
        label: 'Johnny',
        description: 'Enterprise lane with monthly usage policy.',
        selectable: johnnyCanSelect,
        selected_by_default: johnnyCanSelect,
        status: johnnyStatus,
        disabled_reason: johnnyDisabledReason,
        cooldown_reset_at: johnnyCooldownResetAt,
        usage: {
          used: johnnyUsed,
          limit: isUnlimitedScannerMonthlyLimit(johnnyLimit) ? 0 : johnnyLimit,
          remaining: isUnlimitedScannerMonthlyLimit(johnnyLimit) ? 999999 : johnnyRemaining,
          reset_at: johnnyCooldownResetAt,
        },
      },
      {
        source: 'owasp',
        label: 'OWASP',
        description: 'External DAST import lane.',
        selectable: true,
        selected_by_default: true,
        status: 'available',
        disabled_reason: null,
        cooldown_reset_at: null,
      },
      {
        source: 'snyk',
        label: 'Snyk',
        description: 'Runs with a user-owned key or environment token.',
        selectable: snykReadiness.ready,
        selected_by_default: snykReadiness.ready,
        status: snykReadiness.ready ? 'available' : 'unavailable',
        disabled_reason: snykReadiness.reason,
        cooldown_reset_at: null,
      },
    ],
  };
}

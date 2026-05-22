import type { PlanTier } from './quotas.js';
import type { ScannerProviderKind } from '../lib/scanners/providerTypes.js';

export type ScannerMonthlyLimit = number;

export type ScannerMonthlyPolicy = Record<PlanTier, Partial<Record<ScannerProviderKind, ScannerMonthlyLimit>>>;

const INFINITY_LIMIT = Number.POSITIVE_INFINITY;

const DEFAULT_SCANNER_MONTHLY_POLICY: ScannerMonthlyPolicy = {
  free_trial: {
    grype: INFINITY_LIMIT,
    trivy: INFINITY_LIMIT,
    'codescoring-johnny': 1,
    owasp: INFINITY_LIMIT,
    snyk: INFINITY_LIMIT,
  },
  starter: {
    grype: INFINITY_LIMIT,
    trivy: INFINITY_LIMIT,
    'codescoring-johnny': 1,
    owasp: INFINITY_LIMIT,
    snyk: INFINITY_LIMIT,
  },
  pro: {
    grype: INFINITY_LIMIT,
    trivy: INFINITY_LIMIT,
    'codescoring-johnny': 12,
    owasp: INFINITY_LIMIT,
    snyk: INFINITY_LIMIT,
  },
  enterprise: {
    grype: INFINITY_LIMIT,
    trivy: INFINITY_LIMIT,
    'codescoring-johnny': 50,
    owasp: INFINITY_LIMIT,
    snyk: INFINITY_LIMIT,
  },
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeLimit(value: unknown): ScannerMonthlyLimit | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (value === 'Infinity' || value === 'infinity') {
    return INFINITY_LIMIT;
  }

  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return Math.floor(value);
  }

  return undefined;
}

function mergeScannerPolicy(
  base: ScannerMonthlyPolicy,
  override: Partial<Record<PlanTier, Partial<Record<ScannerProviderKind, unknown>>>>,
): ScannerMonthlyPolicy {
  const merged: ScannerMonthlyPolicy = {
    free_trial: { ...base.free_trial },
    starter: { ...base.starter },
    pro: { ...base.pro },
    enterprise: { ...base.enterprise },
  };

  (Object.keys(override) as PlanTier[]).forEach((planTier) => {
    const planOverride = override[planTier];
    if (!isPlainObject(planOverride)) {
      return;
    }

    merged[planTier] = {
      ...merged[planTier],
      ...(Object.entries(planOverride).reduce<Partial<Record<ScannerProviderKind, ScannerMonthlyLimit>>>(
        (accumulator, [provider, rawValue]) => {
          const limit = normalizeLimit(rawValue);
          if (limit !== undefined) {
            accumulator[provider as ScannerProviderKind] = limit;
          }
          return accumulator;
        },
        {},
      )),
    };
  });

  return merged;
}

export function getScannerMonthlyPolicy(
  env: NodeJS.ProcessEnv = process.env,
): ScannerMonthlyPolicy {
  const raw = env.VIBESCAN_SCANNER_MONTHLY_LIMITS_JSON?.trim();
  if (!raw) {
    return DEFAULT_SCANNER_MONTHLY_POLICY;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<Record<PlanTier, Partial<Record<ScannerProviderKind, unknown>>>>;
    if (!isPlainObject(parsed)) {
      return DEFAULT_SCANNER_MONTHLY_POLICY;
    }

    return mergeScannerPolicy(DEFAULT_SCANNER_MONTHLY_POLICY, parsed);
  } catch {
    return DEFAULT_SCANNER_MONTHLY_POLICY;
  }
}

export function getScannerMonthlyLimit(
  planTier: string,
  provider: ScannerProviderKind,
  env: NodeJS.ProcessEnv = process.env,
): ScannerMonthlyLimit {
  const policy = getScannerMonthlyPolicy(env);
  const normalizedPlan = planTier.toLowerCase() as PlanTier;
  return policy[normalizedPlan]?.[provider] ?? INFINITY_LIMIT;
}

export function isUnlimitedScannerMonthlyLimit(limit: ScannerMonthlyLimit): boolean {
  return limit === INFINITY_LIMIT;
}

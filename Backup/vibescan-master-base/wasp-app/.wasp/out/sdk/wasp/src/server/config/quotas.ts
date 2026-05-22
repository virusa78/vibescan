/**
 * Quota configuration for different plan tiers.
 * Defines monthly scan limits for each plan level.
 */

export type PlanTier = 'free_trial' | 'starter' | 'pro' | 'enterprise';

export interface QuotaLimit {
  monthlyScans: number;
  description: string;
}

export const QUOTA_LIMITS: Record<PlanTier, QuotaLimit> = {
  free_trial: {
    monthlyScans: 5,
    description: 'Free trial: 5 scans/month',
  },
  starter: {
    monthlyScans: 50,
    description: 'Starter: 50 scans/month',
  },
  pro: {
    monthlyScans: 500,
    description: 'Pro: 500 scans/month',
  },
  enterprise: {
    monthlyScans: Infinity,
    description: 'Enterprise: unlimited scans',
  },
};

/**
 * Get the monthly quota limit for a given plan tier.
 * @param plan The plan tier (defaults to 'free_trial' if not recognized)
 * @returns The monthly scan limit
 */
export function getQuotaLimitForPlan(plan: string): number {
  const normalizedPlan = plan.toLowerCase() as PlanTier;
  const limit = QUOTA_LIMITS[normalizedPlan];
  
  if (!limit) {
    console.warn(`Unknown plan tier: ${plan}, defaulting to free_trial`);
    return QUOTA_LIMITS.free_trial.monthlyScans;
  }
  
  return limit.monthlyScans;
}

/**
 * Check if a quota limit is unlimited.
 * @param limit The quota limit
 * @returns True if the limit is Infinity
 */
export function isUnlimitedQuota(limit: number): boolean {
  return limit === Infinity;
}

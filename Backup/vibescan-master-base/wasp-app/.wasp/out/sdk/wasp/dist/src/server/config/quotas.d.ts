/**
 * Quota configuration for different plan tiers.
 * Defines monthly scan limits for each plan level.
 */
export type PlanTier = 'free_trial' | 'starter' | 'pro' | 'enterprise';
export interface QuotaLimit {
    monthlyScans: number;
    description: string;
}
export declare const QUOTA_LIMITS: Record<PlanTier, QuotaLimit>;
/**
 * Get the monthly quota limit for a given plan tier.
 * @param plan The plan tier (defaults to 'free_trial' if not recognized)
 * @returns The monthly scan limit
 */
export declare function getQuotaLimitForPlan(plan: string): number;
/**
 * Check if a quota limit is unlimited.
 * @param limit The quota limit
 * @returns True if the limit is Infinity
 */
export declare function isUnlimitedQuota(limit: number): boolean;
//# sourceMappingURL=quotas.d.ts.map
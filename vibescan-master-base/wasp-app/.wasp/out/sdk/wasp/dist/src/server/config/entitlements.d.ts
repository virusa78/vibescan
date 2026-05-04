import type { PlanTier } from '@prisma/client';
export type EntitlementFeatureKey = 'comparison' | 'comparison_delta' | 'comparison_winner' | 'webhooks' | 'events' | 'billing' | 'remediation' | 'scanners';
export type EntitlementLimitKey = 'monthly_scans' | 'monthly_comparisons' | 'monthly_remediation_prompts' | 'remediation_prompts_per_finding' | 'webhook_destinations';
export type EntitlementSnapshot = {
    features: Record<EntitlementFeatureKey, boolean>;
    limits: Record<EntitlementLimitKey, number | null>;
};
export declare const ENTITLEMENTS_BY_PLAN: Record<PlanTier, EntitlementSnapshot>;
//# sourceMappingURL=entitlements.d.ts.map
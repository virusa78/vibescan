export interface PolicyLimits {
    monthlyScanLimit: number;
    monthlyRemediationPromptLimit: number;
    maxPromptsPerFinding: number;
}
export type PolicySource = 'global_default' | 'region_policy' | 'user_override';
export interface PolicyLayer {
    monthlyScanLimit?: number | null;
    monthlyRemediationPromptLimit?: number | null;
    maxPromptsPerFinding?: number | null;
}
export interface EffectivePolicy extends PolicyLimits {
    regionCode: string;
    source: PolicySource;
}
export declare const DEFAULT_GLOBAL_POLICY: PolicyLimits;
export declare function normalizeRegionCode(region?: string | null): string;
export declare function resolveEffectivePolicy(input: {
    regionCode?: string | null;
    globalPolicy?: PolicyLayer | null;
    regionPolicy?: (PolicyLayer & {
        isActive?: boolean | null;
    }) | null;
    userOverride?: PolicyLayer | null;
}): EffectivePolicy;
//# sourceMappingURL=regionPolicy.d.ts.map
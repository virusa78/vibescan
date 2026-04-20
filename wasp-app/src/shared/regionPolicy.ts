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

export const DEFAULT_GLOBAL_POLICY: PolicyLimits = {
  monthlyScanLimit: 50,
  monthlyRemediationPromptLimit: 15,
  maxPromptsPerFinding: 3,
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function normalizeRegionCode(region?: string | null): string {
  if (!region) {
    return 'OTHER';
  }

  const normalized = region.trim().toUpperCase();
  return ['IN', 'PK', 'OTHER'].includes(normalized) ? normalized : 'OTHER';
}

function applyLayer(base: PolicyLimits, layer?: PolicyLayer | null): PolicyLimits {
  if (!layer) {
    return base;
  }

  return {
    monthlyScanLimit: isFiniteNumber(layer.monthlyScanLimit)
      ? layer.monthlyScanLimit
      : base.monthlyScanLimit,
    monthlyRemediationPromptLimit: isFiniteNumber(layer.monthlyRemediationPromptLimit)
      ? layer.monthlyRemediationPromptLimit
      : base.monthlyRemediationPromptLimit,
    maxPromptsPerFinding: isFiniteNumber(layer.maxPromptsPerFinding)
      ? layer.maxPromptsPerFinding
      : base.maxPromptsPerFinding,
  };
}

function layerHasOverrides(layer?: PolicyLayer | null): boolean {
  if (!layer) {
    return false;
  }

  return (
    isFiniteNumber(layer.monthlyScanLimit) ||
    isFiniteNumber(layer.monthlyRemediationPromptLimit) ||
    isFiniteNumber(layer.maxPromptsPerFinding)
  );
}

export function resolveEffectivePolicy(input: {
  regionCode?: string | null;
  globalPolicy?: PolicyLayer | null;
  regionPolicy?: (PolicyLayer & { isActive?: boolean | null }) | null;
  userOverride?: PolicyLayer | null;
}): EffectivePolicy {
  const regionCode = normalizeRegionCode(input.regionCode);
  const globalPolicy = input.globalPolicy ? applyLayer(DEFAULT_GLOBAL_POLICY, input.globalPolicy) : DEFAULT_GLOBAL_POLICY;
  const activeRegionPolicy = input.regionPolicy && input.regionPolicy.isActive === false ? null : input.regionPolicy;
  const afterRegion = applyLayer(globalPolicy, activeRegionPolicy);
  const finalPolicy = applyLayer(afterRegion, input.userOverride);

  const source: PolicySource = layerHasOverrides(input.userOverride)
    ? 'user_override'
    : layerHasOverrides(activeRegionPolicy)
      ? 'region_policy'
      : 'global_default';

  return {
    ...finalPolicy,
    regionCode,
    source,
  };
}

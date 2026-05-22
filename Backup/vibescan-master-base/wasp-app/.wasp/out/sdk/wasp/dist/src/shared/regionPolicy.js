export const DEFAULT_GLOBAL_POLICY = {
    monthlyScanLimit: 50,
    monthlyRemediationPromptLimit: 15,
    maxPromptsPerFinding: 3,
};
function isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
}
export function normalizeRegionCode(region) {
    if (!region) {
        return 'OTHER';
    }
    const normalized = region.trim().toUpperCase();
    return ['IN', 'PK', 'OTHER'].includes(normalized) ? normalized : 'OTHER';
}
function applyLayer(base, layer) {
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
function layerHasOverrides(layer) {
    if (!layer) {
        return false;
    }
    return (isFiniteNumber(layer.monthlyScanLimit) ||
        isFiniteNumber(layer.monthlyRemediationPromptLimit) ||
        isFiniteNumber(layer.maxPromptsPerFinding));
}
export function resolveEffectivePolicy(input) {
    const regionCode = normalizeRegionCode(input.regionCode);
    const globalPolicy = input.globalPolicy ? applyLayer(DEFAULT_GLOBAL_POLICY, input.globalPolicy) : DEFAULT_GLOBAL_POLICY;
    const activeRegionPolicy = input.regionPolicy && input.regionPolicy.isActive === false ? null : input.regionPolicy;
    const afterRegion = applyLayer(globalPolicy, activeRegionPolicy);
    const finalPolicy = applyLayer(afterRegion, input.userOverride);
    const source = layerHasOverrides(input.userOverride)
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
//# sourceMappingURL=regionPolicy.js.map
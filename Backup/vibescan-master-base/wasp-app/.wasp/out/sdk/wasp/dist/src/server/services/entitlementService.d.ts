import { type EntitlementFeatureKey, type EntitlementLimitKey, type EntitlementSnapshot } from '../config/entitlements.js';
export declare function getUserEntitlements(userId: string): Promise<EntitlementSnapshot>;
export declare function hasFeature(userId: string, featureKey: EntitlementFeatureKey): Promise<boolean>;
export declare function getLimit(userId: string, limitKey: EntitlementLimitKey): Promise<number | null>;
//# sourceMappingURL=entitlementService.d.ts.map
import { prisma } from 'wasp/server';
import { ENTITLEMENTS_BY_PLAN, } from '../config/entitlements.js';
function normalizePlan(plan) {
    switch (plan) {
        case 'starter':
        case 'pro':
        case 'enterprise':
        case 'free_trial':
            return plan;
        default:
            return 'free_trial';
    }
}
function applyBillingStatusPolicy(snapshot, subscriptionStatus) {
    if (!subscriptionStatus) {
        return snapshot;
    }
    if (subscriptionStatus === 'past_due') {
        return {
            features: {
                ...snapshot.features,
                webhooks: false,
                events: false,
                remediation: false,
            },
            limits: snapshot.limits,
        };
    }
    if (subscriptionStatus === 'deleted') {
        return ENTITLEMENTS_BY_PLAN.free_trial;
    }
    return snapshot;
}
export async function getUserEntitlements(userId) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            plan: true,
            subscriptionStatus: true,
        },
    });
    const plan = normalizePlan(user?.plan);
    return applyBillingStatusPolicy(ENTITLEMENTS_BY_PLAN[plan], user?.subscriptionStatus);
}
export async function hasFeature(userId, featureKey) {
    const snapshot = await getUserEntitlements(userId);
    return snapshot.features[featureKey];
}
export async function getLimit(userId, limitKey) {
    const snapshot = await getUserEntitlements(userId);
    return snapshot.limits[limitKey];
}
//# sourceMappingURL=entitlementService.js.map
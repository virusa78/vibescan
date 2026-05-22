import type { PlanTier } from '@prisma/client';
import { prisma } from 'wasp/server';
import {
  ENTITLEMENTS_BY_PLAN,
  type EntitlementFeatureKey,
  type EntitlementLimitKey,
  type EntitlementSnapshot,
} from '../config/entitlements.js';

function normalizePlan(plan: string | null | undefined): PlanTier {
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

function applyBillingStatusPolicy(
  snapshot: EntitlementSnapshot,
  subscriptionStatus: string | null | undefined,
): EntitlementSnapshot {
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

export async function getUserEntitlements(userId: string): Promise<EntitlementSnapshot> {
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

export async function hasFeature(userId: string, featureKey: EntitlementFeatureKey): Promise<boolean> {
  const snapshot = await getUserEntitlements(userId);
  return snapshot.features[featureKey];
}

export async function getLimit(userId: string, limitKey: EntitlementLimitKey): Promise<number | null> {
  const snapshot = await getUserEntitlements(userId);
  return snapshot.limits[limitKey];
}

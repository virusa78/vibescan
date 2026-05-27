export enum SubscriptionStatus {
  PastDue = "past_due",
  CancelAtPeriodEnd = "cancel_at_period_end",
  Active = "active",
  Deleted = "deleted",
}

export enum PaymentPlanId {
  Hobby = "hobby",
  Pro = "pro",
  Credits10 = "credits10",
}

export interface PaymentPlan {
  id: PaymentPlanId;
  effect: PaymentPlanEffect;
}

export type PaymentPlanEffect =
  | { kind: "subscription" }
  | { kind: "credits"; amount: number };

export const paymentPlans = {
  [PaymentPlanId.Hobby]: {
    id: PaymentPlanId.Hobby,
    effect: { kind: "subscription" },
  },
  [PaymentPlanId.Pro]: {
    id: PaymentPlanId.Pro,
    effect: { kind: "subscription" },
  },
  [PaymentPlanId.Credits10]: {
    id: PaymentPlanId.Credits10,
    effect: { kind: "credits", amount: 10 },
  },
} as const satisfies Record<PaymentPlanId, PaymentPlan>;

export function prettyPaymentPlanName(planId: PaymentPlanId): string {
  const planToName: Record<PaymentPlanId, string> = {
    [PaymentPlanId.Hobby]: "Starter",
    [PaymentPlanId.Pro]: "Pro",
    [PaymentPlanId.Credits10]: "10 Credits",
  };
  return planToName[planId];
}

export function parsePaymentPlanId(planId: string): PaymentPlanId {
  if ((Object.values(PaymentPlanId) as string[]).includes(planId)) {
    return planId as PaymentPlanId;
  } else {
    throw new Error(`Invalid PaymentPlanId: ${planId}`);
  }
}

export function getSubscriptionPaymentPlanIds(): PaymentPlanId[] {
  return Object.values(PaymentPlanId).filter(
    (planId) => paymentPlans[planId].effect.kind === "subscription",
  );
}

export interface UnifiedPlan {
  [key: string]: any;
  id: string; // 'free_trial' | 'starter' | 'pro' | 'enterprise' | 'credits10'
  name: string;
  price: string;
  description: string;
  features: string[];
  isSubscription: boolean;
  paymentPlanId?: PaymentPlanId;
}

export const unifiedPlans: UnifiedPlan[] = [
  {
    id: "free_trial",
    name: "Free trial",
    price: "$0",
    description: "Validate the workflow with a small scan allotment and core reporting.",
    features: [
      "Core scan submissions",
      "Workspace-aware reporting",
      "Basic dashboard and findings access",
    ],
    isSubscription: true,
  },
  {
    id: "starter",
    name: "Starter",
    price: "$9.99",
    description: "Keep a steady scan cadence with the primary control-plane features.",
    features: [
      "Higher monthly scan limits",
      "Saved views and notifications",
      "Workspace-level billing visibility",
      "Basic email support",
    ],
    isSubscription: true,
    paymentPlanId: PaymentPlanId.Hobby,
  },
  {
    id: "pro",
    name: "Pro",
    price: "$19.99",
    description: "Expand coverage with richer reporting, history, and workflow depth.",
    features: [
      "GitHub-triggered scans and richer findings",
      "Remediation workflows and reporting depth",
      "Priority support path",
    ],
    isSubscription: true,
    paymentPlanId: PaymentPlanId.Pro,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Custom",
    description: "Coordinate larger teams, higher limits, and the full control plane.",
    features: [
      "Higher throughput and team controls",
      "Internal admin oversight and support lookup",
      "Full control-plane visibility",
    ],
    isSubscription: true,
  },
  {
    id: "credits10",
    name: "10 Credits",
    price: "$9.99",
    description: "One-time pack for burst scan usage.",
    features: [
      "Add 10 scan credits",
      "Use for one-off projects",
      "No expiration date",
    ],
    isSubscription: false,
    paymentPlanId: PaymentPlanId.Credits10,
  },
];


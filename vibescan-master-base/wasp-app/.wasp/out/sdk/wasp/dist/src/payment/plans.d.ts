export declare enum SubscriptionStatus {
    PastDue = "past_due",
    CancelAtPeriodEnd = "cancel_at_period_end",
    Active = "active",
    Deleted = "deleted"
}
export declare enum PaymentPlanId {
    Hobby = "hobby",
    Pro = "pro",
    Credits10 = "credits10"
}
export interface PaymentPlan {
    id: PaymentPlanId;
    effect: PaymentPlanEffect;
}
export type PaymentPlanEffect = {
    kind: "subscription";
} | {
    kind: "credits";
    amount: number;
};
export declare const paymentPlans: {
    readonly hobby: {
        readonly id: PaymentPlanId.Hobby;
        readonly effect: {
            readonly kind: "subscription";
        };
    };
    readonly pro: {
        readonly id: PaymentPlanId.Pro;
        readonly effect: {
            readonly kind: "subscription";
        };
    };
    readonly credits10: {
        readonly id: PaymentPlanId.Credits10;
        readonly effect: {
            readonly kind: "credits";
            readonly amount: 10;
        };
    };
};
export declare function prettyPaymentPlanName(planId: PaymentPlanId): string;
export declare function parsePaymentPlanId(planId: string): PaymentPlanId;
export declare function getSubscriptionPaymentPlanIds(): PaymentPlanId[];
//# sourceMappingURL=plans.d.ts.map
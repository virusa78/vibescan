import { type PaymentPlan, PaymentPlanId } from "./plans";
/**
 * The ID under which this payment plan is identified on your payment processor.
 *
 * E.g. price id on Stripe, or variant id on LemonSqueezy.
 */
export declare const paymentProcessorPlanIds: {
    readonly hobby: string;
    readonly pro: string;
    readonly credits10: string;
};
/**
 * Returns your payment processor plan ID for a given Open SaaS `PaymentPlan`.
 */
export declare function getPaymentProcessorPlanId(paymentPlan: PaymentPlan): string;
/**
 * Returns Open SaaS `PaymentPlanId` for some payment provider's plan ID.
 *
 * Different payment providers track plan ID in different ways.
 * e.g. Stripe price ID, Polar product ID...
 */
export declare function getPaymentPlanIdByPaymentProcessorPlanId(paymentProcessorPlanId: string): PaymentPlanId;
//# sourceMappingURL=paymentProcessorPlans.d.ts.map
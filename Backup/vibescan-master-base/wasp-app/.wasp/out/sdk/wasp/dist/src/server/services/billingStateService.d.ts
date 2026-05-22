import type { PrismaClient } from '@prisma/client';
import type Stripe from 'stripe';
import { SubscriptionStatus } from '../../payment/plans';
export type BillingUserRecord = {
    id: string;
    plan: string;
    activeWorkspaceId: string | null;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    subscriptionStatus: string | null;
};
export declare function handleStripeSubscriptionUpdatedEvent(event: Stripe.CustomerSubscriptionUpdatedEvent, _userDelegate: PrismaClient['user']): Promise<void>;
export declare function handleStripeSubscriptionDeletedEvent(event: Stripe.CustomerSubscriptionDeletedEvent, _userDelegate: PrismaClient['user']): Promise<void>;
export declare function handleStripeInvoicePaidEvent(event: Stripe.InvoicePaidEvent, userDelegate: PrismaClient['user']): Promise<void>;
export declare function handleStripeInvoicePaymentFailedEvent(event: Stripe.InvoicePaymentFailedEvent, userDelegate: PrismaClient['user']): Promise<void>;
export declare function getOpenSaasSubscriptionStatus(subscription: Stripe.Subscription): SubscriptionStatus | undefined;
//# sourceMappingURL=billingStateService.d.ts.map
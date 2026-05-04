import { prisma } from 'wasp/server';
import { SubscriptionStatus } from '../../payment/plans';
import { getPaymentPlanIdByPaymentProcessorPlanId } from '../../payment/paymentProcessorPlans';
import { createCanonicalEventInput, } from './eventPublisher.js';
import { publishAndRouteCanonicalEventSafely } from './eventPublicationSafety.js';
function mapPaymentPlanIdToPlanTier(paymentPlanId) {
    switch (paymentPlanId) {
        case 'hobby':
            return 'starter';
        case 'pro':
            return 'pro';
        case 'credits10':
            return null;
        default:
            return null;
    }
}
function getSubscriptionPriceId(subscription) {
    return subscription.items.data[0]?.price?.id ?? null;
}
function getPlanTierFromSubscription(subscription) {
    const priceId = getSubscriptionPriceId(subscription);
    if (!priceId) {
        return null;
    }
    try {
        const paymentPlanId = getPaymentPlanIdByPaymentProcessorPlanId(priceId);
        return mapPaymentPlanIdToPlanTier(paymentPlanId);
    }
    catch {
        return null;
    }
}
function getCustomerId(customer) {
    if (!customer) {
        return null;
    }
    return typeof customer === 'string' ? customer : customer.id;
}
function getInvoiceSubscriptionId(invoice) {
    const subscription = invoice.subscription;
    if (!subscription) {
        return null;
    }
    return typeof subscription === 'string' ? subscription : subscription.id;
}
async function findBillingUserByCustomerId(stripeCustomerId, userDelegate) {
    if (!stripeCustomerId) {
        return null;
    }
    return userDelegate.findUnique({
        where: { stripeCustomerId },
        select: {
            id: true,
            plan: true,
            activeWorkspaceId: true,
            stripeCustomerId: true,
            stripeSubscriptionId: true,
            subscriptionStatus: true,
        },
    });
}
async function recordBillingLedgerEntry(args) {
    const executor = args.tx ?? prisma;
    if (args.processorEventId) {
        const existing = await executor.billingEventLedger.findFirst({
            where: {
                processorType: 'stripe',
                processorEventId: args.processorEventId,
                eventType: args.eventType,
            },
            select: {
                id: true,
            },
        });
        if (existing) {
            return false;
        }
    }
    await executor.billingEventLedger.create({
        data: {
            userId: args.userId ?? null,
            workspaceId: args.workspaceId ?? null,
            stripeCustomerId: args.stripeCustomerId ?? null,
            stripeSubscriptionId: args.stripeSubscriptionId ?? null,
            stripeInvoiceId: args.stripeInvoiceId ?? null,
            processorEventId: args.processorEventId ?? null,
            eventType: args.eventType,
            statusBefore: args.statusBefore ?? null,
            statusAfter: args.statusAfter ?? null,
            planBefore: args.planBefore ?? null,
            planAfter: args.planAfter ?? null,
            amount: args.amount ?? null,
            currency: args.currency ?? null,
            payload: (args.payload ?? null),
        },
    });
    return true;
}
async function updateUserSubscriptionWithLedger(args) {
    return prisma.$transaction(async (tx) => {
        const existingLedgerEntry = await tx.billingEventLedger.findFirst({
            where: {
                processorType: 'stripe',
                processorEventId: args.processorEventId,
                eventType: args.eventType,
            },
            select: {
                id: true,
            },
        });
        const user = await tx.user.findUnique({
            where: { stripeCustomerId: args.stripeCustomerId },
            select: {
                id: true,
                plan: true,
                activeWorkspaceId: true,
                stripeCustomerId: true,
                stripeSubscriptionId: true,
                subscriptionStatus: true,
            },
        });
        if (!user) {
            return null;
        }
        let createdLedgerEntry = false;
        if (!existingLedgerEntry) {
            await tx.user.update({
                where: { stripeCustomerId: args.stripeCustomerId },
                data: {
                    subscriptionStatus: args.nextSubscriptionStatus,
                    ...(args.nextPlan ? { plan: args.nextPlan } : {}),
                },
            });
            createdLedgerEntry = await recordBillingLedgerEntry({
                tx,
                userId: user.id,
                workspaceId: user.activeWorkspaceId,
                stripeCustomerId: args.stripeCustomerId,
                stripeSubscriptionId: args.stripeSubscriptionId ?? user.stripeSubscriptionId,
                stripeInvoiceId: args.stripeInvoiceId ?? null,
                processorEventId: args.processorEventId,
                eventType: args.eventType,
                statusBefore: user.subscriptionStatus,
                statusAfter: args.nextSubscriptionStatus,
                planBefore: user.plan,
                planAfter: args.nextPlan ?? user.plan,
                amount: args.amount ?? null,
                currency: args.currency ?? null,
                payload: args.payload,
            });
        }
        return {
            user: {
                ...user,
                plan: (args.nextPlan ?? user.plan),
                subscriptionStatus: args.nextSubscriptionStatus,
                stripeSubscriptionId: args.stripeSubscriptionId ?? user.stripeSubscriptionId,
            },
            createdLedgerEntry,
        };
    });
}
export async function handleStripeSubscriptionUpdatedEvent(event, _userDelegate) {
    const subscription = event.data.object;
    const stripeCustomerId = getCustomerId(subscription.customer);
    if (!stripeCustomerId) {
        return;
    }
    const subscriptionStatus = getOpenSaasSubscriptionStatus(subscription);
    if (!subscriptionStatus) {
        return;
    }
    const mappedPlan = getPlanTierFromSubscription(subscription);
    const billingUpdate = await updateUserSubscriptionWithLedger({
        stripeCustomerId,
        processorEventId: event.id,
        eventType: 'billing.subscription.updated',
        nextSubscriptionStatus: subscriptionStatus,
        nextPlan: mappedPlan,
        stripeSubscriptionId: subscription.id,
        payload: subscription,
    });
    if (!billingUpdate) {
        return;
    }
    const { user: updatedUser, createdLedgerEntry } = billingUpdate;
    if (!createdLedgerEntry) {
        return;
    }
    await publishAndRouteCanonicalEventSafely(createCanonicalEventInput('billing.subscription.updated', 'stripe.webhook', {
        stripeEventId: event.id,
        stripeCustomerId,
        stripeSubscriptionId: subscription.id,
        subscriptionStatus,
        planTier: mappedPlan ?? updatedUser.plan,
    }, {
        userId: updatedUser.id,
        workspaceId: updatedUser.activeWorkspaceId,
        entityType: 'subscription',
        entityId: subscription.id,
        correlationId: event.id,
    }), 'billing.subscription.updated');
}
export async function handleStripeSubscriptionDeletedEvent(event, _userDelegate) {
    const subscription = event.data.object;
    const stripeCustomerId = getCustomerId(subscription.customer);
    if (!stripeCustomerId) {
        return;
    }
    const billingUpdate = await updateUserSubscriptionWithLedger({
        stripeCustomerId,
        processorEventId: event.id,
        eventType: 'billing.subscription.deleted',
        nextSubscriptionStatus: SubscriptionStatus.Deleted,
        stripeSubscriptionId: subscription.id,
        payload: subscription,
    });
    if (!billingUpdate) {
        return;
    }
    const { user: updatedUser, createdLedgerEntry } = billingUpdate;
    if (!createdLedgerEntry) {
        return;
    }
    await publishAndRouteCanonicalEventSafely(createCanonicalEventInput('billing.subscription.deleted', 'stripe.webhook', {
        stripeEventId: event.id,
        stripeCustomerId,
        stripeSubscriptionId: subscription.id,
        subscriptionStatus: SubscriptionStatus.Deleted,
    }, {
        userId: updatedUser.id,
        workspaceId: updatedUser.activeWorkspaceId,
        entityType: 'subscription',
        entityId: subscription.id,
        correlationId: event.id,
    }), 'billing.subscription.deleted');
}
export async function handleStripeInvoicePaidEvent(event, userDelegate) {
    const invoice = event.data.object;
    const stripeCustomerId = getCustomerId(invoice.customer);
    const user = await findBillingUserByCustomerId(stripeCustomerId, userDelegate);
    if (!user || !stripeCustomerId) {
        return;
    }
    const createdLedgerEntry = await recordBillingLedgerEntry({
        userId: user.id,
        workspaceId: user.activeWorkspaceId,
        stripeCustomerId,
        stripeSubscriptionId: getInvoiceSubscriptionId(invoice),
        stripeInvoiceId: invoice.id,
        processorEventId: event.id,
        eventType: 'billing.invoice.paid',
        statusBefore: user.subscriptionStatus,
        statusAfter: user.subscriptionStatus,
        planBefore: user.plan,
        planAfter: user.plan,
        amount: invoice.amount_paid ?? null,
        currency: invoice.currency ?? null,
        payload: invoice,
    });
    if (!createdLedgerEntry) {
        return;
    }
    await publishAndRouteCanonicalEventSafely(createCanonicalEventInput('billing.invoice.paid', 'stripe.webhook', {
        stripeEventId: event.id,
        stripeCustomerId,
        stripeInvoiceId: invoice.id,
        amountPaid: invoice.amount_paid ?? null,
        currency: invoice.currency ?? null,
    }, {
        userId: user.id,
        workspaceId: user.activeWorkspaceId,
        entityType: 'invoice',
        entityId: invoice.id,
        correlationId: event.id,
    }), 'billing.invoice.paid');
}
export async function handleStripeInvoicePaymentFailedEvent(event, userDelegate) {
    const invoice = event.data.object;
    const stripeCustomerId = getCustomerId(invoice.customer);
    const user = await findBillingUserByCustomerId(stripeCustomerId, userDelegate);
    if (!user || !stripeCustomerId) {
        return;
    }
    const createdLedgerEntry = await recordBillingLedgerEntry({
        userId: user.id,
        workspaceId: user.activeWorkspaceId,
        stripeCustomerId,
        stripeSubscriptionId: getInvoiceSubscriptionId(invoice),
        stripeInvoiceId: invoice.id,
        processorEventId: event.id,
        eventType: 'billing.invoice.payment_failed',
        statusBefore: user.subscriptionStatus,
        statusAfter: user.subscriptionStatus,
        planBefore: user.plan,
        planAfter: user.plan,
        amount: invoice.amount_due ?? null,
        currency: invoice.currency ?? null,
        payload: invoice,
    });
    if (!createdLedgerEntry) {
        return;
    }
    await publishAndRouteCanonicalEventSafely(createCanonicalEventInput('billing.invoice.payment_failed', 'stripe.webhook', {
        stripeEventId: event.id,
        stripeCustomerId,
        stripeInvoiceId: invoice.id,
        amountDue: invoice.amount_due ?? null,
        currency: invoice.currency ?? null,
    }, {
        userId: user.id,
        workspaceId: user.activeWorkspaceId,
        entityType: 'invoice',
        entityId: invoice.id,
        correlationId: event.id,
    }), 'billing.invoice.payment_failed');
}
export function getOpenSaasSubscriptionStatus(subscription) {
    const stripeToOpenSaasSubscriptionStatus = {
        trialing: SubscriptionStatus.Active,
        active: SubscriptionStatus.Active,
        past_due: SubscriptionStatus.PastDue,
        canceled: SubscriptionStatus.Deleted,
        unpaid: SubscriptionStatus.Deleted,
        incomplete_expired: SubscriptionStatus.Deleted,
        paused: undefined,
        incomplete: undefined,
    };
    const subscriptionStatus = stripeToOpenSaasSubscriptionStatus[subscription.status];
    if (subscriptionStatus === SubscriptionStatus.Active &&
        subscription.cancel_at_period_end) {
        return SubscriptionStatus.CancelAtPeriodEnd;
    }
    return subscriptionStatus;
}
//# sourceMappingURL=billingStateService.js.map
import { requireWorkspaceScopedUser } from '../../services/workspaceAccess';
export async function listBillingEvents(rawArgs, context) {
    const user = await requireWorkspaceScopedUser(context.user);
    const limit = Math.min(Math.max(rawArgs?.limit ?? 50, 1), 200);
    const events = await context.entities.BillingEventLedger.findMany({
        where: {
            OR: [
                { userId: user.id },
                { workspaceId: user.workspaceId },
            ],
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
    });
    return {
        events: events.map((event) => ({
            id: event.id,
            created_at: event.createdAt,
            event_type: event.eventType,
            processor_event_id: event.processorEventId,
            stripe_customer_id: event.stripeCustomerId,
            stripe_subscription_id: event.stripeSubscriptionId,
            stripe_invoice_id: event.stripeInvoiceId,
            status_before: event.statusBefore,
            status_after: event.statusAfter,
            plan_before: event.planBefore,
            plan_after: event.planAfter,
            amount: event.amount,
            currency: event.currency,
        })),
    };
}
//# sourceMappingURL=listBillingEvents.js.map
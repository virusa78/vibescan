// Fetch Stripe customer ID for a user
export async function fetchUserStripeCustomerId(userId, prismaUserDelegate) {
    const user = await prismaUserDelegate.findUniqueOrThrow({
        where: { id: userId },
        select: { stripeCustomerId: true },
    });
    return user.stripeCustomerId;
}
// Legacy alias for backwards compatibility
export async function fetchUserPaymentProcessorUserId(userId, prismaUserDelegate) {
    return fetchUserStripeCustomerId(userId, prismaUserDelegate);
}
export function updateUserStripeCustomerId({ userId, stripeCustomerId }, prismaUserDelegate) {
    return prismaUserDelegate.update({
        where: { id: userId },
        data: { stripeCustomerId },
    }).then(() => undefined);
}
// Legacy alias for backwards compatibility
export function updateUserPaymentProcessorUserId({ userId, paymentProcessorUserId }, prismaUserDelegate) {
    return updateUserStripeCustomerId({ userId, stripeCustomerId: paymentProcessorUserId }, prismaUserDelegate);
}
export function updateUserSubscription({ stripeCustomerId, plan, subscriptionStatus }, userDelegate) {
    return userDelegate.update({
        where: { stripeCustomerId },
        data: {
            subscriptionStatus,
            plan: plan,
        },
    }).then(() => undefined);
}
//# sourceMappingURL=user.js.map
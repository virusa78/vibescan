import { User } from "wasp/entities";
import { PrismaClient } from "wasp/server";
import { SubscriptionStatus } from "./plans";

// Fetch Stripe customer ID for a user
export async function fetchUserStripeCustomerId(
  userId: User["id"],
  prismaUserDelegate: PrismaClient["user"],
): Promise<string | null> {
  const user = await prismaUserDelegate.findUniqueOrThrow({
    where: { id: userId },
    select: { stripeCustomerId: true },
  });
  return user.stripeCustomerId;
}

// Legacy alias for backwards compatibility
export async function fetchUserPaymentProcessorUserId(
  userId: User["id"],
  prismaUserDelegate: PrismaClient["user"],
): Promise<string | null> {
  return fetchUserStripeCustomerId(userId, prismaUserDelegate);
}

// Update Stripe customer ID
interface UpdateUserStripeCustomerIdArgs {
  userId: User["id"];
  stripeCustomerId: string;
}

export function updateUserStripeCustomerId(
  { userId, stripeCustomerId }: UpdateUserStripeCustomerIdArgs,
  prismaUserDelegate: PrismaClient["user"],
): Promise<void> {
  return prismaUserDelegate.update({
    where: { id: userId },
    data: { stripeCustomerId },
  }).then(() => undefined);
}

// Legacy alias for backwards compatibility
export function updateUserPaymentProcessorUserId(
  { userId, paymentProcessorUserId }: { userId: User["id"]; paymentProcessorUserId: string },
  prismaUserDelegate: PrismaClient["user"],
): Promise<void> {
  return updateUserStripeCustomerId({ userId, stripeCustomerId: paymentProcessorUserId }, prismaUserDelegate);
}

// Update subscription status and plan
interface UpdateUserSubscriptionArgs {
  stripeCustomerId: string;
  subscriptionStatus: SubscriptionStatus;
  plan?: string;
}

export function updateUserSubscription(
  { stripeCustomerId, plan, subscriptionStatus }: UpdateUserSubscriptionArgs,
  userDelegate: PrismaClient["user"],
): Promise<void> {
  return userDelegate.update({
    where: { stripeCustomerId },
    data: {
      subscriptionStatus,
      plan: plan as any,
    },
  }).then(() => undefined);
}

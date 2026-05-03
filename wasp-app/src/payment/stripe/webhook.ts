import { type PrismaClient } from "@prisma/client";
import express from "express";
import type { Stripe } from "stripe";
import { env, type MiddlewareConfigFn } from "wasp/server";
import { type PaymentsWebhook } from "wasp/server/api";
import { UnhandledWebhookEventError } from "../errors";
import { SubscriptionStatus } from "../plans";
import { updateUserSubscription } from "../user";
import { stripeClient } from "./stripeClient";

/**
 * Stripe requires a raw request to construct events successfully.
 */
type MiddlewareRegistry = {
  delete(name: string): void;
  set(name: string, middleware: express.RequestHandler): void;
};

type StripeWebhookContext = {
  entities: {
    User: PrismaClient["user"];
  };
};

export const stripeMiddlewareConfigFn = ((middlewareConfig: MiddlewareRegistry) => {
  middlewareConfig.delete("express.json");
  middlewareConfig.set(
    "express.raw",
    express.raw({ type: "application/json" }),
  );
  return middlewareConfig;
}) as unknown as MiddlewareConfigFn;

export const stripeWebhook: PaymentsWebhook = async (
  request: express.Request,
  response: express.Response,
  context: StripeWebhookContext,
) => {
  const prismaUserDelegate = context.entities.User;
  try {
    const event = constructStripeEvent(request);

    // If you'd like to handle more events, you can add more cases below.
    // When deploying your app, you configure your webhook in the Stripe dashboard
    // to only send the events that you're handling above.
    // See: https://docs.opensaas.sh/guides/deploying/#setting-up-your-stripe-webhook
    switch (event.type) {
      case "invoice.paid":
        await handleInvoicePaid(event, prismaUserDelegate);
        break;
      case "customer.subscription.updated":
        await handleCustomerSubscriptionUpdated(event, prismaUserDelegate);
        break;
      case "customer.subscription.deleted":
        await handleCustomerSubscriptionDeleted(event, prismaUserDelegate);
        break;
      default:
        throw new UnhandledWebhookEventError(event.type);
    }
    return response.status(204).send();
  } catch (error) {
    if (error instanceof UnhandledWebhookEventError) {
      // In development, it is likely that we will receive events that we are not handling.
      // E.g. via the `stripe trigger` command.
      if (process.env.NODE_ENV === "development") {
        console.info("Unhandled Stripe webhook event in development: ", error);
      } else if (process.env.NODE_ENV === "production") {
        console.error("Unhandled Stripe webhook event in production: ", error);
      }

      // We must return a 2XX status code, otherwise Stripe will keep retrying the event.
      return response.status(204).send();
    }

    console.error("Stripe webhook error:", error);
    if (error instanceof Error) {
      return response.status(400).json({ error: error.message });
    } else {
      return response
        .status(500)
        .json({ error: "Error processing Stripe webhook event" });
    }
  }
};

function constructStripeEvent(request: express.Request): Stripe.Event {
  const stripeWebhookSecret = env.STRIPE_WEBHOOK_SECRET;
  const stripeSignature = request.headers["stripe-signature"];
  if (!stripeSignature) {
    throw new Error("Stripe webhook signature not provided");
  }

  return stripeClient.webhooks.constructEvent(
    request.body,
    stripeSignature,
    stripeWebhookSecret,
  );
}

async function handleInvoicePaid(
  _event: Stripe.InvoicePaidEvent,
  _prismaUserDelegate: PrismaClient["user"],
): Promise<void> {
  // For VibeScan, we handle subscription updates instead
  // Invoice.paid events are for recurring subscriptions
  // which are already handled by customer.subscription.updated
}

async function handleCustomerSubscriptionUpdated(
  event: Stripe.CustomerSubscriptionUpdatedEvent,
  prismaUserDelegate: PrismaClient["user"],
): Promise<void> {
  const subscription = event.data.object;

  // Get subscription status
  const subscriptionStatus = getOpenSaasSubscriptionStatus(subscription);
  if (!subscriptionStatus) {
    return;
  }

  const customerId = getCustomerId(subscription.customer);

  await updateUserSubscription(
    { stripeCustomerId: customerId, subscriptionStatus },
    prismaUserDelegate,
  );
}

function getOpenSaasSubscriptionStatus(
  subscription: Stripe.Subscription,
): SubscriptionStatus | undefined {
  const stripeToOpenSaasSubscriptionStatus: Record<
    Stripe.Subscription.Status,
    SubscriptionStatus | undefined
  > = {
    trialing: SubscriptionStatus.Active,
    active: SubscriptionStatus.Active,
    past_due: SubscriptionStatus.PastDue,
    canceled: SubscriptionStatus.Deleted,
    unpaid: SubscriptionStatus.Deleted,
    incomplete_expired: SubscriptionStatus.Deleted,
    paused: undefined,
    incomplete: undefined,
  };

  const subscriptionStatus =
    stripeToOpenSaasSubscriptionStatus[subscription.status];

  if (
    subscriptionStatus === SubscriptionStatus.Active &&
    subscription.cancel_at_period_end
  ) {
    return SubscriptionStatus.CancelAtPeriodEnd;
  }

  return subscriptionStatus;
}

async function handleCustomerSubscriptionDeleted(
  event: Stripe.CustomerSubscriptionDeletedEvent,
  prismaUserDelegate: PrismaClient["user"],
): Promise<void> {
  const subscription = event.data.object;
  const customerId = getCustomerId(subscription.customer);

  await updateUserSubscription(
    {
      stripeCustomerId: customerId,
      subscriptionStatus: SubscriptionStatus.Deleted,
    },
    prismaUserDelegate,
  );
}

function getCustomerId(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null,
): Stripe.Customer["id"] {
  if (!customer) {
    throw new Error("Customer is missing");
  } else if (typeof customer === "string") {
    return customer;
  } else {
    return customer.id;
  }
}

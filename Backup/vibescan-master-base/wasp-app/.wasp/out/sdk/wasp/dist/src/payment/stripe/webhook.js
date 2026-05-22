import express from "express";
import { env } from "wasp/server";
import { UnhandledWebhookEventError } from "../errors";
import { stripeClient } from "./stripeClient";
import { handleStripeInvoicePaidEvent, handleStripeInvoicePaymentFailedEvent, handleStripeSubscriptionDeletedEvent, handleStripeSubscriptionUpdatedEvent, } from "../../server/services/billingStateService.js";
export const stripeMiddlewareConfigFn = ((middlewareConfig) => {
    middlewareConfig.delete("express.json");
    middlewareConfig.set("express.raw", express.raw({ type: "application/json" }));
    return middlewareConfig;
});
export const stripeWebhook = async (request, response, context) => {
    const prismaUserDelegate = context.entities.User;
    try {
        const event = constructStripeEvent(request);
        // If you'd like to handle more events, you can add more cases below.
        // When deploying your app, you configure your webhook in the Stripe dashboard
        // to only send the events that you're handling above.
        // See: https://docs.opensaas.sh/guides/deploying/#setting-up-your-stripe-webhook
        switch (event.type) {
            case "invoice.paid":
                await handleStripeInvoicePaidEvent(event, prismaUserDelegate);
                break;
            case "invoice.payment_failed":
                await handleStripeInvoicePaymentFailedEvent(event, prismaUserDelegate);
                break;
            case "customer.subscription.updated":
                await handleStripeSubscriptionUpdatedEvent(event, prismaUserDelegate);
                break;
            case "customer.subscription.deleted":
                await handleStripeSubscriptionDeletedEvent(event, prismaUserDelegate);
                break;
            default:
                throw new UnhandledWebhookEventError(event.type);
        }
        return response.status(204).send();
    }
    catch (error) {
        if (error instanceof UnhandledWebhookEventError) {
            // In development, it is likely that we will receive events that we are not handling.
            // E.g. via the `stripe trigger` command.
            if (process.env.NODE_ENV === "development") {
                console.info("Unhandled Stripe webhook event in development: ", error);
            }
            else if (process.env.NODE_ENV === "production") {
                console.error("Unhandled Stripe webhook event in production: ", error);
            }
            // We must return a 2XX status code, otherwise Stripe will keep retrying the event.
            return response.status(204).send();
        }
        console.error("Stripe webhook error:", error);
        if (error instanceof Error) {
            return response.status(400).json({ error: error.message });
        }
        else {
            return response
                .status(500)
                .json({ error: "Error processing Stripe webhook event" });
        }
    }
};
function constructStripeEvent(request) {
    const stripeWebhookSecret = env.STRIPE_WEBHOOK_SECRET;
    const stripeSignature = request.headers["stripe-signature"];
    if (!stripeSignature) {
        throw new Error("Stripe webhook signature not provided");
    }
    return stripeClient.webhooks.constructEvent(request.body, stripeSignature, stripeWebhookSecret);
}
//# sourceMappingURL=webhook.js.map
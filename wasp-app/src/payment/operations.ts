import { HttpError } from "wasp/server";
import type {
  GenerateCheckoutSession,
  GetCustomerPortalUrl,
  GetBillingPlans,
} from "wasp/server/operations";
import * as z from "zod";
import { PaymentPlanId, paymentPlans, UnifiedPlan, unifiedPlans } from "../payment/plans";
import { ensureArgsSchemaOrThrowHttpError } from "../server/validation";
import { paymentProcessor } from "./paymentProcessor";

export type CheckoutSession = {
  sessionUrl: string | null;
  sessionId: string;
};

const generateCheckoutSessionSchema = z.nativeEnum(PaymentPlanId);

type GenerateCheckoutSessionInput = z.infer<
  typeof generateCheckoutSessionSchema
>;

export const generateCheckoutSession: GenerateCheckoutSession<
  GenerateCheckoutSessionInput,
  CheckoutSession
> = async (rawPaymentPlanId, context) => {
  if (!context.user) {
    throw new HttpError(
      401,
      "Only authenticated users are allowed to perform this operation",
    );
  }

  const paymentPlanId = ensureArgsSchemaOrThrowHttpError(
    generateCheckoutSessionSchema,
    rawPaymentPlanId,
  );
  const userId = context.user.id;
  const userEmail = context.user.email;
  if (!userEmail) {
    // If using the usernameAndPassword Auth method, switch to an Auth method that provides an email.
    throw new HttpError(403, "User needs an email to make a payment.");
  }

  // Support local mock payments in development/test or if explicitly configured
  if (process.env.NODE_ENV === "development" || process.env.MOCK_PAYMENTS === "true") {
    let planTier: string = "free_trial";
    let status: string = "deleted";

    if (paymentPlanId === PaymentPlanId.Hobby) {
      planTier = "starter";
      status = "active";
    } else if (paymentPlanId === PaymentPlanId.Pro) {
      planTier = "pro";
      status = "active";
    } else if (paymentPlanId === PaymentPlanId.Credits10) {
      // One-time payment for 10 credits
      await context.entities.User.update({
        where: { id: userId },
        data: {
          monthlyQuotaLimit: { increment: 10 },
        },
      });

      if (context.user.activeWorkspaceId) {
        try {
          const { queueHubspotSync } = await import("../server/services/hubspotIntegrationService.js");
          await queueHubspotSync(context.user.activeWorkspaceId, {
            trigger: "webhook",
            userId: context.user.id,
            force: true,
          });
        } catch (error) {
          console.error("Failed to queue HubSpot sync on credits purchase:", error);
        }
      }

      return {
        sessionUrl: "/billing",
        sessionId: "mock_session_credits_" + Date.now(),
      };
    }

    await context.entities.User.update({
      where: { id: userId },
      data: {
        plan: planTier as any,
        subscriptionStatus: status,
      },
    });

    if (context.user.activeWorkspaceId) {
      try {
        const { queueHubspotSync } = await import("../server/services/hubspotIntegrationService.js");
        await queueHubspotSync(context.user.activeWorkspaceId, {
          trigger: "webhook",
          userId: context.user.id,
          force: true,
        });
      } catch (error) {
        console.error("Failed to queue HubSpot sync on plan change:", error);
      }
    }

    return {
      sessionUrl: "/billing",
      sessionId: "mock_session_subscription_" + Date.now(),
    };
  }

  const paymentPlan = paymentPlans[paymentPlanId];
  const { session } = await paymentProcessor.createCheckoutSession({
    userId,
    userEmail,
    paymentPlan,
    prismaUserDelegate: context.entities.User,
  });

  return {
    sessionUrl: session.url,
    sessionId: session.id,
  };
};

export const getCustomerPortalUrl: GetCustomerPortalUrl<
  void,
  string | null
> = async (_args, context) => {
  if (!context.user) {
    throw new HttpError(
      401,
      "Only authenticated users are allowed to perform this operation",
    );
  }

  return paymentProcessor.fetchCustomerPortalUrl({
    userId: context.user.id,
    prismaUserDelegate: context.entities.User,
  });
};

export const getBillingPlans: GetBillingPlans<void, UnifiedPlan[]> = async (_args, _context) => {
  return unifiedPlans;
};


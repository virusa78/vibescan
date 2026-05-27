import { CheckCircle } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "wasp/client/auth";
import {
  generateCheckoutSession,
  getCustomerPortalUrl,
  getBillingPlans,
  useQuery,
} from "wasp/client/operations";
import { Alert, AlertDescription } from "../client/components/ui/alert";
import { Button } from "../client/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardTitle,
} from "../client/components/ui/card";
import { cn } from "../client/utils";
import { developerSecurityTitle } from "../client/utils/productVocabulary";
import {
  PaymentPlanId,
  paymentPlans,
  prettyPaymentPlanName,
  SubscriptionStatus,
  unifiedPlans as localUnifiedPlans,
} from "./plans";

const bestDealPaymentPlanId: PaymentPlanId = PaymentPlanId.Pro;

const PricingPage = () => {
  const [isPaymentLoading, setIsPaymentLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { data: user } = useAuth();
  const isUserSubscribed =
    !!user &&
    !!user.subscriptionStatus &&
    user.subscriptionStatus !== SubscriptionStatus.Deleted;

  const {
    data: customerPortalUrl,
    isLoading: isCustomerPortalUrlLoading,
    error: customerPortalUrlError,
  } = useQuery(getCustomerPortalUrl, { enabled: isUserSubscribed });

  const { data: unifiedPlans } = useQuery(getBillingPlans);
  const activePlans = unifiedPlans || localUnifiedPlans;
  const purchasablePlans = activePlans.filter((p) => p.paymentPlanId !== undefined);

  const navigate = useNavigate();

  async function handleBuyNowClick(paymentPlanId: PaymentPlanId) {
    if (!user) {
      navigate("/login");
      return;
    }
    try {
      setIsPaymentLoading(true);

      const checkoutResults = await generateCheckoutSession(paymentPlanId);

      if (checkoutResults?.sessionUrl) {
        window.open(checkoutResults.sessionUrl, "_self");
      } else {
        throw new Error("Error generating checkout session URL");
      }
    } catch (error: unknown) {
      console.error(error);
      if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Error processing payment. Please try again later.");
      }
      setIsPaymentLoading(false); // We only set this to false here and not in the try block because we redirect to the checkout url within the same window
    }
  }

  const handleCustomerPortalClick = () => {
    if (!user) {
      navigate("/login");
      return;
    }

    if (customerPortalUrlError) {
      setErrorMessage("Error fetching Customer Portal URL");
      return;
    }

    if (!customerPortalUrl) {
      setErrorMessage(`Customer Portal does not exist for user ${user.id}`);
      return;
    }

    window.open(customerPortalUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="py-10 lg:mt-10">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div id="pricing" className="mx-auto max-w-4xl text-center">
          <h2 className="text-foreground mt-2 text-4xl font-bold tracking-tight sm:text-5xl">
            Pick your <span className="text-primary">plan</span>
          </h2>
          <p className="text-muted-foreground mt-4 text-sm">
            {developerSecurityTitle} pricing stays in product language: plans, entitlements, and billing actions.
          </p>
        </div>
        <p className="text-muted-foreground mx-auto mt-6 max-w-2xl text-center text-lg leading-8">
          Choose the plan that matches your scan volume and reporting needs. The
          billing shell keeps the current plan, usage, and upgrade path in one place,
          while this page stays focused on plan comparison.
        </p>
        {errorMessage && (
          <Alert variant="destructive" className="mt-8">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}
        <div className="isolate mx-auto mt-16 grid max-w-md grid-cols-1 gap-y-10 sm:mt-20 lg:mx-0 lg:max-w-none lg:grid-cols-3 lg:gap-x-8">
          {purchasablePlans.map((plan) => (
            <Card
              key={plan.id}
              className={cn(
                "relative flex grow flex-col justify-between overflow-hidden rounded-2xl border transition-all duration-500 hover:-translate-y-1.5",
                plan.paymentPlanId === bestDealPaymentPlanId
                  ? "border-primary/50 bg-slate-900/40 dark:bg-slate-950/60 backdrop-blur-md shadow-2xl shadow-primary/10 ring-1 ring-primary/30"
                  : "border-border/60 bg-slate-900/10 dark:bg-slate-950/20 backdrop-blur-sm hover:border-border hover:shadow-xl lg:my-4"
              )}
            >
              {plan.paymentPlanId === bestDealPaymentPlanId && (
                <>
                  <div
                    className="absolute top-0 right-0 -z-10 h-full w-full transform-gpu blur-3xl"
                    aria-hidden="true"
                  >
                    <div
                      className="from-primary/40 via-primary/20 to-primary/10 absolute h-full w-full bg-linear-to-br opacity-30"
                      style={{
                        clipPath: "circle(670% at 50% 50%)",
                      }}
                    />
                  </div>
                  <div className="absolute top-4 right-4 z-10">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary border border-primary/20 shadow-sm shadow-primary/5">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                      Popular
                    </span>
                  </div>
                </>
              )}
              <CardContent className="h-full justify-between p-8 xl:p-10 flex flex-col">
                <div>
                  <CardTitle
                    id={plan.id}
                    className="text-foreground text-xl font-bold tracking-tight"
                  >
                    {plan.name}
                  </CardTitle>
                  <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
                    {plan.description}
                  </p>
                </div>

                <div className="mt-6 border-b border-border/40 pb-6">
                  <p className="flex items-baseline gap-x-2">
                    <span className="text-foreground text-5xl font-extrabold tracking-tight bg-gradient-to-br from-foreground to-foreground/80 bg-clip-text text-transparent">
                      {plan.price}
                    </span>
                    <span className="text-muted-foreground text-sm font-medium">
                      {plan.isSubscription ? "/ month" : " one-time"}
                    </span>
                  </p>
                </div>

                <ul
                  role="list"
                  className="text-muted-foreground mt-8 space-y-4 text-sm leading-6 flex-grow"
                >
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-x-3">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary border border-primary/20 mt-0.5 shadow-sm">
                        <CheckCircle className="h-3 w-3" />
                      </span>
                      <span className="text-foreground/90 font-medium">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter className="p-8 pt-0">
                {isUserSubscribed ? (
                  <Button
                    onClick={handleCustomerPortalClick}
                    disabled={isCustomerPortalUrlLoading}
                    aria-describedby="manage-subscription"
                    className={cn(
                      "w-full h-11 transition-all duration-300 font-bold tracking-wide rounded-xl",
                      plan.paymentPlanId === bestDealPaymentPlanId
                        ? "bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/25 hover:shadow-primary/35 hover:-translate-y-0.5"
                        : "border border-border/80 hover:bg-accent/50 text-foreground"
                    )}
                  >
                    Manage Subscription
                  </Button>
                ) : (
                  <Button
                    onClick={() => plan.paymentPlanId && handleBuyNowClick(plan.paymentPlanId)}
                    aria-describedby={plan.id}
                    disabled={isPaymentLoading}
                    className={cn(
                      "w-full h-11 transition-all duration-300 font-bold tracking-wide rounded-xl",
                      plan.paymentPlanId === bestDealPaymentPlanId
                        ? "bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/25 hover:shadow-primary/35 hover:-translate-y-0.5"
                        : "border border-border/80 hover:bg-accent/50 text-foreground"
                    )}
                  >
                    {!!user ? "Upgrade Plan" : "Log in to continue"}
                  </Button>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PricingPage;

import { useMemo } from "react";
import { Link as WaspRouterLink, routes } from "wasp/client/router";
import { useAuth } from "wasp/client/auth";
import { getCustomerPortalUrl, getProfileSettings, useQuery } from "wasp/client/operations";
import { Alert, AlertDescription } from "../client/components/ui/alert";
import { Badge } from "../client/components/ui/badge";
import { Button } from "../client/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../client/components/ui/card";
import {
  actionVerbLabels,
  billingPlanLabels,
  billingPlanSummaries,
  getBillingPlanLabel,
  getBillingStateLabel,
  getBillingPlanSummary,
  type BillingPlanTier,
} from "../client/utils/productVocabulary";

type BillingProfile = {
  plan_tier: BillingPlanTier;
  subscription_status: string | null;
  monthly_quota_used: number;
  monthly_quota_limit: number;
};

const planEntitlements: Record<BillingPlanTier, string[]> = {
  free_trial: [
    "Core scan submissions",
    "Workspace-aware reporting",
    "Basic dashboard and findings access",
  ],
  starter: [
    "Higher monthly scan limits",
    "Saved views and notifications",
    "Workspace-level billing visibility",
  ],
  pro: [
    "GitHub-triggered scans and richer findings",
    "Remediation workflows and reporting depth",
    "Priority support path",
  ],
  enterprise: [
    "Higher throughput and team controls",
    "Internal admin oversight and support lookup",
    "Full control-plane visibility",
  ],
};

function nextPlan(plan: BillingPlanTier): BillingPlanTier {
  switch (plan) {
    case "free_trial":
      return "starter";
    case "starter":
      return "pro";
    case "pro":
      return "enterprise";
    case "enterprise":
      return "enterprise";
  }
}

export default function BillingPage() {
  const { data: user } = useAuth();
  const { data: profileData, error } = useQuery(getProfileSettings, {}, {
    enabled: Boolean(user),
  });
  const profile = (profileData ?? null) as BillingProfile | null;
  const currentPlan = profile?.plan_tier ?? (user?.plan as BillingPlanTier | undefined) ?? "free_trial";
  const billingStatus = profile?.subscription_status ?? user?.subscriptionStatus ?? null;
  const currentLabel = getBillingPlanLabel(currentPlan);
  const currentSummary = getBillingPlanSummary(currentPlan);
  const portalEnabled = Boolean(billingStatus && billingStatus !== "deleted");
  const { data: portalUrl } = useQuery(getCustomerPortalUrl, {}, {
    enabled: portalEnabled,
  });

  const remaining = useMemo(() => {
    const used = profile?.monthly_quota_used ?? user?.monthlyQuotaUsed ?? 0;
    const limit = profile?.monthly_quota_limit ?? user?.monthlyQuotaLimit ?? 0;
    return {
      used,
      limit,
      free: Math.max(limit - used, 0),
    };
  }, [profile, user]);

  if (!user) {
    return (
      <div className="mx-auto flex min-h-screen max-w-4xl items-center px-6 py-16">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Billing</CardTitle>
            <CardDescription>Sign in to review your plan and usage.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="space-y-1">
          <Badge variant="secondary">Billing shell</Badge>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Billing</h1>
          <p className="text-sm text-muted-foreground">
            Review the current plan, what it unlocks, and the path to upgrade or manage the subscription.
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{String(error)}</AlertDescription>
          </Alert>
        )}

        {billingStatus && billingStatus !== "active" ? (
          <Alert>
            <AlertDescription>
              Billing status is {getBillingStateLabel(billingStatus)}. Open the billing portal or update the plan to restore normal service.
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <Card>
            <CardHeader>
              <CardTitle>{currentLabel}</CardTitle>
              <CardDescription>{currentSummary}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-lg border border-border/60 p-4">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Plan</div>
                  <div className="mt-2 text-2xl font-semibold">{currentLabel}</div>
                </div>
                <div className="rounded-lg border border-border/60 p-4">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Billing state</div>
                  <div className="mt-2 text-2xl font-semibold">{getBillingStateLabel(billingStatus)}</div>
                </div>
                <div className="rounded-lg border border-border/60 p-4">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Usage</div>
                  <div className="mt-2 text-2xl font-semibold">{remaining.used}/{remaining.limit}</div>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button asChild>
                  <WaspRouterLink to={routes.PricingPageRoute.to}>{actionVerbLabels.browsePlans}</WaspRouterLink>
                </Button>
                {portalUrl ? (
                  <Button asChild variant="outline">
                    <a href={portalUrl} target="_blank" rel="noreferrer">
                      {actionVerbLabels.manageBilling}
                    </a>
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Usage and limits</CardTitle>
              <CardDescription>Monthly quota and available headroom.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-lg border border-border/60 p-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Scans used</div>
                <div className="mt-2 text-3xl font-semibold">{remaining.used}</div>
              </div>
              <div className="rounded-lg border border-border/60 p-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Remaining</div>
                <div className="mt-2 text-3xl font-semibold">{remaining.free}</div>
              </div>
              <div className="rounded-lg border border-border/60 p-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Limit</div>
                <div className="mt-2 text-3xl font-semibold">{remaining.limit}</div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {(Object.keys(planEntitlements) as BillingPlanTier[]).map((plan) => (
            <Card key={plan} className={plan === currentPlan ? "border-primary/50" : ""}>
              <CardHeader>
                <CardTitle>{billingPlanLabels[plan]}</CardTitle>
                <CardDescription>{billingPlanSummaries[plan]}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {planEntitlements[plan].map((item) => (
                    <li key={item}>• {item}</li>
                  ))}
                </ul>
                {plan === currentPlan ? (
                  <Badge>Current plan</Badge>
                ) : (
                  <Button asChild variant={plan === nextPlan(currentPlan) ? "default" : "outline"} className="w-full">
                    <WaspRouterLink to={routes.PricingPageRoute.to}>
                      {plan === nextPlan(currentPlan) ? "Upgrade next" : "Review upgrade"}
                    </WaspRouterLink>
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </main>
  );
}

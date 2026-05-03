import { useEffect, useState } from "react";
import { useAuth } from "wasp/client/auth";
import { Link as WaspRouterLink, routes } from "wasp/client/router";
import { Button } from "../client/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../client/components/ui/card";
import { Separator } from "../client/components/ui/separator";
import { apiFetch } from "../client/utils/api";
import {
  getAccountDisplayValues,
  type AccountProfile,
} from "./accountDisplay";

export default function AccountPage() {
  const { data: user } = useAuth();
  const [profile, setProfile] = useState<AccountProfile | null>(null);

  useEffect(() => {
    if (!user) {
      return;
    }

    let cancelled = false;

    void (async () => {
      const response = await apiFetch("/api/v1/settings/profile");
      if (!response.ok) {
        throw new Error("Failed to load profile settings");
      }

      const data = (await response.json()) as AccountProfile;
      if (!cancelled) {
        setProfile(data);
      }
    })().catch((error) => {
      console.error("Failed to load profile settings:", error);
      if (!cancelled) {
        setProfile(null);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!user) {
    return <div>Loading...</div>;
  }

  const {
    email,
    planTier,
    subscriptionStatus,
    monthlyQuotaUsed,
    monthlyQuotaLimit,
    organizationName,
    organizationSlug,
    activeWorkspaceName,
    activeWorkspaceSlug,
    activeWorkspaceRole,
    workspaceCount,
  } = getAccountDisplayValues(user, profile);

  return (
    <div className="mt-10 px-6">
      <Card className="mb-4 lg:m-8">
        <CardHeader>
          <CardTitle className="text-foreground text-base font-semibold leading-6">
            Account Information
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="space-y-0">
            {!!email && (
              <div className="px-6 py-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 sm:gap-4">
                  <div className="text-muted-foreground text-sm font-medium">
                    Email address
                  </div>
                  <div className="text-foreground mt-1 text-sm sm:col-span-2 sm:mt-0">
                    {email}
                  </div>
                </div>
              </div>
            )}
            <Separator />
            {organizationName && (
              <>
                <div className="px-6 py-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 sm:gap-4">
                    <div className="text-muted-foreground text-sm font-medium">
                      Organization
                    </div>
                    <div className="text-foreground mt-1 text-sm sm:col-span-2 sm:mt-0">
                      {organizationName}
                      {organizationSlug ? ` (${organizationSlug})` : ""}
                    </div>
                  </div>
                </div>
                <Separator />
              </>
            )}
            {activeWorkspaceName && (
              <>
                <div className="px-6 py-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 sm:gap-4">
                    <div className="text-muted-foreground text-sm font-medium">
                      Active Workspace
                    </div>
                    <div className="text-foreground mt-1 text-sm sm:col-span-2 sm:mt-0">
                      {activeWorkspaceName}
                      {activeWorkspaceSlug ? ` (${activeWorkspaceSlug})` : ""}
                      {activeWorkspaceRole ? ` · ${activeWorkspaceRole}` : ""}
                    </div>
                  </div>
                </div>
                <Separator />
              </>
            )}
            {workspaceCount > 0 && (
              <>
                <div className="px-6 py-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 sm:gap-4">
                    <div className="text-muted-foreground text-sm font-medium">
                      Available Workspaces
                    </div>
                    <div className="text-foreground mt-1 text-sm sm:col-span-2 sm:mt-0">
                      {workspaceCount}
                    </div>
                  </div>
                </div>
                <Separator />
              </>
            )}
            <div className="px-6 py-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 sm:gap-4">
                <div className="text-muted-foreground text-sm font-medium">
                  Your Plan
                </div>
                <div className="text-foreground mt-1 text-sm sm:col-span-2 sm:mt-0">
                  {planTier}
                </div>
              </div>
            </div>
            <Separator />
            <div className="px-6 py-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 sm:gap-4">
                <div className="text-muted-foreground text-sm font-medium">
                  Monthly Quota
                </div>
                <div className="text-foreground mt-1 text-sm sm:col-span-1 sm:mt-0">
                  {monthlyQuotaUsed} / {monthlyQuotaLimit}
                </div>
              </div>
            </div>
            <Separator />
            <div className="px-6 py-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 sm:gap-4">
                <div className="text-muted-foreground text-sm font-medium">
                  Subscription
                </div>
                <div className="text-foreground mt-1 text-sm sm:col-span-2 sm:mt-0">
                  {subscriptionStatus}
                </div>
                <WaspRouterLink to={routes.PricingPageRoute.to}>
                  <Button className="ml-auto">Manage Billing</Button>
                </WaspRouterLink>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

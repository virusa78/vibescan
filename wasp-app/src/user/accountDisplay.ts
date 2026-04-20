export type AccountProfile = {
  email: string;
  plan_tier: string;
  subscription_status: string | null;
  monthly_quota_used: number;
  monthly_quota_limit: number;
};

export type AccountUser = {
  email?: string | null;
  plan?: string | null;
  subscriptionStatus?: string | null;
  monthlyQuotaUsed?: number | null;
  monthlyQuotaLimit?: number | null;
};

export function getAccountDisplayValues(
  user: AccountUser,
  profile?: AccountProfile | null,
) {
  return {
    email: profile?.email ?? user.email ?? "",
    planTier: profile?.plan_tier ?? user.plan ?? "free_trial",
    subscriptionStatus:
      profile?.subscription_status ?? user.subscriptionStatus ?? "inactive",
    monthlyQuotaUsed:
      profile?.monthly_quota_used ?? user.monthlyQuotaUsed ?? 0,
    monthlyQuotaLimit:
      profile?.monthly_quota_limit ?? user.monthlyQuotaLimit ?? 0,
  };
}

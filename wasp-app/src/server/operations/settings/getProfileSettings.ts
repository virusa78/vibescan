import { HttpError, prisma } from 'wasp/server';

export type ProfileResponse = {
  id: string;
  name: string | null;
  email: string;
  region: string;
  plan_tier: string;
  subscription_status: string | null;
  monthly_quota_used: number;
  monthly_quota_limit: number;
  org_id: string | null;
  org_role: string | null;
};

export async function getProfileSettings(
  _args: any,
  context: any
): Promise<ProfileResponse> {
  if (!context.user) {
    throw new HttpError(401, 'User not authenticated');
  }

  const user = await prisma.user.findUnique({
    where: { id: context.user.id },
    include: {
      organizations: {
        select: {
          id: true,
          ownerUserId: true,
        },
        take: 1,
      },
    },
  });

  if (!user) {
    throw new HttpError(404, 'User not found');
  }

  const org = user.organizations[0] || null;

  return {
    id: user.id,
    name: user.displayName || null,
    email: user.email,
    region: user.region,
    plan_tier: user.plan,
    subscription_status: user.subscriptionStatus,
    monthly_quota_used: user.monthlyQuotaUsed,
    monthly_quota_limit: user.monthlyQuotaLimit,
    org_id: org?.id || null,
    org_role: org?.ownerUserId === user.id ? 'owner' : org ? 'member' : null,
  };
}

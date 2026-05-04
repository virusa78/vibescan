import { getAccountDisplayValues } from '../src/user/accountDisplay';

describe('getAccountDisplayValues', () => {
  test('prefers profile api values over auth cache values', () => {
    expect(
      getAccountDisplayValues(
        {
          email: 'arjun@example.com',
          plan: 'free_trial',
          subscriptionStatus: 'inactive',
          monthlyQuotaUsed: 1,
          monthlyQuotaLimit: 10,
        },
        {
          email: 'arjun@example.com',
          plan_tier: 'pro',
          subscription_status: 'active',
          monthly_quota_used: 8,
          monthly_quota_limit: 100,
        },
      ),
    ).toEqual({
      email: 'arjun@example.com',
      planTier: 'pro',
      subscriptionStatus: 'active',
      monthlyQuotaUsed: 8,
      monthlyQuotaLimit: 100,
      organizationName: null,
      organizationSlug: null,
      activeWorkspaceName: null,
      activeWorkspaceSlug: null,
      activeWorkspaceRole: null,
      workspaceCount: 0,
    });
  });
});

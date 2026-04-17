import type { User } from 'wasp/entities';
import { HttpError } from 'wasp/server';

export interface QuotaStatusResponse {
  used: number;
  limit: number;
  percentage: number;
  monthly_reset_date: Date;
  usage_trend: 'increasing' | 'decreasing' | 'stable';
}

export async function getQuotaStatus(rawArgs: any, context: any): Promise<QuotaStatusResponse> {
  if (!context.user) {
    throw new HttpError(401, 'User not authenticated');
  }

  // Get user's quota information
  const user = await context.entities.User.findUnique({
    where: { id: context.user.id },
    select: {
      monthlyQuotaUsed: true,
      monthlyQuotaLimit: true,
      quotaResetDate: true,
      scans: {
        where: {
          createdAt: {
            gte: new Date(new Date().getTime() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
          },
        },
        select: {
          createdAt: true,
        },
      },
    },
  });

  if (!user) {
    throw new HttpError(404, 'User not found');
  }

  const percentage =
    user.monthlyQuotaLimit > 0
      ? Math.round((user.monthlyQuotaUsed / user.monthlyQuotaLimit) * 100)
      : 0;

  // Calculate usage trend based on recent scans
  let usageTrend: 'increasing' | 'decreasing' | 'stable' = 'stable';
  
  if (user.scans && user.scans.length > 0) {
    // Sort scans by date
    const sortedScans = user.scans.sort(
      (a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    // Split into first half and second half of week
    const midpoint = Math.floor(sortedScans.length / 2);
    const firstHalf = sortedScans.slice(0, midpoint).length;
    const secondHalf = sortedScans.slice(midpoint).length;

    if (secondHalf > firstHalf * 1.2) {
      usageTrend = 'increasing';
    } else if (secondHalf < firstHalf * 0.8) {
      usageTrend = 'decreasing';
    } else {
      usageTrend = 'stable';
    }
  }

  return {
    used: user.monthlyQuotaUsed,
    limit: user.monthlyQuotaLimit,
    percentage,
    monthly_reset_date: user.quotaResetDate,
    usage_trend: usageTrend,
  };
}

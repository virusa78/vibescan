import { HttpError, prisma } from 'wasp/server';
import { buildWorkspaceOrLegacyOwnerWhere, requireWorkspaceScopedUser, } from '../../services/workspaceAccess';
export async function getQuotaStatus(_rawArgs, context) {
    const user = await requireWorkspaceScopedUser(context.user);
    const recentWindowStart = new Date(new Date().getTime() - 7 * 24 * 60 * 60 * 1000);
    // Get user's quota information
    const userRecord = await prisma.user.findUnique({
        where: { id: user.id },
        select: {
            monthlyQuotaUsed: true,
            monthlyQuotaLimit: true,
            quotaResetDate: true,
        },
    });
    if (!userRecord) {
        throw new HttpError(404, 'User not found');
    }
    const recentScans = await prisma.scan.findMany({
        where: {
            ...buildWorkspaceOrLegacyOwnerWhere(user),
            createdAt: {
                gte: recentWindowStart,
            },
        },
        select: {
            createdAt: true,
        },
    });
    const percentage = userRecord.monthlyQuotaLimit > 0
        ? Math.round((userRecord.monthlyQuotaUsed / userRecord.monthlyQuotaLimit) * 100)
        : 0;
    // Calculate usage trend based on recent scans
    let usageTrend = 'stable';
    if (recentScans.length > 0) {
        // Sort scans by date
        const sortedScans = [...recentScans].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        // Split into first half and second half of week
        const midpoint = Math.floor(sortedScans.length / 2);
        const firstHalf = sortedScans.slice(0, midpoint).length;
        const secondHalf = sortedScans.slice(midpoint).length;
        if (secondHalf > firstHalf * 1.2) {
            usageTrend = 'increasing';
        }
        else if (secondHalf < firstHalf * 0.8) {
            usageTrend = 'decreasing';
        }
        else {
            usageTrend = 'stable';
        }
    }
    return {
        used: userRecord.monthlyQuotaUsed,
        limit: userRecord.monthlyQuotaLimit,
        percentage,
        monthly_reset_date: userRecord.quotaResetDate.toISOString(),
        usage_trend: usageTrend,
    };
}
//# sourceMappingURL=getQuotaStatus.js.map
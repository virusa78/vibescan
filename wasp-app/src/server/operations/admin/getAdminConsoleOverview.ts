import { HttpError, prisma } from 'wasp/server';
import { getWorkerStatus } from '../../queues/config.js';

type AdminConsoleArgs = {
  q?: string | null;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requireAdmin(context: any): asserts context is { user: { isAdmin: boolean } } {
  if (!context.user) {
    throw new HttpError(401, 'User not authenticated');
  }

  if (!context.user.isAdmin) {
    throw new HttpError(403, 'Only admins can access the admin console');
  }
}

export async function getAdminConsoleOverview(args: AdminConsoleArgs, context: any): Promise<any> {
  requireAdmin(context);

  const search = (args.q ?? '').trim();
  const searchFilter = search.length > 0 ? search : null;
  const exactScanId = searchFilter && UUID_PATTERN.test(searchFilter) ? searchFilter : null;
  const workerStatus = getWorkerStatus();

  const [summary, users, workspaces, scans, matchingUsers, matchingWorkspaces, matchingScans] =
    await Promise.all([
      Promise.all([
        prisma.user.count(),
        prisma.workspace.count(),
        prisma.scan.count(),
        prisma.user.count({ where: { isAdmin: true } }),
        prisma.user.count({ where: { subscriptionStatus: { not: null } } }),
        prisma.user.count({ where: { subscriptionStatus: 'past_due' } }),
        prisma.scan.count({ where: { status: 'pending' } }),
        prisma.scan.count({ where: { status: 'scanning' } }),
        prisma.scan.count({ where: { status: 'error' } }),
      ]),
      prisma.user.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        ...(searchFilter
          ? {
              where: {
                OR: [
                  { email: { contains: searchFilter, mode: 'insensitive' } },
                  { username: { contains: searchFilter, mode: 'insensitive' } },
                  { displayName: { contains: searchFilter, mode: 'insensitive' } },
                ],
              },
            }
          : {}),
        select: {
          id: true,
          email: true,
          username: true,
          isAdmin: true,
          plan: true,
          subscriptionStatus: true,
          monthlyQuotaUsed: true,
          monthlyQuotaLimit: true,
          activeWorkspaceId: true,
          createdAt: true,
        },
      }),
      prisma.workspace.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        ...(searchFilter
          ? {
              where: {
                OR: [
                  { name: { contains: searchFilter, mode: 'insensitive' } },
                  { slug: { contains: searchFilter, mode: 'insensitive' } },
                  { organization: { name: { contains: searchFilter, mode: 'insensitive' } } },
                ],
              },
            }
          : {}),
        select: {
          id: true,
          name: true,
          slug: true,
          isPersonal: true,
          createdAt: true,
          organization: {
            select: {
              name: true,
              slug: true,
            },
          },
          _count: {
            select: {
              members: true,
              scans: true,
            },
          },
        },
      }),
      prisma.scan.findMany({
        take: 12,
        orderBy: { createdAt: 'desc' },
        ...(searchFilter
          ? {
              where: {
                OR: [
                  exactScanId ? { id: exactScanId } : undefined,
                  { inputRef: { contains: searchFilter, mode: 'insensitive' } },
                  { inputType: { contains: searchFilter, mode: 'insensitive' } },
                  { user: { email: { contains: searchFilter, mode: 'insensitive' } } },
                  { workspace: { name: { contains: searchFilter, mode: 'insensitive' } } },
                  { workspace: { slug: { contains: searchFilter, mode: 'insensitive' } } },
                ].filter(Boolean) as any[],
              },
            }
          : {}),
        select: {
          id: true,
          status: true,
          inputType: true,
          inputRef: true,
          planAtSubmission: true,
          workspaceId: true,
          userId: true,
          createdAt: true,
          completedAt: true,
          user: {
            select: {
              email: true,
              username: true,
            },
          },
          workspace: {
            select: {
              name: true,
              slug: true,
            },
          },
          _count: {
            select: {
              findings: true,
              scanResults: true,
            },
          },
        },
      }),
      searchFilter
        ? prisma.user.findMany({
            take: 5,
            orderBy: { createdAt: 'desc' },
            where: {
              OR: [
                { email: { contains: searchFilter, mode: 'insensitive' } },
                { username: { contains: searchFilter, mode: 'insensitive' } },
              ],
            },
            select: {
              id: true,
              email: true,
              username: true,
              isAdmin: true,
              plan: true,
              subscriptionStatus: true,
            },
          })
        : Promise.resolve([]),
      searchFilter
        ? prisma.workspace.findMany({
            take: 5,
            orderBy: { createdAt: 'desc' },
            where: {
              OR: [
                { name: { contains: searchFilter, mode: 'insensitive' } },
                { slug: { contains: searchFilter, mode: 'insensitive' } },
              ],
            },
            select: {
              id: true,
              name: true,
              slug: true,
            },
          })
        : Promise.resolve([]),
      searchFilter
        ? prisma.scan.findMany({
            take: 5,
            orderBy: { createdAt: 'desc' },
            where: {
              OR: [
                exactScanId ? { id: exactScanId } : undefined,
                { inputRef: { contains: searchFilter, mode: 'insensitive' } },
              ].filter(Boolean) as any[],
            },
            select: {
              id: true,
              status: true,
              inputRef: true,
              planAtSubmission: true,
            },
          })
        : Promise.resolve([]),
    ]);

  const [totalUsers, totalWorkspaces, totalScans, adminCount, activeSubscriptions, pastDueSubscriptions, queuedScans, runningScans, failedScans] =
    summary;

  return {
    summary: {
      total_users: totalUsers,
      total_workspaces: totalWorkspaces,
      total_scans: totalScans,
      admin_users: adminCount,
      active_subscriptions: activeSubscriptions,
      past_due_subscriptions: pastDueSubscriptions,
      queued_scans: queuedScans,
      running_scans: runningScans,
      failed_scans: failedScans,
    },
    worker_status: workerStatus,
    users,
    workspaces,
    scans,
    lookup: {
      query: searchFilter,
      users: matchingUsers,
      workspaces: matchingWorkspaces,
      scans: matchingScans,
    },
  };
}

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { prisma } from '../mocks/wasp-server';
const mockWorkerStatus = {
  free: { isRunning: false, isPaused: false },
  enterprise: { isRunning: false, isPaused: false },
  webhook: { isRunning: false, isPaused: false },
};

jest.mock('../../wasp-app/src/server/queues/config.js', () => ({
  getWorkerStatus: () => mockWorkerStatus,
}));

import { getAdminConsoleOverview } from '../../wasp-app/src/server/operations/admin';

const prismaMock = prisma as any;

describe('getAdminConsoleOverview', () => {
  beforeEach(() => {
    prismaMock.user.count.mockReset();
    prismaMock.user.findMany.mockReset();
    prismaMock.workspace.count.mockReset();
    prismaMock.workspace.findMany.mockReset();
    prismaMock.scan.count.mockReset();
    prismaMock.scan.findMany.mockReset();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  function mockOverviewCounts() {
    prismaMock.user.count
      .mockResolvedValueOnce(12)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1);
    prismaMock.workspace.count.mockResolvedValueOnce(5);
    prismaMock.scan.count
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1);
  }

  it('blocks non-admin users', async () => {
    await expect(getAdminConsoleOverview({}, { user: { id: 'user-1', isAdmin: false } })).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it('rejects anonymous users', async () => {
    await expect(getAdminConsoleOverview({}, { user: undefined })).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it('returns overview data for admins', async () => {
    mockOverviewCounts();
    prismaMock.user.findMany.mockResolvedValueOnce([
      {
        id: 'user-1',
        email: 'alice@example.com',
        username: 'alice',
        isAdmin: true,
        plan: 'pro',
        subscriptionStatus: 'active',
        monthlyQuotaUsed: 12,
        monthlyQuotaLimit: 100,
        activeWorkspaceId: 'workspace-1',
        createdAt: '2026-05-24T00:00:00.000Z',
      },
    ]);
    prismaMock.workspace.findMany.mockResolvedValueOnce([
      {
        id: 'workspace-1',
        name: 'Platform',
        slug: 'platform',
        isPersonal: false,
        createdAt: '2026-05-24T00:00:00.000Z',
        organization: { name: 'Acme', slug: 'acme' },
        _count: { members: 4, scans: 9 },
      },
    ]);
    prismaMock.scan.findMany.mockResolvedValueOnce([
      {
        id: 'scan-1',
        status: 'done',
        inputType: 'github',
        inputRef: 'github.com/acme/service',
        planAtSubmission: 'pro',
        workspaceId: 'workspace-1',
        userId: 'user-1',
        createdAt: '2026-05-24T00:00:00.000Z',
        completedAt: '2026-05-24T01:00:00.000Z',
        user: { email: 'alice@example.com', username: 'alice' },
        workspace: { name: 'Platform', slug: 'platform' },
        _count: { findings: 2, scanResults: 1 },
      },
    ]);

    const result = await getAdminConsoleOverview({}, { user: { id: 'user-1', isAdmin: true } });

    expect(result.summary).toMatchObject({
      total_users: 12,
      total_workspaces: 5,
      total_scans: 4,
      admin_users: 3,
      active_subscriptions: 2,
      past_due_subscriptions: 1,
      queued_scans: 2,
      running_scans: 1,
      failed_scans: 1,
    });
    expect(result.users).toHaveLength(1);
    expect(result.workspaces).toHaveLength(1);
    expect(result.scans).toHaveLength(1);
    expect(result.worker_status.free.isRunning).toBe(false);
  });

  it('searches users, workspaces, and scans by text query', async () => {
    mockOverviewCounts();
    prismaMock.user.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'user-1',
          email: 'alice@example.com',
          username: 'alice',
          isAdmin: true,
          plan: 'pro',
          subscriptionStatus: 'active',
        },
      ]);
    prismaMock.workspace.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'workspace-1',
          name: 'Platform',
          slug: 'platform',
        },
      ]);
    prismaMock.scan.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'scan-1',
          status: 'done',
          inputRef: 'github.com/acme/service',
          planAtSubmission: 'pro',
        },
      ]);

    const result = await getAdminConsoleOverview({ q: 'alice' }, { user: { id: 'user-1', isAdmin: true } });

    expect(result.lookup.query).toBe('alice');
    expect(result.lookup.users).toHaveLength(1);
    expect(result.lookup.workspaces).toHaveLength(1);
    expect(result.lookup.scans).toHaveLength(1);
  });

  it('matches scans by exact UUID when the query is a scan id', async () => {
    mockOverviewCounts();
    prismaMock.user.findMany.mockResolvedValueOnce([]);
    prismaMock.workspace.findMany.mockResolvedValueOnce([]);
    prismaMock.scan.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: '123e4567-e89b-12d3-a456-426614174000',
          status: 'done',
          inputRef: 'github.com/acme/service',
          planAtSubmission: 'pro',
        },
      ]);

    const result = await getAdminConsoleOverview(
      { q: '123e4567-e89b-12d3-a456-426614174000' },
      { user: { id: 'user-1', isAdmin: true } },
    );

    expect(result.lookup.query).toBe('123e4567-e89b-12d3-a456-426614174000');
    expect(result.lookup.scans).toHaveLength(1);
  });
});

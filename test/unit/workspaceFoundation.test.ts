import { describe, expect, it, jest } from '@jest/globals';
import { getWorkspaceContextForUser } from '../../wasp-app/src/server/services/workspaceFoundation';

describe('workspaceFoundation', () => {
  it('loads existing workspace context without bootstrapping a transaction', async () => {
    const db = {
      $transaction: jest.fn(async () => {
        throw new Error('transaction should not be called for existing workspace data');
      }),
      user: {
        findUnique: jest.fn(async () => ({
          id: 'user-1',
          email: 'dev@example.com',
          username: 'dev',
          displayName: 'Dev User',
          activeWorkspaceId: 'workspace-active',
        })),
        update: jest.fn(),
      },
      workspaceMembership: {
        findMany: jest.fn(async () => ([
          {
            role: 'admin',
            workspace: {
              id: 'workspace-active',
              name: 'Active Workspace',
              slug: 'active-workspace',
              isPersonal: true,
              organization: {
                id: 'org-1',
                name: 'Personal Org',
                slug: 'personal-org',
                isPersonal: true,
              },
              team: null,
            },
          },
        ])),
      },
    };

    const context = await getWorkspaceContextForUser(db as never, 'user-1');

    expect(db.$transaction).not.toHaveBeenCalled();
    expect(db.user.findUnique).toHaveBeenCalledTimes(1);
    expect(db.workspaceMembership.findMany).toHaveBeenCalledTimes(1);
    expect(context.activeWorkspace.id).toBe('workspace-active');
    expect(context.personalOrganizationId).toBe('org-1');
    expect(context.personalWorkspaceId).toBe('workspace-active');
  });
});


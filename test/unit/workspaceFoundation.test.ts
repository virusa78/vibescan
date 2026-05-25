import { describe, expect, it, jest } from '@jest/globals';
import {
  getWorkspaceContextForUser,
  ensureWorkspaceFoundationForUser,
} from '../../wasp-app/src/server/services/workspaceFoundation';

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

    const context = await getWorkspaceContextForUser(db as any, 'user-1');

    expect(db.$transaction).not.toHaveBeenCalled();
    expect(db.user.findUnique).toHaveBeenCalledTimes(1);
    expect(db.workspaceMembership.findMany).toHaveBeenCalledTimes(1);
    expect(context.activeWorkspace.id).toBe('workspace-active');
    expect(context.personalOrganizationId).toBe('org-1');
    expect(context.personalWorkspaceId).toBe('workspace-active');
  });

  it('bootstraps a new workspace foundation when no workspace exists', async () => {
    const mockUser = {
      id: 'user-2',
      email: 'new@example.com',
      username: null,
      displayName: null,
      activeWorkspaceId: null,
    };

    const mockOrg = { id: 'org-2', name: 'new\'s Org', slug: 'personal-new', isPersonal: true };
    const mockTeam = { id: 'team-2', name: 'Default Team', slug: 'default-team', isDefault: true };
    const mockWorkspace = { id: 'ws-2', name: 'new\'s Workspace', slug: 'personal-new', isPersonal: true };

    const db = {
      $transaction: jest.fn(async (cb: any) => cb(db)),
      user: {
        findUnique: jest.fn(async () => mockUser),
        update: jest.fn(async () => ({})),
      },
      organization: {
        findFirst: jest.fn(async () => null),
        create: jest.fn(async () => mockOrg),
      },
      organizationMembership: {
        upsert: jest.fn(async () => ({})),
      },
      team: {
        findFirst: jest.fn(async () => null),
        create: jest.fn(async () => mockTeam),
      },
      teamMembership: {
        upsert: jest.fn(async () => ({})),
      },
      workspace: {
        findFirst: jest.fn(async () => null),
        create: jest.fn(async () => mockWorkspace),
      },
      workspaceMembership: {
        upsert: jest.fn(async () => ({})),
        findMany: jest.fn(async () => []),
      },
    };

    const result = await ensureWorkspaceFoundationForUser(db as any, 'user-2');

    expect(result.activeWorkspaceId).toBe('ws-2');
    expect(db.organization.create).toHaveBeenCalled();
    expect(db.team.create).toHaveBeenCalled();
    expect(db.workspace.create).toHaveBeenCalled();
    expect(db.user.update).toHaveBeenCalled();
  });

  it('uses existing foundation records during bootstrapping if present', async () => {
    const mockUser = {
      id: 'user-3',
      email: 'existing@example.com',
      username: 'exist',
      displayName: 'Existing User',
      activeWorkspaceId: 'ws-3',
    };

    const mockOrg = { id: 'org-3', name: 'Org', slug: 'slug-org', isPersonal: true };
    const mockTeam = { id: 'team-3', name: 'Team', slug: 'slug-team', isDefault: true };
    const mockWorkspace = { id: 'ws-3', name: 'WS', slug: 'slug-ws', isPersonal: true };

    const db = {
      $transaction: jest.fn(async (cb: any) => cb(db)),
      user: {
        findUnique: jest.fn(async () => mockUser),
        update: jest.fn(async () => ({})),
      },
      organization: {
        findFirst: jest.fn(async () => mockOrg),
        create: jest.fn(),
      },
      organizationMembership: {
        upsert: jest.fn(async () => ({})),
      },
      team: {
        findFirst: jest.fn(async () => mockTeam),
        create: jest.fn(),
      },
      teamMembership: {
        upsert: jest.fn(async () => ({})),
      },
      workspace: {
        findFirst: jest.fn(async () => mockWorkspace),
        create: jest.fn(),
      },
      workspaceMembership: {
        upsert: jest.fn(async () => ({})),
        findMany: jest.fn(async () => []),
      },
    };

    const result = await ensureWorkspaceFoundationForUser(db as any, 'user-3');

    expect(result.activeWorkspaceId).toBe('ws-3');
    expect(db.organization.create).not.toHaveBeenCalled();
    expect(db.team.create).not.toHaveBeenCalled();
    expect(db.workspace.create).not.toHaveBeenCalled();
    expect(db.user.update).not.toHaveBeenCalled(); // Already activeWorkspaceId === ws-3
  });

  it('throws an error if user is not found during bootstrapping', async () => {
    const db = {
      $transaction: jest.fn(async (cb: any) => cb(db)),
      user: {
        findUnique: jest.fn(async () => null),
      },
    };

    await expect(
      ensureWorkspaceFoundationForUser(db as any, 'nonexistent')
    ).rejects.toThrow('User nonexistent not found');
  });

  it('bootstraps and returns context successfully inside getWorkspaceContextForUser', async () => {
    const mockUser = {
      id: 'user-4',
      email: 'boot@example.com',
      username: 'boot',
      displayName: 'Boot User',
      activeWorkspaceId: null,
    };

    const mockOrg = { id: 'org-4', name: 'boot\'s Org', slug: 'personal-boot', isPersonal: true };
    const mockTeam = { id: 'team-4', name: 'Default Team', slug: 'default-team', isDefault: true };
    const mockWorkspace = { id: 'ws-4', name: 'boot\'s Workspace', slug: 'personal-boot', isPersonal: true };

    const mockMembership = {
      role: 'admin',
      workspace: {
        id: 'ws-4',
        name: 'boot\'s Workspace',
        slug: 'personal-boot',
        isPersonal: true,
        organization: { id: 'org-4', name: 'boot\'s Org', slug: 'personal-boot', isPersonal: true },
        team: null,
      },
    };

    let findManyCalls = 0;
    const db = {
      $transaction: jest.fn(async (cb: any) => cb(db)),
      user: {
        findUnique: jest.fn(async () => mockUser),
        update: jest.fn(async () => ({})),
      },
      organization: {
        findFirst: jest.fn(async () => null),
        create: jest.fn(async () => mockOrg),
      },
      organizationMembership: {
        upsert: jest.fn(async () => ({})),
      },
      team: {
        findFirst: jest.fn(async () => null),
        create: jest.fn(async () => mockTeam),
      },
      teamMembership: {
        upsert: jest.fn(async () => ({})),
      },
      workspace: {
        findFirst: jest.fn(async () => null),
        create: jest.fn(async () => mockWorkspace),
      },
      workspaceMembership: {
        upsert: jest.fn(async () => ({})),
        findMany: jest.fn(async () => {
          findManyCalls++;
          return findManyCalls === 1 ? [] : [mockMembership];
        }),
      },
    };

    const context = await getWorkspaceContextForUser(db as any, 'user-4');
    expect(context.activeWorkspace.id).toBe('ws-4');
    expect(context.personalWorkspaceId).toBe('ws-4');
  });

  it('throws an error if context load returns null even after bootstrapping', async () => {
    const mockUser = {
      id: 'user-5',
      email: 'fail@example.com',
      username: 'fail',
      displayName: 'Fail User',
      activeWorkspaceId: null,
    };

    const db = {
      $transaction: jest.fn(async (cb: any) => cb(db)),
      user: {
        findUnique: jest.fn(async () => mockUser),
        update: jest.fn(async () => ({})),
      },
      organization: {
        findFirst: jest.fn(async () => null),
        create: jest.fn(async () => ({} as any)),
      },
      organizationMembership: {
        upsert: jest.fn(async () => ({})),
      },
      team: {
        findFirst: jest.fn(async () => null),
        create: jest.fn(async () => ({} as any)),
      },
      teamMembership: {
        upsert: jest.fn(async () => ({})),
      },
      workspace: {
        findFirst: jest.fn(async () => null),
        create: jest.fn(async () => ({} as any)),
      },
      workspaceMembership: {
        upsert: jest.fn(async () => ({})),
        findMany: jest.fn(async () => []), // Keeps returning empty even after bootstrapping
      },
    };

    await expect(
      getWorkspaceContextForUser(db as any, 'user-5')
    ).rejects.toThrow('Workspace membership bootstrap failed for user user-5');
  });
});

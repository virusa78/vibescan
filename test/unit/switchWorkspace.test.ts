import { describe, expect, it, beforeEach } from '@jest/globals';
import { prisma } from 'wasp/server';
import { switchWorkspace } from '../../wasp-app/src/server/operations/workspaces/switchWorkspace';

const prismaMock = prisma;

describe('switchWorkspace', () => {
  beforeEach(() => {
    prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof prismaMock) => unknown) => callback(prismaMock));
    prismaMock.workspaceMembership.findFirst.mockReset();
    prismaMock.workspaceMembership.findMany.mockReset();
    prismaMock.workspaceMembership.upsert.mockReset();
    prismaMock.user.update.mockReset();
    prismaMock.user.findUnique.mockReset();
    prismaMock.organization.findFirst.mockReset();
    prismaMock.organization.create.mockReset();
    prismaMock.organizationMembership.upsert.mockReset();
    prismaMock.team.findFirst.mockReset();
    prismaMock.team.create.mockReset();
    prismaMock.teamMembership.upsert.mockReset();
    prismaMock.workspace.findFirst.mockReset();
    prismaMock.workspace.create.mockReset();
  });

  it('switches active workspace when membership exists', async () => {
    prismaMock.workspaceMembership.findFirst.mockResolvedValueOnce({
      workspaceId: 'workspace-2',
    });
    prismaMock.user.update.mockResolvedValueOnce({});
    prismaMock.organization.findFirst.mockResolvedValueOnce({
      id: 'org-1',
      name: 'Personal Org',
      slug: 'personal-org',
      isPersonal: true,
    });
    prismaMock.team.findFirst.mockResolvedValueOnce({
      id: 'team-personal',
      name: 'Personal Team',
      slug: 'personal-team',
      isDefault: true,
    });
    prismaMock.workspace.findFirst.mockResolvedValueOnce({
      id: 'workspace-1',
      name: 'Personal',
      slug: 'personal',
      isPersonal: true,
    });
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: 'user-1',
      email: 'user@example.com',
      username: 'user',
      displayName: 'User',
      activeWorkspaceId: 'workspace-2',
    });
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: 'user-1',
      email: 'user@example.com',
      username: 'user',
      displayName: 'User',
      activeWorkspaceId: 'workspace-2',
    });
    prismaMock.organizationMembership.upsert.mockResolvedValueOnce({});
    prismaMock.teamMembership.upsert.mockResolvedValueOnce({});
    prismaMock.workspaceMembership.upsert.mockResolvedValueOnce({});
    prismaMock.workspaceMembership.findMany.mockResolvedValueOnce([
      {
        role: 'admin',
        workspace: {
          id: 'workspace-1',
          name: 'Personal',
          slug: 'personal',
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
      {
        role: 'member',
        workspace: {
          id: 'workspace-2',
          name: 'Security Team',
          slug: 'security-team',
          isPersonal: false,
          organization: {
            id: 'org-2',
            name: 'Acme',
            slug: 'acme',
            isPersonal: false,
          },
          team: {
            id: 'team-1',
            name: 'Security',
            slug: 'security',
            isDefault: false,
          },
        },
      },
    ]);

    const result = await switchWorkspace(
      { workspace_id: '00000000-0000-4000-8000-000000000002' },
      {
        user: { id: 'user-1', workspaceId: 'workspace-1' },
      },
    );

    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { activeWorkspaceId: 'workspace-2' },
    });
    expect(result.active_workspace.id).toBe('workspace-2');
    expect(result.workspaces).toHaveLength(2);
  });

  it('throws when the target workspace is not accessible', async () => {
    prismaMock.workspaceMembership.findFirst.mockResolvedValueOnce(null);
    prismaMock.organization.findFirst.mockResolvedValueOnce({
      id: 'org-1',
      name: 'Personal Org',
      slug: 'personal-org',
      isPersonal: true,
    });
    prismaMock.team.findFirst.mockResolvedValueOnce({
      id: 'team-personal',
      name: 'Personal Team',
      slug: 'personal-team',
      isDefault: true,
    });
    prismaMock.workspace.findFirst.mockResolvedValueOnce({
      id: 'workspace-1',
      name: 'Personal',
      slug: 'personal',
      isPersonal: true,
    });
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: 'user-1',
      email: 'user@example.com',
      username: 'user',
      displayName: 'User',
      activeWorkspaceId: 'workspace-1',
    });
    prismaMock.organizationMembership.upsert.mockResolvedValueOnce({});
    prismaMock.teamMembership.upsert.mockResolvedValueOnce({});
    prismaMock.workspaceMembership.upsert.mockResolvedValueOnce({});

    await expect(
      switchWorkspace(
        { workspace_id: '00000000-0000-4000-8000-000000000003' },
        {
          user: { id: 'user-1', workspaceId: 'workspace-1' },
        },
      ),
    ).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

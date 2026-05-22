type WorkspaceFoundationUserRecord = {
  id: string;
  email: string;
  username: string | null;
  displayName: string | null;
  activeWorkspaceId: string | null;
};

type OrganizationRecord = {
  id: string;
  name: string;
  slug: string;
  isPersonal: boolean;
};

type TeamRecord = {
  id: string;
  name: string;
  slug: string;
  isDefault: boolean;
};

type WorkspaceRecord = {
  id: string;
  name: string;
  slug: string;
  isPersonal: boolean;
};

type WorkspaceMembershipRow = {
  role: WorkspaceRoleValue;
  workspace: {
    id: string;
    name: string;
    slug: string;
    isPersonal: boolean;
    organization: {
      id: string;
      name: string;
      slug: string;
      isPersonal: boolean;
    };
    team: {
      id: string;
      name: string;
      slug: string;
      isDefault: boolean;
    } | null;
  };
};

type OrganizationRoleValue = 'owner' | 'admin' | 'member';
type TeamRoleValue = 'maintainer' | 'member';
type WorkspaceRoleValue = 'admin' | 'member' | 'viewer';

export type WorkspaceSummary = {
  id: string;
  name: string;
  slug: string;
  isPersonal: boolean;
  role: WorkspaceRoleValue;
  organization: {
    id: string;
    name: string;
    slug: string;
    isPersonal: boolean;
  };
  team: {
    id: string;
    name: string;
    slug: string;
    isDefault: boolean;
  } | null;
};

export type WorkspaceContext = {
  activeWorkspace: WorkspaceSummary;
  workspaces: WorkspaceSummary[];
  personalOrganizationId: string;
  personalWorkspaceId: string;
};

export type WorkspaceFoundationDatabase = {
  $transaction<T>(fn: (tx: WorkspaceFoundationDatabase) => Promise<T>): Promise<T>;
  user: {
    findUnique(args: unknown): Promise<WorkspaceFoundationUserRecord | null>;
    update(args: unknown): Promise<unknown>;
  };
  organization: {
    findFirst(args: unknown): Promise<OrganizationRecord | null>;
    create(args: unknown): Promise<OrganizationRecord>;
  };
  organizationMembership: {
    upsert(args: unknown): Promise<unknown>;
  };
  team: {
    findFirst(args: unknown): Promise<TeamRecord | null>;
    create(args: unknown): Promise<TeamRecord>;
  };
  teamMembership: {
    upsert(args: unknown): Promise<unknown>;
  };
  workspace: {
    findFirst(args: unknown): Promise<WorkspaceRecord | null>;
    create(args: unknown): Promise<WorkspaceRecord>;
  };
  workspaceMembership: {
    upsert(args: unknown): Promise<unknown>;
    findMany(args: unknown): Promise<WorkspaceMembershipRow[]>;
  };
};

type EnsuredWorkspaceFoundation = {
  activeWorkspaceId: string;
  organizationId: string;
  teamId: string;
  workspaceId: string;
};

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 40);
}

function getUserLabel(user: WorkspaceFoundationUserRecord): string {
  const emailLocalPart = user.email.split('@')[0] || 'workspace';
  return user.displayName?.trim() || user.username?.trim() || emailLocalPart;
}

function getStableSuffix(id: string): string {
  return id.replace(/-/g, '').slice(0, 8) || 'default';
}

function buildFoundationNames(user: WorkspaceFoundationUserRecord) {
  const label = getUserLabel(user);
  const baseSlug = slugify(label) || 'workspace';
  const suffix = getStableSuffix(user.id);

  return {
    organizationName: `${label}'s Organization`,
    organizationSlug: `personal-${baseSlug}-${suffix}`,
    teamName: 'Default Team',
    teamSlug: `default-${suffix}`,
    workspaceName: `${label}'s Workspace`,
    workspaceSlug: `personal-${baseSlug}-${suffix}`,
  };
}

function mapWorkspaceSummary(row: WorkspaceMembershipRow): WorkspaceSummary {
  return {
    id: row.workspace.id,
    name: row.workspace.name,
    slug: row.workspace.slug,
    isPersonal: row.workspace.isPersonal,
    role: row.role,
    organization: row.workspace.organization,
    team: row.workspace.team,
  };
}

export async function ensureWorkspaceFoundationForUser(
  db: WorkspaceFoundationDatabase,
  userId: string,
): Promise<EnsuredWorkspaceFoundation> {
  return db.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        activeWorkspaceId: true,
      },
    });

    if (!user) {
      throw new Error(`User ${userId} not found while ensuring workspace foundation`);
    }

    const foundationNames = buildFoundationNames(user);

    const organization =
      (await tx.organization.findFirst({
        where: {
          ownerUserId: user.id,
          isPersonal: true,
        },
        select: {
          id: true,
          name: true,
          slug: true,
          isPersonal: true,
        },
      })) ??
      (await tx.organization.create({
        data: {
          name: foundationNames.organizationName,
          slug: foundationNames.organizationSlug,
          ownerUserId: user.id,
          isPersonal: true,
        },
        select: {
          id: true,
          name: true,
          slug: true,
          isPersonal: true,
        },
      }));

    await tx.organizationMembership.upsert({
      where: {
        organizationId_userId: {
          organizationId: organization.id,
          userId: user.id,
        },
      },
      update: {
        role: 'owner' satisfies OrganizationRoleValue,
      },
      create: {
        organizationId: organization.id,
        userId: user.id,
        role: 'owner' satisfies OrganizationRoleValue,
      },
    });

    const team =
      (await tx.team.findFirst({
        where: {
          organizationId: organization.id,
          isDefault: true,
        },
        select: {
          id: true,
          name: true,
          slug: true,
          isDefault: true,
        },
      })) ??
      (await tx.team.create({
        data: {
          organizationId: organization.id,
          name: foundationNames.teamName,
          slug: foundationNames.teamSlug,
          isDefault: true,
        },
        select: {
          id: true,
          name: true,
          slug: true,
          isDefault: true,
        },
      }));

    await tx.teamMembership.upsert({
      where: {
        teamId_userId: {
          teamId: team.id,
          userId: user.id,
        },
      },
      update: {
        role: 'maintainer' satisfies TeamRoleValue,
      },
      create: {
        teamId: team.id,
        userId: user.id,
        role: 'maintainer' satisfies TeamRoleValue,
      },
    });

    const workspace =
      (await tx.workspace.findFirst({
        where: {
          organizationId: organization.id,
          isPersonal: true,
        },
        select: {
          id: true,
          name: true,
          slug: true,
          isPersonal: true,
        },
      })) ??
      (await tx.workspace.create({
        data: {
          organizationId: organization.id,
          teamId: team.id,
          name: foundationNames.workspaceName,
          slug: foundationNames.workspaceSlug,
          isPersonal: true,
          createdByUserId: user.id,
        },
        select: {
          id: true,
          name: true,
          slug: true,
          isPersonal: true,
        },
      }));

    await tx.workspaceMembership.upsert({
      where: {
        workspaceId_userId: {
          workspaceId: workspace.id,
          userId: user.id,
        },
      },
      update: {
        role: 'admin' satisfies WorkspaceRoleValue,
      },
      create: {
        workspaceId: workspace.id,
        userId: user.id,
        role: 'admin' satisfies WorkspaceRoleValue,
      },
    });

    const activeWorkspaceId = user.activeWorkspaceId || workspace.id;

    if (user.activeWorkspaceId !== activeWorkspaceId) {
      await tx.user.update({
        where: { id: user.id },
        data: {
          activeWorkspaceId,
        },
      });
    }

    return {
      activeWorkspaceId,
      organizationId: organization.id,
      teamId: team.id,
      workspaceId: workspace.id,
    };
  });
}

export async function getWorkspaceContextForUser(
  db: WorkspaceFoundationDatabase,
  userId: string,
): Promise<WorkspaceContext> {
  const ensured = await ensureWorkspaceFoundationForUser(db, userId);

  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      username: true,
      displayName: true,
      activeWorkspaceId: true,
    },
  });

  if (!user) {
    throw new Error(`User ${userId} not found while loading workspace context`);
  }

  const memberships = await db.workspaceMembership.findMany({
    where: { userId },
    select: {
      role: true,
      workspace: {
        select: {
          id: true,
          name: true,
          slug: true,
          isPersonal: true,
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
              isPersonal: true,
            },
          },
          team: {
            select: {
              id: true,
              name: true,
              slug: true,
              isDefault: true,
            },
          },
        },
      },
    },
  });

  if (memberships.length === 0) {
    throw new Error(`Workspace membership bootstrap failed for user ${userId}`);
  }

  memberships.sort((left, right) => {
    if (left.workspace.isPersonal !== right.workspace.isPersonal) {
      return left.workspace.isPersonal ? -1 : 1;
    }

    return left.workspace.name.localeCompare(right.workspace.name);
  });

  const activeMembership =
    memberships.find((membership) => membership.workspace.id === user.activeWorkspaceId) ??
    memberships.find((membership) => membership.workspace.id === ensured.workspaceId) ??
    memberships[0];

  if (!activeMembership) {
    throw new Error(`Active workspace resolution failed for user ${userId}`);
  }

  if (user.activeWorkspaceId !== activeMembership.workspace.id) {
    await db.user.update({
      where: { id: user.id },
      data: {
        activeWorkspaceId: activeMembership.workspace.id,
      },
    });
  }

  return {
    activeWorkspace: mapWorkspaceSummary(activeMembership),
    workspaces: memberships.map(mapWorkspaceSummary),
    personalOrganizationId: ensured.organizationId,
    personalWorkspaceId: ensured.workspaceId,
  };
}

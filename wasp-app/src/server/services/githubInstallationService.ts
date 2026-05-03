import { HttpError, prisma } from 'wasp/server';
import {
  getGitHubInstallationMetadata,
  listGitHubInstallationRepositories,
} from './githubAppService';

type GithubInstallationRecord = {
  id: string;
  orgId: string | null;
  workspaceId: string | null;
  githubInstallationId: bigint;
  githubAppId: string;
  accountLogin: string | null;
  accountType: string | null;
  repositorySelection: string;
  reposScope: string[];
  triggerOnPush: boolean;
  triggerOnPr: boolean;
  targetBranches: string[];
  failPrOnSeverity: string;
};

type LinkInstallationResult = {
  id: string;
  githubInstallationId: string;
  workspaceId: string | null;
  orgId: string | null;
  accountLogin: string | null;
  repositorySelection: string;
  reposScope: string[];
  triggerOnPush: boolean;
  triggerOnPr: boolean;
  targetBranches: string[];
  failPrOnSeverity: string;
  availableRepos: string[];
};

function toBigIntInstallationId(value: string | number | bigint): bigint {
  if (typeof value === 'bigint') {
    return value;
  }

  if (typeof value === 'number') {
    return BigInt(value);
  }

  return BigInt(value.trim());
}

async function findByInstallationId(
  installationId: bigint,
): Promise<GithubInstallationRecord | null> {
  return prisma.githubInstallation.findUnique({
    where: {
      githubInstallationId: installationId,
    },
  }) as Promise<GithubInstallationRecord | null>;
}

export async function syncGithubInstallation(
  installationId: string | number | bigint,
  overrides?: {
    workspaceId?: string | null;
    orgId?: string | null;
  },
): Promise<LinkInstallationResult> {
  const normalizedInstallationId = toBigIntInstallationId(installationId);
  const [existing, metadata, repositories] = await Promise.all([
    findByInstallationId(normalizedInstallationId),
    getGitHubInstallationMetadata(normalizedInstallationId),
    listGitHubInstallationRepositories(normalizedInstallationId),
  ]);

  const availableRepos = repositories.map((repo) => repo.fullName).sort();
  const reposScope = existing
    ? availableRepos.filter((repo) => existing.reposScope.includes(repo))
    : availableRepos;
  const workspaceId = overrides?.workspaceId ?? existing?.workspaceId ?? null;
  const orgId = overrides?.orgId ?? existing?.orgId ?? null;

  const record = existing
    ? await prisma.githubInstallation.update({
        where: { githubInstallationId: normalizedInstallationId },
        data: {
          orgId,
          workspaceId,
          githubAppId: existing.githubAppId,
          accountLogin: metadata.accountLogin,
          accountType: metadata.accountType,
          repositorySelection: metadata.repositorySelection,
          reposScope,
        },
      })
    : await prisma.githubInstallation.create({
        data: {
          orgId,
          workspaceId,
          githubInstallationId: normalizedInstallationId,
          githubAppId: process.env.GITHUB_APP_ID?.trim() || 'github-app',
          accountLogin: metadata.accountLogin,
          accountType: metadata.accountType,
          repositorySelection: metadata.repositorySelection,
          reposScope,
          triggerOnPush: true,
          triggerOnPr: true,
          targetBranches: ['main', 'develop'],
          failPrOnSeverity: 'CRITICAL',
        },
      });

  return {
    id: record.id,
    githubInstallationId: record.githubInstallationId.toString(),
    workspaceId: record.workspaceId ?? null,
    orgId: record.orgId ?? null,
    accountLogin: record.accountLogin ?? null,
    repositorySelection: record.repositorySelection,
    reposScope: record.reposScope,
    triggerOnPush: record.triggerOnPush,
    triggerOnPr: record.triggerOnPr,
    targetBranches: record.targetBranches,
    failPrOnSeverity: record.failPrOnSeverity,
    availableRepos,
  };
}

export async function removeGithubInstallation(
  installationId: string | number | bigint,
): Promise<void> {
  const normalizedInstallationId = toBigIntInstallationId(installationId);
  await prisma.githubInstallation.deleteMany({
    where: {
      githubInstallationId: normalizedInstallationId,
    },
  });
}

export async function linkGithubInstallationToWorkspace(
  installationId: string,
  workspaceId: string,
  orgId: string,
): Promise<LinkInstallationResult> {
  if (!workspaceId || !orgId) {
    throw new HttpError(422, 'Workspace mapping requires workspace and organization identifiers');
  }

  return syncGithubInstallation(installationId, {
    workspaceId,
    orgId,
  });
}

export async function getMappedGithubInstallationByInstallationId(
  installationId: string | number | bigint,
): Promise<GithubInstallationRecord | null> {
  const normalizedInstallationId = toBigIntInstallationId(installationId);
  return findByInstallationId(normalizedInstallationId);
}

export async function listGithubInstallationsForWorkspace(workspaceId: string): Promise<LinkInstallationResult[]> {
  const records = await prisma.githubInstallation.findMany({
    where: { workspaceId },
    orderBy: { createdAt: 'desc' },
  }) as GithubInstallationRecord[];

  const availableReposByInstallation = new Map<string, string[]>();
  await Promise.all(
    records.map(async (record) => {
      try {
        const repositories = await listGitHubInstallationRepositories(record.githubInstallationId);
        availableReposByInstallation.set(
          record.id,
          repositories.map((repo) => repo.fullName).sort(),
        );
      } catch {
        availableReposByInstallation.set(record.id, [...record.reposScope].sort());
      }
    }),
  );

  return records.map((record) => ({
    id: record.id,
    githubInstallationId: record.githubInstallationId.toString(),
    workspaceId: record.workspaceId ?? null,
    orgId: record.orgId ?? null,
    accountLogin: record.accountLogin ?? null,
    repositorySelection: record.repositorySelection,
    reposScope: record.reposScope,
    triggerOnPush: record.triggerOnPush,
    triggerOnPr: record.triggerOnPr,
    targetBranches: record.targetBranches,
    failPrOnSeverity: record.failPrOnSeverity,
    availableRepos: availableReposByInstallation.get(record.id) ?? [...record.reposScope].sort(),
  }));
}

export async function updateGithubInstallationSettings(
  installationId: string,
  workspaceId: string,
  settings: {
    reposScope: string[];
    triggerOnPush: boolean;
    triggerOnPr: boolean;
    targetBranches: string[];
    failPrOnSeverity: string;
  },
): Promise<LinkInstallationResult> {
  const record = await prisma.githubInstallation.updateMany({
    where: {
      id: installationId,
      workspaceId,
    },
    data: {
      reposScope: settings.reposScope,
      triggerOnPush: settings.triggerOnPush,
      triggerOnPr: settings.triggerOnPr,
      targetBranches: settings.targetBranches,
      failPrOnSeverity: settings.failPrOnSeverity,
    },
  });

  if (record.count === 0) {
    throw new HttpError(404, 'GitHub installation not found');
  }

  const updated = await prisma.githubInstallation.findFirst({
    where: {
      id: installationId,
      workspaceId,
    },
  }) as GithubInstallationRecord | null;

  if (!updated) {
    throw new HttpError(404, 'GitHub installation not found');
  }

  return {
    id: updated.id,
    githubInstallationId: updated.githubInstallationId.toString(),
    workspaceId: updated.workspaceId ?? null,
    orgId: updated.orgId ?? null,
    accountLogin: updated.accountLogin ?? null,
    repositorySelection: updated.repositorySelection,
    reposScope: updated.reposScope,
    triggerOnPush: updated.triggerOnPush,
    triggerOnPr: updated.triggerOnPr,
    targetBranches: updated.targetBranches,
    failPrOnSeverity: updated.failPrOnSeverity,
    availableRepos: [...updated.reposScope].sort(),
  };
}

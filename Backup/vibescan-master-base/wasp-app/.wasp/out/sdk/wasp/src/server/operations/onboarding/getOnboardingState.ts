import { HttpError, prisma } from 'wasp/server';
import { getWorkspaceContextForUser, type WorkspaceFoundationDatabase } from '../../services/workspaceFoundation';
import { requireWorkspaceScopedUser } from '../../services/workspaceAccess';


type UserPreferences = {
  onboardingCompletedAt?: string;
  onboardingDismissedAt?: string;
  [key: string]: unknown;
};

export type OnboardingStateResponse = {
  should_show_onboarding: boolean;
  is_complete: boolean;
  has_workspace: boolean;
  has_scans: boolean;
  has_github_installation: boolean;
  workspace_name: string | null;
  workspace_slug: string | null;
  recommended_path: 'github' | 'manual';
  primary_cta_route: string;
  secondary_cta_route: string | null;
};

function parsePreferences(raw: unknown): UserPreferences {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }

  return raw as UserPreferences;
}

export async function getOnboardingState(
  _rawArgs: unknown,
  context: any,
): Promise<any> {
  const user = await requireWorkspaceScopedUser(context.user);
  const workspaceContext = await getWorkspaceContextForUser(
    prisma as unknown as WorkspaceFoundationDatabase,
    user.id,
  );

  const [userRecord, scanCount, githubInstallationCount] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      select: { uiPreferences: true },
    }),
    prisma.scan.count({
      where: {
        OR: [
          { workspaceId: user.workspaceId },
          { workspaceId: null, userId: user.id },
        ],
      },
    }),
    prisma.githubInstallation.count({
      where: {
        workspaceId: user.workspaceId,
      },
    }),
  ]);

  if (!userRecord) {
    throw new HttpError(404, 'User not found');
  }

  const preferences = parsePreferences(userRecord.uiPreferences);
  const hasScans = scanCount > 0;
  const hasGithubInstallation = githubInstallationCount > 0;
  const hasDismissedOnboarding = typeof preferences.onboardingDismissedAt === 'string';
  const hasCompletedOnboarding =
    hasScans || typeof preferences.onboardingCompletedAt === 'string';

  return {
    should_show_onboarding: !hasCompletedOnboarding && !hasDismissedOnboarding,
    is_complete: hasCompletedOnboarding,
    has_workspace: Boolean(workspaceContext.activeWorkspace.id),
    has_scans: hasScans,
    has_github_installation: hasGithubInstallation,
    workspace_name: workspaceContext.activeWorkspace.name,
    workspace_slug: workspaceContext.activeWorkspace.slug,
    recommended_path: hasGithubInstallation ? 'github' : 'manual',
    primary_cta_route: hasGithubInstallation ? '/new-scan?type=github' : '/new-scan?type=github',
    secondary_cta_route: '/new-scan?type=sbom',
  };
}

import { HttpError, prisma } from 'wasp/server';
import { getWorkspaceContextForUser } from '../../services/workspaceFoundation';
import { requireWorkspaceScopedUser } from '../../services/workspaceAccess';
function parsePreferences(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        return {};
    }
    return raw;
}
export async function getOnboardingState(_rawArgs, context) {
    const user = await requireWorkspaceScopedUser(context.user);
    const workspaceContext = await getWorkspaceContextForUser(prisma, user.id);
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
    const hasCompletedOnboarding = hasScans || typeof preferences.onboardingCompletedAt === 'string';
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
//# sourceMappingURL=getOnboardingState.js.map
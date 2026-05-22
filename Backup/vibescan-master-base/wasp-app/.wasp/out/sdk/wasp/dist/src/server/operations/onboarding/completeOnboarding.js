import { HttpError, prisma } from 'wasp/server';
import { requireWorkspaceScopedUser } from '../../services/workspaceAccess';
function parsePreferences(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        return {};
    }
    return raw;
}
export async function completeOnboarding(_rawArgs, context) {
    const user = await requireWorkspaceScopedUser(context.user);
    const userRecord = await prisma.user.findUnique({
        where: { id: user.id },
        select: { uiPreferences: true },
    });
    if (!userRecord) {
        throw new HttpError(404, 'User not found');
    }
    const completedAt = new Date().toISOString();
    const preferences = parsePreferences(userRecord.uiPreferences);
    await prisma.user.update({
        where: { id: user.id },
        data: {
            uiPreferences: {
                ...preferences,
                onboardingCompletedAt: completedAt,
            },
        },
    });
    return {
        success: true,
        completed_at: completedAt,
    };
}
//# sourceMappingURL=completeOnboarding.js.map
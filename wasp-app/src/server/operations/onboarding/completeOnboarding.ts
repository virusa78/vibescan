import { HttpError, prisma } from 'wasp/server';
import { requireWorkspaceScopedUser } from '../../services/workspaceAccess';


type UserPreferences = {
  onboardingCompletedAt?: string;
  onboardingDismissedAt?: string;
  [key: string]: unknown;
};

export type CompleteOnboardingResponse = {
  success: true;
  completed_at: string;
};

function parsePreferences(raw: unknown): UserPreferences {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }

  return raw as UserPreferences;
}

export async function completeOnboarding(
  _rawArgs: unknown,
  context: any,
): Promise<any> {
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
      } as unknown as object,
    },
  });

  return {
    success: true,
    completed_at: completedAt,
  };
}

import { HttpError, prisma } from 'wasp/server';
import {
  DEFAULT_GLOBAL_POLICY,
  type EffectivePolicy,
  normalizeRegionCode,
  resolveEffectivePolicy,
} from '../../shared/regionPolicy.js';

export { DEFAULT_GLOBAL_POLICY, normalizeRegionCode, resolveEffectivePolicy };

export async function getEffectivePolicyForUser(userId: string): Promise<EffectivePolicy> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { region: true },
  });

  if (!user) {
    throw new HttpError(404, 'User not found');
  }

  const regionCode = normalizeRegionCode(user.region);
  const [globalPolicy, regionPolicy, userOverride] = await Promise.all([
    prisma.regionPolicy.findUnique({ where: { regionCode: 'GLOBAL' } }),
    prisma.regionPolicy.findUnique({ where: { regionCode } }),
    prisma.userPolicyOverride.findUnique({ where: { userId } }),
  ]);

  return resolveEffectivePolicy({
    regionCode,
    globalPolicy: globalPolicy
      ? {
          monthlyScanLimit: globalPolicy.monthlyScanLimit,
          monthlyRemediationPromptLimit: globalPolicy.monthlyRemediationPromptLimit,
          maxPromptsPerFinding: globalPolicy.maxPromptsPerFinding,
        }
      : null,
    regionPolicy: regionPolicy
      ? {
          monthlyScanLimit: regionPolicy.monthlyScanLimit,
          monthlyRemediationPromptLimit: regionPolicy.monthlyRemediationPromptLimit,
          maxPromptsPerFinding: regionPolicy.maxPromptsPerFinding,
          isActive: regionPolicy.isActive,
        }
      : null,
    userOverride: userOverride
      ? {
          monthlyScanLimit: userOverride.monthlyScanLimit,
          monthlyRemediationPromptLimit: userOverride.monthlyRemediationPromptLimit,
          maxPromptsPerFinding: userOverride.maxPromptsPerFinding,
        }
      : null,
  });
}

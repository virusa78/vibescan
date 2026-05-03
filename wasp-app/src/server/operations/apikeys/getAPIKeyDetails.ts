import { HttpError, prisma } from 'wasp/server';
import * as z from 'zod';
import { ensureArgsSchemaOrThrowHttpError } from '../../validation';
import {
  assertWorkspaceOrLegacyOwnership,
  requireWorkspaceScopedUser,
} from '../../services/workspaceAccess';

const getAPIKeyDetailsSchema = z.object({
  keyId: z.string().uuid(),
});

export type GetAPIKeyDetailsInput = z.infer<typeof getAPIKeyDetailsSchema>;

export type APIKeyDetailsResponse = {
  id: string;
  name: string;
  created_at: string;
  expires_at: string | null;
  last_used_at: string | null;
  request_count: number;
  usage_by_day: Array<{ date: string; count: number }>;
  status: 'active' | 'revoked' | 'expired';
};


type ApiKeyUsageEventDelegate = {
  count(args: {
    where: { apiKeyId: string };
  }): Promise<any>;
  findMany(args: {
    where: { apiKeyId: string };
    select: { createdAt: true };
    orderBy: { createdAt: 'desc' };
    take: number;
  }): Promise<Array<{ createdAt: Date }>>;
};

export async function getAPIKeyDetails(
  rawArgs: unknown,
  context: any
): Promise<any> {
  const user = await requireWorkspaceScopedUser(context.user);

  const args = ensureArgsSchemaOrThrowHttpError(
    getAPIKeyDetailsSchema,
    rawArgs
  );

  const apiKey = await prisma.apiKey.findUnique({
    where: { id: args.keyId },
  });

  if (!apiKey) {
    throw new HttpError(404, 'API key not found');
  }

  // Verify ownership
  assertWorkspaceOrLegacyOwnership(apiKey, user, 'API key not found');

  const usageEventModel = prisma as typeof prisma & {
    apiKeyUsageEvent: ApiKeyUsageEventDelegate;
  };

  const [usageCount, usageEvents] = await Promise.all([
    usageEventModel.apiKeyUsageEvent.count({
      where: { apiKeyId: apiKey.id },
    }),
    usageEventModel.apiKeyUsageEvent.findMany({
      where: { apiKeyId: apiKey.id },
      select: { createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 90,
    }),
  ]);

  const usageByDay = new Map<string, number>();
  for (const event of usageEvents) {
    const date = event.createdAt.toISOString().slice(0, 10);
    usageByDay.set(date, (usageByDay.get(date) ?? 0) + 1);
  }

  // Determine status
  let status: 'active' | 'revoked' | 'expired' = 'active';
  if (!apiKey.enabled) {
    status = 'revoked';
  } else if (apiKey.expiresAt && new Date() > apiKey.expiresAt) {
    status = 'expired';
  }

  return {
    id: apiKey.id,
    name: apiKey.name,
    created_at: apiKey.createdAt.toISOString(),
    expires_at: apiKey.expiresAt?.toISOString() || null,
    last_used_at: apiKey.lastUsedAt?.toISOString() || null,
    request_count: usageCount,
    usage_by_day: Array.from(usageByDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count })),
    status: status,
  };
}

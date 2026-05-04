import { prisma } from 'wasp/server';
import * as bcrypt from 'bcrypt';
import { generateApiKeyPrefix, isApiKeyToken, LEGACY_API_KEY_PREFIX } from '../../shared/apiKey';
import { resolveWorkspaceScopedUser } from './workspaceAccess';

type RequestLike = {
  headers: Record<string, string | string[] | undefined>;
  user?: { id: string; workspaceId?: string | null } | null;
};

type ContextLike = {
  user?: { id: string; workspaceId?: string | null } | null;
  entities?: Record<string, unknown>;
};

type AuthenticatedUser = {
  id: string;
  workspaceId: string;
};

type ApiKeyUsageEventWriter = {
  create(args: {
    data: {
      apiKeyId: string;
    };
  }): Promise<unknown>;
};

function getAuthorizationHeader(request: RequestLike): string | undefined {
  const header = request.headers.authorization ?? request.headers.Authorization;
  return Array.isArray(header) ? header[0] : header;
}

export async function authenticateBearerApiKey(authorization: string | undefined): Promise<AuthenticatedUser | null> {
  if (!authorization?.startsWith('Bearer ')) {
    return null;
  }

  const token = authorization.slice(7).trim();
  if (!isApiKeyToken(token)) {
    return null;
  }

  const isLegacyKey = token.startsWith(LEGACY_API_KEY_PREFIX);
  const prefixCandidates = isLegacyKey
    ? []
    : await prisma.apiKey.findMany({
        where: {
          keyPrefix: generateApiKeyPrefix(token),
          enabled: true,
        },
        include: {
          user: {
            select: { id: true, activeWorkspaceId: true },
          },
        },
      });

  const candidates = prefixCandidates.length > 0
    ? prefixCandidates
    : await prisma.apiKey.findMany({
        where: {
          keyPrefix: null,
          enabled: true,
        },
        include: {
          user: {
            select: { id: true, activeWorkspaceId: true },
          },
        },
      });

  for (const candidate of candidates) {
    if (candidate.expiresAt && candidate.expiresAt.getTime() < Date.now()) {
      continue;
    }

    const matched = await bcrypt.compare(token, candidate.keyHash);
    if (!matched) {
      continue;
    }

    await prisma.apiKey.update({
      where: { id: candidate.id },
      data: { lastUsedAt: new Date() },
    });

    const usageEventWriter = (prisma as typeof prisma & {
      apiKeyUsageEvent?: ApiKeyUsageEventWriter;
    }).apiKeyUsageEvent;

    try {
      await usageEventWriter?.create({
        data: {
          apiKeyId: candidate.id,
        },
      });
    } catch (usageError) {
      console.warn('[RequestAuth] Failed to record API key usage event', usageError);
    }

    return resolveWorkspaceScopedUser({
      id: candidate.user.id,
      workspaceId: candidate.workspaceId ?? candidate.user.activeWorkspaceId,
    });
  }

  return null;
}

export async function resolveRequestUser(
  request: RequestLike,
  context: ContextLike,
): Promise<AuthenticatedUser | null> {
  if (context.user) {
    return resolveWorkspaceScopedUser(context.user);
  }

  if (request.user) {
    return resolveWorkspaceScopedUser(request.user);
  }

  return authenticateBearerApiKey(getAuthorizationHeader(request));
}

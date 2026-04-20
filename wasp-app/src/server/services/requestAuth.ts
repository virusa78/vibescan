import { prisma } from 'wasp/server';
import * as bcrypt from 'bcrypt';
import { generateApiKeyPrefix, isApiKeyToken, LEGACY_API_KEY_PREFIX } from '../../shared/apiKey';

type RequestLike = {
  headers: Record<string, string | string[] | undefined>;
  user?: { id: string } | null;
};

type ContextLike = {
  user?: { id: string } | null;
  entities?: Record<string, unknown>;
};

type AuthenticatedUser = {
  id: string;
};

function getAuthorizationHeader(request: RequestLike): string | undefined {
  const header = request.headers.authorization ?? request.headers.Authorization;
  return Array.isArray(header) ? header[0] : header;
}

async function authenticateBearerApiKey(authorization: string | undefined): Promise<AuthenticatedUser | null> {
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
            select: { id: true },
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
            select: { id: true },
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

    return candidate.user;
  }

  return null;
}

export async function resolveRequestUser(
  request: RequestLike,
  context: ContextLike,
): Promise<AuthenticatedUser | null> {
  if (context.user) {
    return context.user;
  }

  if (request.user) {
    return request.user;
  }

  return authenticateBearerApiKey(getAuthorizationHeader(request));
}

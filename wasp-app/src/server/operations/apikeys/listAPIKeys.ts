import { HttpError, prisma } from 'wasp/server';

export type APIKeyInfo = {
  id: string;
  name: string;
  masked_key: string; // Last 4 chars only
  created_at: string;
  last_used_at: string | null;
  status: 'active' | 'revoked';
};

export type APIKeyListResponse = {
  keys: APIKeyInfo[];
};

export async function listAPIKeys(
  _args: any,
  context: any
): Promise<APIKeyListResponse> {
  if (!context.user) {
    throw new HttpError(401, 'User not authenticated');
  }

  const apiKeys = await prisma.apiKey.findMany({
    where: {
      userId: context.user.id,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  const keys: APIKeyInfo[] = apiKeys.map((key) => {
    // Extract last 4 characters from keyHash (it's a bcrypt hash, so we use it as identifier)
    // In reality, we'd need to extract the last 4 chars of the original key which we don't have
    // So we'll use the ID's last 4 chars for display
    const maskedKey = `****${key.id.slice(-4)}`;

    return {
      id: key.id,
      name: key.name,
      masked_key: maskedKey,
      created_at: key.createdAt.toISOString(),
      last_used_at: key.lastUsedAt?.toISOString() || null,
      status: key.enabled ? 'active' : 'revoked',
    };
  });

  return { keys };
}

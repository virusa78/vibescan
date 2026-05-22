import { prisma } from 'wasp/server';
import { buildWorkspaceOrLegacyOwnerWhere, requireWorkspaceScopedUser } from '../../services/workspaceAccess';

export type APIKeyInfo = {
  id: string;
  name: string;
  masked_key: string; // Last 4 chars only
  created_at: string;
  expires_at: string | null;
  last_used_at: string | null;
  status: 'active' | 'revoked' | 'expired';
};

export type APIKeyListResponse = {
  keys: APIKeyInfo[];
};


export async function listAPIKeys(
  _args: unknown,
  context: any
): Promise<any> {
  const user = await requireWorkspaceScopedUser(context.user);

  const apiKeys = await prisma.apiKey.findMany({
    where: buildWorkspaceOrLegacyOwnerWhere(user),
    select: {
      id: true,
      name: true,
      enabled: true,
      createdAt: true,
      expiresAt: true,
      lastUsedAt: true,
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
    const isExpired = key.expiresAt ? new Date() > key.expiresAt : false;

    return {
      id: key.id,
      name: key.name,
      masked_key: maskedKey,
      created_at: key.createdAt.toISOString(),
      expires_at: key.expiresAt?.toISOString() || null,
      last_used_at: key.lastUsedAt?.toISOString() || null,
      status: key.enabled ? (isExpired ? 'expired' : 'active') : 'revoked',
    };
  });

  return { keys };
}

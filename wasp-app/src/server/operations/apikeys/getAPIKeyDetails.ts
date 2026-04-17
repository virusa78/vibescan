import { HttpError, prisma } from 'wasp/server';
import * as z from 'zod';
import { ensureArgsSchemaOrThrowHttpError } from '../../validation';

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
  status: 'active' | 'revoked' | 'expired';
};

export async function getAPIKeyDetails(
  rawArgs: any,
  context: any
): Promise<APIKeyDetailsResponse> {
  if (!context.user) {
    throw new HttpError(401, 'User not authenticated');
  }

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
  if (apiKey.userId !== context.user.id) {
    throw new HttpError(403, 'Access denied');
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
    request_count: 0, // Placeholder for usage tracking
    status: status,
  };
}

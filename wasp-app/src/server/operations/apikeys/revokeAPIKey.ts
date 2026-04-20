import { HttpError, prisma } from 'wasp/server';
import * as z from 'zod';
import { ensureArgsSchemaOrThrowHttpError } from '../../validation';

const revokeAPIKeySchema = z.object({
  keyId: z.string().uuid(),
});

export type RevokeAPIKeyInput = z.infer<typeof revokeAPIKeySchema>;

export type ActionResponse = {
  success: boolean;
  message: string;
};

export async function revokeAPIKey(
  rawArgs: any,
  context: any
): Promise<ActionResponse> {
  if (!context.user) {
    throw new HttpError(401, 'User not authenticated');
  }

  const args = ensureArgsSchemaOrThrowHttpError(
    revokeAPIKeySchema,
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
    throw new HttpError(404, 'API key not found');
  }

  // Mark as revoked (disabled)
  await prisma.apiKey.update({
    where: { id: args.keyId },
    data: { enabled: false },
  });

  return {
    success: true,
    message: 'API key revoked successfully',
  };
}

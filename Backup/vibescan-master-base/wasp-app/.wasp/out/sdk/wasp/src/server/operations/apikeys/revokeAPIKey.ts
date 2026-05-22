import { HttpError, prisma } from 'wasp/server';
import * as z from 'zod';
import { ensureArgsSchemaOrThrowHttpError } from '../../validation';
import {
  assertWorkspaceOrLegacyOwnership,
  requireWorkspaceScopedUser,
} from '../../services/workspaceAccess';

const revokeAPIKeySchema = z.object({
  keyId: z.string().uuid(),
});

export type RevokeAPIKeyInput = z.infer<typeof revokeAPIKeySchema>;

export type ActionResponse = {
  success: boolean;
  message: string;
};


export async function revokeAPIKey(
  rawArgs: unknown,
  context: any
): Promise<any> {
  const user = await requireWorkspaceScopedUser(context.user);

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
  assertWorkspaceOrLegacyOwnership(apiKey, user, 'API key not found');

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

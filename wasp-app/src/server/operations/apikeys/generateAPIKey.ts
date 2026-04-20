import { HttpError, prisma } from 'wasp/server';
import * as z from 'zod';
import * as bcrypt from 'bcrypt';
import { ensureArgsSchemaOrThrowHttpError } from '../../validation';
import { generateRandomKey } from '../../utils/keyGenerator';
import { generateApiKeyPrefix } from '../../../shared/apiKey';

const generateAPIKeySchema = z.object({
  name: z.string().min(1).max(255),
  expiresIn: z.enum(['30', '90', '365', 'never']).optional().default('90'),
});

export type GenerateAPIKeyInput = z.infer<typeof generateAPIKeySchema>;

export type APIKeyResponse = {
  id: string;
  name: string;
  key: string; // Raw key shown only on generation
  created_at: string;
  expires_at: string | null;
};

export async function generateAPIKey(
  rawArgs: any,
  context: any
): Promise<APIKeyResponse> {
  if (!context.user) {
    throw new HttpError(401, 'User not authenticated');
  }

  const args = ensureArgsSchemaOrThrowHttpError(
    generateAPIKeySchema,
    rawArgs
  );

  // Generate random API key
  const rawKey = generateRandomKey();

  // Hash the key with bcrypt
  const saltRounds = 10;
  const keyHash = await bcrypt.hash(rawKey, saltRounds);

  // Calculate expiry date
  let expiresAt: Date | null = null;
  if (args.expiresIn !== 'never') {
    const days = parseInt(args.expiresIn, 10);
    expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);
  }

  // Store in database
  const apiKey = await prisma.apiKey.create({
      data: {
        userId: context.user.id,
        name: args.name,
        keyHash: keyHash,
        keyPrefix: generateApiKeyPrefix(rawKey),
        expiresAt: expiresAt,
        lastUsedAt: null,
        enabled: true,
      },
  });

  // Return response with raw key (shown only once!)
  return {
    id: apiKey.id,
    name: apiKey.name,
    key: rawKey, // Raw key returned only on generation
    created_at: apiKey.createdAt.toISOString(),
    expires_at: apiKey.expiresAt?.toISOString() || null,
  };
}

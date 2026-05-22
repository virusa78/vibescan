import { prisma } from 'wasp/server';
import * as z from 'zod';
import * as bcrypt from 'bcrypt';
import { ensureArgsSchemaOrThrowHttpError } from '../../validation';
import { generateRandomKey } from '../../utils/keyGenerator';
import { generateApiKeyPrefix } from '../../../shared/apiKey';
import { requireWorkspaceScopedUser } from '../../services/workspaceAccess';
const generateAPIKeySchema = z.object({
    name: z.string().min(1).max(255),
    expiresIn: z.enum(['30', '90', '365', 'never']).optional().default('90'),
});
export async function generateAPIKey(rawArgs, context) {
    const user = await requireWorkspaceScopedUser(context.user);
    const args = ensureArgsSchemaOrThrowHttpError(generateAPIKeySchema, rawArgs);
    // Generate random API key
    const rawKey = generateRandomKey();
    // Hash the key with bcrypt
    const saltRounds = 10;
    const keyHash = await bcrypt.hash(rawKey, saltRounds);
    // Calculate expiry date
    let expiresAt = null;
    if (args.expiresIn !== 'never') {
        const days = parseInt(args.expiresIn, 10);
        expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + days);
    }
    // Store in database
    const apiKey = await prisma.apiKey.create({
        data: {
            userId: user.id,
            workspaceId: user.workspaceId,
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
//# sourceMappingURL=generateAPIKey.js.map
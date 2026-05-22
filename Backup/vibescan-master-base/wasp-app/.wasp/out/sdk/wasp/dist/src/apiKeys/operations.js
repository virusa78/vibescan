import { HttpError } from 'wasp/server';
import { v4 as uuidv4 } from 'uuid';
import * as bcrypt from 'bcrypt';
import { generateApiKeyPrefix, API_KEY_PREFIX } from '../shared/apiKey';
const BCRYPT_ROUNDS = 10;
const API_KEY_LENGTH = 32; // length of random part
/**
 * Generate a new API key for the authenticated user
 */
export async function generateApiKey(args, context) {
    if (!context.user) {
        throw new HttpError(401, 'User not authenticated');
    }
    if (!args.name || args.name.trim().length === 0) {
        throw new HttpError(400, 'API key name is required');
    }
    // Generate raw key (will be hashed before storage)
    const rawKey = API_KEY_PREFIX + uuidv4().replace(/-/g, '').substring(0, API_KEY_LENGTH);
    const keyHash = await bcrypt.hash(rawKey, BCRYPT_ROUNDS);
    const apiKey = await context.entities.ApiKey.create({
        data: {
            userId: context.user.id,
            name: args.name.trim(),
            keyHash,
            keyPrefix: generateApiKeyPrefix(rawKey),
            enabled: true,
        },
    });
    // Return the raw key (only shown once)
    return {
        id: apiKey.id,
        key: rawKey,
        name: apiKey.name,
        createdAt: apiKey.createdAt,
    };
}
/**
 * List all API keys for the authenticated user
 */
export async function listApiKeys(_args, context) {
    if (!context.user) {
        throw new HttpError(401, 'User not authenticated');
    }
    const apiKeys = await context.entities.ApiKey.findMany({
        where: { userId: context.user.id },
        select: {
            id: true,
            name: true,
            enabled: true,
            createdAt: true,
            expiresAt: true,
            lastUsedAt: true,
            keyPrefix: true,
        },
        orderBy: { createdAt: 'desc' },
    });
    return apiKeys;
}
/**
 * Revoke an API key (disable or delete)
 */
export async function revokeApiKey(args, context) {
    if (!context.user) {
        throw new HttpError(401, 'User not authenticated');
    }
    // Verify ownership
    const apiKey = await context.entities.ApiKey.findUnique({
        where: { id: args.id },
    });
    if (!apiKey) {
        throw new HttpError(404, 'API key not found');
    }
    if (apiKey.userId !== context.user.id) {
        throw new HttpError(404, 'API key not found');
    }
    // Delete the key
    await context.entities.ApiKey.delete({
        where: { id: args.id },
    });
    return { success: true };
}
//# sourceMappingURL=operations.js.map
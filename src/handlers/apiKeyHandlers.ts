/**
 * API Key handlers
 *
 * Handles /api-keys/* endpoints
 */

import { authService } from '../services/authService.js';
import { createError } from '../utils/index.js';

/**
 * Generate API key handler
 */
export async function generateApiKeyHandler(request: any, reply: any): Promise<void> {
    const userId = request.apiKey?.user_id || request.user?.userId;
    console.log('generateApiKeyHandler - userId:', userId, 'request.user:', request.user, 'request.apiKey:', request.apiKey);

    // Require authentication
    if (!userId) {
        reply.code(401).send({
            error: 'unauthorized',
            message: 'Authentication required'
        });
        return;
    }

    const { label, scopes } = request.body;

    // Validate input
    if (!label) {
        reply.code(400).send({
            error: 'validation_error',
            message: 'Label is required'
        });
        return;
    }

    // Default scopes if not provided
    const validScopes = ['sbom_submit', 'scan_read', 'webhook_manage'];
    const keyScopes = scopes || ['scan_read'];

    // Validate scopes
    for (const scope of keyScopes) {
        if (!validScopes.includes(scope)) {
            reply.code(400).send({
                error: 'validation_error',
                message: `Invalid scope: ${scope}. Valid scopes: ${validScopes.join(', ')}`
            });
            return;
        }
    }

    try {
        const { rawKey, keyId } = await authService.generateApiKey(
            userId,
            label,
            keyScopes
        );

        reply.code(201).send({
            success: true,
            data: {
                keyId,
                rawKey,
                label,
                scopes: keyScopes,
                keyPrefix: rawKey.substring(0, 8)
            },
            warning: 'API key returned once. Store it securely.'
        });
    } catch (error: any) {
        reply.code(500).send({
            error: 'internal_error',
            message: 'Failed to generate API key'
        });
    }
}

/**
 * List API keys handler
 */
export async function listApiKeysHandler(request: any, reply: any): Promise<void> {
    const userId = request.apiKey?.user_id || request.user?.userId;

    // Require authentication
    if (!userId) {
        reply.code(401).send({
            error: 'unauthorized',
            message: 'Authentication required'
        });
        return;
    }

    const { limit = 20, cursor } = request.query;

    try {
        const apiKeys = await authService.listApiKeys(userId);

        // Paginate results
        const startIndex = parseInt(cursor || '0');
        const paginatedKeys = apiKeys.slice(startIndex, startIndex + parseInt(limit));

        reply.code(200).send({
            success: true,
            data: {
                items: paginatedKeys.map(key => ({
                    id: key.id,
                    keyPrefix: key.key_prefix,
                    label: key.label,
                    scopes: key.scopes,
                    lastUsedAt: key.last_used_at,
                    revokedAt: key.revoked_at,
                    createdAt: key.created_at
                })),
                nextCursor: startIndex + paginatedKeys.length < apiKeys.length
                    ? (startIndex + paginatedKeys.length).toString()
                    : undefined,
                total: apiKeys.length
            }
        });
    } catch (error: any) {
        reply.code(500).send({
            error: 'internal_error',
            message: 'Failed to list API keys'
        });
    }
}

/**
 * Revoke API key handler
 */
export async function revokeApiKeyHandler(request: any, reply: any): Promise<void> {
    const userId = request.apiKey?.user_id || request.user?.userId;

    // Require authentication
    if (!userId) {
        reply.code(401).send({
            error: 'unauthorized',
            message: 'Authentication required'
        });
        return;
    }

    const { id } = request.params;

    // Validate input
    if (!id) {
        reply.code(400).send({
            error: 'validation_error',
            message: 'API key ID is required'
        });
        return;
    }

    try {
        // First verify the key belongs to the user
        const pool = require('../database/client.js').getPool();
        const result = await pool.query(
            'SELECT id, user_id FROM api_keys WHERE id = $1',
            [id]
        );

        if (result.rows.length === 0) {
            reply.code(404).send({
                error: 'not_found',
                message: 'API key not found'
            });
            return;
        }

        if (result.rows[0].user_id !== userId) {
            reply.code(403).send({
                error: 'forbidden',
                message: 'Cannot revoke API keys belonging to other users'
            });
            return;
        }

        await authService.revokeApiKey(id);

        reply.code(204).send();
    } catch (error: any) {
        reply.code(500).send({
            error: 'internal_error',
            message: 'Failed to revoke API key'
        });
    }
}

export default {
    generateApiKeyHandler,
    listApiKeysHandler,
    revokeApiKeyHandler
};

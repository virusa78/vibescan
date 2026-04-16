/**
 * API Gateway middleware
 *
 * Implements rate limiting, ownership verification, API key authentication,
 * and request validation.
 */

import { getRedisClient } from '../redis/client.js';
import { authService } from '../services/authService.js';
import { checkAndConsumeQuota } from '../redis/quota.js';
import config from '../config/index.js';
import { createError } from '../utils/index.js';
import { getPool } from '../database/client.js';

// Rate limiter middleware
export async function rateLimitMiddleware(
    request: any,
    reply: any,
    done: any
): Promise<void> {
    const redis = await getRedisClient();
    const clientIp = request.headers['x-forwarded-for'] || request.ip || request.connection.remoteAddress;
    const rateLimitKey = `ratelimit:${clientIp}:${Date.now()}`;

    // Get current rate
    const currentRate = await redis.incr(rateLimitKey);
    await redis.expire(rateLimitKey, config.RATE_LIMIT_WINDOW_MS / 1000);

    // Set rate limit headers
    reply.header('X-RateLimit-Limit', config.RATE_LIMIT_MAX_REQUESTS.toString());
    reply.header('X-RateLimit-Remaining', Math.max(0, config.RATE_LIMIT_MAX_REQUESTS - currentRate).toString());
    reply.header('X-RateLimit-Reset', Math.ceil((Date.now() + config.RATE_LIMIT_WINDOW_MS) / 1000).toString());

    if (currentRate > config.RATE_LIMIT_MAX_REQUESTS) {
        reply.code(429).send({
            error: 'rate_limit_exceeded',
            message: 'Too many requests. Please try again later.',
            retryAfter: Math.ceil(config.RATE_LIMIT_WINDOW_MS / 1000)
        });
        return;
    }

    done();
}

// API Key authentication middleware
export async function apiKeyAuthMiddleware(
    request: any,
    reply: any,
    done: any
): Promise<void> {
    const authorizationHeader = request.headers['authorization'];
    const apiKeyHeader = request.headers['x-api-key'];

    let apiKey;

    if (authorizationHeader) {
        apiKey = await authService.verifyApiKeyFromHeader(authorizationHeader);
    } else if (apiKeyHeader) {
        apiKey = await authService.verifyApiKey(apiKeyHeader);
    }

    if (!apiKey) {
        reply.code(401).send({
            error: 'invalid_api_key',
            message: 'Invalid or expired API key'
        });
        return;
    }

    request.apiKey = apiKey;
    done();
}

// Ownership verification middleware
export async function ownershipVerificationMiddleware(
    request: any,
    reply: any,
    done: any
): Promise<void> {
    const userId = request.apiKey?.user_id || request.user?.userId;

    if (!userId) {
        reply.code(401).send({
            error: 'unauthorized',
            message: 'Authentication required'
        });
        return;
    }

    // Check if user owns the resource
    const resourceId = request.params?.id || request.body?.user_id;
    const scanId = request.params?.scanId;

    if (resourceId && resourceId !== userId) {
        // Check if user is member of organization that owns the resource
        const pool = getPool();
        const result = await pool.query(
            `SELECT 1 FROM scans WHERE id = $1 AND (user_id = $2 OR org_id IN (
                SELECT id FROM organizations WHERE owner_user_id = $2 OR $2 = ANY(members)
            ))`,
            [scanId || resourceId, userId]
        );

        if (result.rows.length === 0) {
            reply.code(403).send({
                error: 'forbidden',
                message: 'Access denied'
            });
            return;
        }
    }

    done();
}

// Request validation middleware
export function requestValidationMiddleware(schema: any) {
    return async (request: any, reply: any, done: any) => {
        // Validate request body against schema
        try {
            const parsed = schema.parse(request.body);
            request.validatedBody = parsed;
        } catch (error: any) {
            reply.code(400).send({
                error: 'validation_error',
                message: 'Request validation failed',
                details: error.errors
            });
            return;
        }

        done();
    };
}

// Error handling middleware
export function errorHandlingMiddleware(
    error: any,
    request: any,
    reply: any,
    done: any
): void {
    // Log error
    console.error('Request error:', error);

    // Determine HTTP status code
    let statusCode = 500;
    let errorCode = 'internal_error';
    let errorMessage = 'An unexpected error occurred';

    if (error.code) {
        switch (error.code) {
            case 'FST_ERR_CTP_BODY_TOO_LARGE':
            case 'payload_too_large':
                statusCode = 413;
                errorCode = 'payload_too_large';
                errorMessage = error.message || 'Payload too large';
                break;
            case 'unauthorized':
                statusCode = 401;
                errorCode = 'unauthorized';
                errorMessage = error.message || 'Unauthorized';
                break;
            case 'forbidden':
                statusCode = 403;
                errorCode = 'forbidden';
                errorMessage = error.message || 'Access denied';
                break;
            case 'not_found':
                statusCode = 404;
                errorCode = 'not_found';
                errorMessage = error.message || 'Resource not found';
                break;
            case 'rate_limit_exceeded':
                statusCode = 429;
                errorCode = 'rate_limit_exceeded';
                errorMessage = error.message || 'Rate limit exceeded';
                break;
            case 'validation_error':
                statusCode = 400;
                errorCode = 'validation_error';
                errorMessage = error.message || 'Validation failed';
                break;
            case 'quota_exceeded':
                statusCode = 429;
                errorCode = 'quota_exceeded';
                errorMessage = error.message || 'Quota exceeded';
                break;
            case 'invalid_sbom':
                statusCode = 400;
                errorCode = 'invalid_sbom';
                errorMessage = error.message || 'Invalid SBOM';
                break;
            case 'bd_timeout':
                statusCode = 408;
                errorCode = 'bd_timeout';
                errorMessage = error.message || 'Codescoring timeout';
                break;
        }
    }

    // Send error response
    reply.code(statusCode).send({
        error: errorCode,
        message: errorMessage,
        details: error.details || null,
        timestamp: new Date().toISOString()
    });
}

// Quota verification middleware
export async function quotaVerificationMiddleware(
    request: any,
    reply: any,
    done: any
): Promise<void> {
    const userId = request.apiKey?.user_id || request.user?.userId;

    if (!userId) {
        reply.code(401).send({
            error: 'unauthorized',
            message: 'Authentication required'
        });
        return;
    }

    const result = await checkAndConsumeQuota(userId);
    request.quota = result;

    if (!result.allowed) {
        reply.code(429).send({
            error: 'quota_exceeded',
            message: 'Monthly scan limit reached',
            remaining: result.remaining,
            resetAt: result.resetAt.toISOString()
        });
        return;
    }

    done();
}

export default {
    rateLimitMiddleware,
    apiKeyAuthMiddleware,
    ownershipVerificationMiddleware,
    requestValidationMiddleware,
    errorHandlingMiddleware,
    quotaVerificationMiddleware
};

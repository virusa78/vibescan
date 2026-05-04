import { getRedisConnectionConfig } from '../config/runtime.js';
import { isTestEnvironment } from '../config/env.js';
export const DEFAULT_JSON_BODY_LIMIT_BYTES = 64 * 1024;
export function parseJsonBodyWithLimit(body, limitBytes = DEFAULT_JSON_BODY_LIMIT_BYTES) {
    if (!body) {
        return {};
    }
    if (typeof body === 'string') {
        if (Buffer.byteLength(body, 'utf8') > limitBytes) {
            throw Object.assign(new Error('request_too_large'), { statusCode: 413, data: { error: 'request_too_large' } });
        }
        try {
            return JSON.parse(body);
        }
        catch {
            throw Object.assign(new Error('validation_error'), { statusCode: 400, data: { error: 'validation_error' } });
        }
    }
    if (Buffer.isBuffer(body)) {
        if (body.byteLength > limitBytes) {
            throw Object.assign(new Error('request_too_large'), { statusCode: 413, data: { error: 'request_too_large' } });
        }
        try {
            return JSON.parse(body.toString('utf8'));
        }
        catch {
            throw Object.assign(new Error('validation_error'), { statusCode: 400, data: { error: 'validation_error' } });
        }
    }
    return body;
}
async function createRedisClient() {
    const redisModule = await import('redis');
    const redisConfig = getRedisConnectionConfig();
    return redisModule.createClient({
        socket: {
            host: redisConfig.host,
            port: redisConfig.port,
        },
    });
}
export async function enforceRateLimit(options) {
    const redis = await createRedisClient();
    let connected = false;
    try {
        await redis.connect();
        connected = true;
        const current = await redis.incr(options.key);
        if (current === 1) {
            await redis.expire(options.key, options.windowSeconds);
        }
        if (current > options.limit) {
            throw Object.assign(new Error('quota_exceeded'), { statusCode: 429, data: { error: 'quota_exceeded' } });
        }
    }
    catch (error) {
        if (typeof error === 'object' && error !== null && 'statusCode' in error) {
            throw error;
        }
        if (!isTestEnvironment()) {
            throw Object.assign(new Error('internal_error'), { statusCode: 500, data: { error: 'internal_error' } });
        }
    }
    finally {
        if (connected) {
            await redis.quit();
        }
    }
}
export function getRateLimitKey(scope, identity) {
    return `rate_limit:${scope}:${identity}`;
}
//# sourceMappingURL=requestGuards.js.map
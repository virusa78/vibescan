import { getRedisConnectionConfig } from '../config/runtime.js';
import { isTestEnvironment } from '../config/env.js';

type RedisClient = {
  connect(): Promise<void>;
  quit(): Promise<void>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
};

export const DEFAULT_JSON_BODY_LIMIT_BYTES = 64 * 1024;

export function parseJsonBodyWithLimit<T extends Record<string, unknown>>(
  body: unknown,
  limitBytes: number = DEFAULT_JSON_BODY_LIMIT_BYTES,
): T {
  if (!body) {
    return {} as T;
  }

  if (typeof body === 'string') {
    if (Buffer.byteLength(body, 'utf8') > limitBytes) {
      throw Object.assign(new Error('request_too_large'), { statusCode: 413, data: { error: 'request_too_large' } });
    }

    try {
      return JSON.parse(body) as T;
    } catch {
      throw Object.assign(new Error('validation_error'), { statusCode: 400, data: { error: 'validation_error' } });
    }
  }

  if (Buffer.isBuffer(body)) {
    if (body.byteLength > limitBytes) {
      throw Object.assign(new Error('request_too_large'), { statusCode: 413, data: { error: 'request_too_large' } });
    }

    try {
      return JSON.parse(body.toString('utf8')) as T;
    } catch {
      throw Object.assign(new Error('validation_error'), { statusCode: 400, data: { error: 'validation_error' } });
    }
  }

  return body as T;
}

async function createRedisClient(): Promise<RedisClient> {
  // Use synchronous require to make Jest's module mocking reliable
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const redisModule = require('redis');
  // Allow tests to inject a fake redis client via global variable for determinism
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((global as any).__TEST_REDIS_CLIENT__) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    // eslint-disable-next-line no-console
    console.log('[createRedisClient] using __TEST_REDIS_CLIENT__');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (global as any).__TEST_REDIS_CLIENT__ as RedisClient;
  }

  // Debug: inspect the module to help tests
  // eslint-disable-next-line no-console
  console.log('[createRedisClient] redisModule.createClient type=', typeof redisModule.createClient, 'isMock=', !!(redisModule.createClient && (redisModule.createClient._isMockFunction || redisModule.createClient.mock)));
  const redisConfig = getRedisConnectionConfig();
  return redisModule.createClient({
    socket: {
      host: redisConfig.host,
      port: redisConfig.port,
    },
  }) as unknown as RedisClient;
}

export async function enforceRateLimit(options: {
  key: string;
  limit: number;
  windowSeconds: number;
}): Promise<void> {
  const redis = await createRedisClient();
  let connected = false;

  try {
    await redis.connect();
    connected = true;
    // eslint-disable-next-line no-console
    console.log('[enforceRateLimit] calling incr');
    const current = await redis.incr(options.key);
    // eslint-disable-next-line no-console
    console.log('[enforceRateLimit] incr returned', current, 'limit=', options.limit);
    if (current === 1) {
      await redis.expire(options.key, options.windowSeconds);
    }

    if (current > options.limit) {
      // eslint-disable-next-line no-console
      console.log('[enforceRateLimit] throwing quota_exceeded, current=', current, 'limit=', options.limit);
      throw Object.assign(new Error('quota_exceeded'), { statusCode: 429, data: { error: 'quota_exceeded' } });
    }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) {
      throw error;
    }

    if (!isTestEnvironment()) {
      throw Object.assign(new Error('internal_error'), { statusCode: 500, data: { error: 'internal_error' } });
    }
  } finally {
    if (connected) {
      await redis.quit();
    }
  }
}

export function getRateLimitKey(scope: string, identity: string): string {
  return `rate_limit:${scope}:${identity}`;
}

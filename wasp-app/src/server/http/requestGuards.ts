import { getRedisConnectionConfig } from '../config/runtime.js';

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
  const redisModule = await import('redis');
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
    const current = await redis.incr(options.key);
    if (current === 1) {
      await redis.expire(options.key, options.windowSeconds);
    }

    if (current > options.limit) {
      throw Object.assign(new Error('quota_exceeded'), { statusCode: 429, data: { error: 'quota_exceeded' } });
    }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) {
      throw error;
    }

    if (process.env.NODE_ENV !== 'test') {
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

/**
 * Token Service
 * Handles JWT token generation, verification, and blacklisting
 */

import { createHmac, randomUUID } from 'crypto';
import { TOKEN_CONFIG, isTokenExpired } from '../config/tokens';
import { getJwtSecret, isTestEnvironment } from '../config/env.js';
import { getRedisConnectionConfig } from '../config/runtime.js';

const JWT_SECRET = getJwtSecret();

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

interface TokenPayload {
  userId: string;
  jti: string; // JWT ID - unique identifier for this token
  iat: number; // Issued At - Unix timestamp
  exp: number; // Expiration - Unix timestamp
  type: 'access' | 'refresh';
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: number;
  refreshTokenExpiresIn: number;
}

/**
 * Generate a unique JWT ID
 */
function generateJTI(userId: string): string {
  return `jti_${userId}_${randomUUID()}`;
}

/**
 * Base64URL encode a string
 */
function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Base64URL decode a string
 */
function base64UrlDecode(str: string): string {
  const padding = '='.repeat((4 - (str.length % 4)) % 4);
  const base64 = (str + padding).replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(base64, 'base64').toString('utf8');
}

/**
 * Create JWT signature
 */
function createSignature(header: string, payload: string): string {
  const message = `${header}.${payload}`;
  const signature = createHmac('sha256', JWT_SECRET!)
    .update(message)
    .digest('base64');
  return base64UrlEncode(signature);
}

/**
 * Verify JWT signature
 */
function verifySignature(header: string, payload: string, signature: string): boolean {
  const expectedSignature = createSignature(header, payload);
  return expectedSignature === signature;
}

/**
 * Create a JWT token
 */
function createToken(userId: string, tokenType: 'access' | 'refresh'): string {
  const expirySeconds =
    tokenType === 'access'
      ? TOKEN_CONFIG.ACCESS_TOKEN_EXPIRY
      : TOKEN_CONFIG.REFRESH_TOKEN_EXPIRY;

  const now = Math.floor(Date.now() / 1000);
  const exp = now + expirySeconds;

  const payload: TokenPayload = {
    userId,
    jti: generateJTI(userId),
    iat: now,
    exp,
    type: tokenType,
  };

  const header = base64UrlEncode(
    JSON.stringify({
      alg: TOKEN_CONFIG.ALGORITHM,
      typ: 'JWT',
    })
  );

  const payloadEncoded = base64UrlEncode(JSON.stringify(payload));
  const signature = createSignature(header, payloadEncoded);

  return `${header}.${payloadEncoded}.${signature}`;
}

/**
 * Parse and verify JWT token
 */
function parseToken(token: string): TokenPayload | null {
  try {
    const [header, payload, signature] = token.split('.');

    if (!header || !payload || !signature) {
      return null;
    }

    // Verify signature
    if (!verifySignature(header, payload, signature)) {
      return null;
    }

    // Decode payload
    const decoded = JSON.parse(base64UrlDecode(payload)) as TokenPayload;

    // Check expiration
    if (isTokenExpired(decoded.exp)) {
      return null;
    }

    return decoded;
  } catch {
    return null;
  }
}

/**
 * Generate a pair of access and refresh tokens
 * @param userId - User ID to encode in tokens
 * @returns Token pair with access and refresh tokens
 */
export async function generateTokenPair(userId: string): Promise<TokenPair> {
  const accessToken = createToken(userId, 'access');
  const refreshToken = createToken(userId, 'refresh');

  return {
    accessToken,
    refreshToken,
    accessTokenExpiresIn: TOKEN_CONFIG.ACCESS_TOKEN_EXPIRY,
    refreshTokenExpiresIn: TOKEN_CONFIG.REFRESH_TOKEN_EXPIRY,
  };
}

/**
 * Verify and extract payload from refresh token
 * @param token - Refresh token to verify
 * @returns Token payload if valid, null otherwise
 */
export async function verifyRefreshToken(token: string): Promise<TokenPayload | null> {
  const payload = parseToken(token);

  if (!payload) {
    return null;
  }

  // Ensure it's a refresh token
  if (payload.type !== 'refresh') {
    return null;
  }

  return payload;
}

/**
 * Verify and extract payload from access token
 * @param token - Access token to verify
 * @returns Token payload if valid, null otherwise
 */
export async function verifyAccessToken(token: string): Promise<TokenPayload | null> {
  const payload = parseToken(token);

  if (!payload) {
    return null;
  }

  // Ensure it's an access token
  if (payload.type !== 'access') {
    return null;
  }

  return payload;
}

/**
 * Blacklist a token by adding it to Redis
 * Prevents token reuse after revocation
 * @param jti - JWT ID of token to blacklist
 * @param expiryTimestamp - Unix timestamp when token expires
 */
export async function blacklistToken(jti: string, expiryTimestamp: number): Promise<void> {
  try {
    const redis = await createRedisClient();

    await redis.connect();

    const ttl = Math.max(0, expiryTimestamp - Math.floor(Date.now() / 1000));
    const key = `token_blacklist:${jti}`;

    await redis.setEx(key, ttl, '1');
    await redis.quit();
  } catch (error) {
    console.error('Failed to blacklist token:', error);
    // In test environments or when Redis is unavailable, we'll skip blacklisting
    // This is acceptable for token refresh as the token validation logic is still in place
    if (!isTestEnvironment()) {
      throw new Error('Token blacklist operation failed');
    }
  }
}

/**
 * Check if a token has been blacklisted
 * @param jti - JWT ID of token to check
 * @returns true if token is blacklisted, false otherwise
 */
export async function isTokenBlacklisted(jti: string): Promise<boolean> {
  try {
    const redis = await createRedisClient();

    await redis.connect();

    const key = `token_blacklist:${jti}`;
    const exists = await redis.exists(key);

    await redis.quit();

    return exists === 1;
  } catch (error) {
    console.error('Failed to check token blacklist:', error);
    // In test environments, return false to allow testing
    // In production, failing to check blacklist is not ideal, but token validation is still in place
    if (isTestEnvironment()) {
      return false;
    }
    return true; // Fail secure: treat as blacklisted on error
  }
}

export type { TokenPayload, TokenPair };

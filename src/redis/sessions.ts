/**
 * Session management using Redis
 *
 * Stores refresh tokens and session data for fast lookup.
 */

import { getRedisClient } from './client.js';
import crypto from 'crypto';

// Session configuration
const SESSION_PREFIX = 'vibescan:session:';
const SESSION_TTL = 30 * 24 * 60 * 60; // 30 days

/**
 * Session data stored in Redis
 */
interface SessionData {
    userId: string;
    email: string;
    plan: string;
    expiresAt: number;
    ipAddress?: string;
    userAgent?: string;
}

/**
 * Get session key for a token
 */
function getSessionKey(refreshToken: string): string {
    // Use hash of token for security
    const hash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    return `${SESSION_PREFIX}token:${hash}`;
}

/**
 * Store a session in Redis
 * @param refreshToken - The refresh token
 * @param sessionData - Session data to store
 * @returns true if stored successfully
 */
export async function storeSession(
    refreshToken: string,
    sessionData: SessionData
): Promise<boolean> {
    const redis = await getRedisClient();
    const sessionKey = getSessionKey(refreshToken);

    await redis.set(
        sessionKey,
        JSON.stringify(sessionData),
        { EX: SESSION_TTL }
    );

    return true;
}

/**
 * Get session data from Redis
 * @param refreshToken - The refresh token
 * @returns Session data or null if not found/expired
 */
export async function getSession(
    refreshToken: string
): Promise<SessionData | null> {
    const redis = await getRedisClient();
    const sessionKey = getSessionKey(refreshToken);

    const sessionData = await redis.get(sessionKey);
    if (!sessionData) return null;

    return JSON.parse(sessionData) as SessionData;
}

/**
 * Delete a session from Redis (logout/invalidate)
 * @param refreshToken - The refresh token
 * @returns true if session was deleted
 */
export async function deleteSession(refreshToken: string): Promise<boolean> {
    const redis = await getRedisClient();
    const sessionKey = getSessionKey(refreshToken);

    const deleted = await redis.del(sessionKey);
    return deleted > 0;
}

/**
 * Refresh session TTL (extend expiration)
 * @param refreshToken - The refresh token
 * @returns true if TTL was extended
 */
export async function refreshSessionTTL(refreshToken: string): Promise<boolean> {
    const redis = await getRedisClient();
    const sessionKey = getSessionKey(refreshToken);

    const exists = await redis.exists(sessionKey);
    if (exists === 0) return false;

    await redis.expire(sessionKey, SESSION_TTL);
    return true;
}

/**
 * Store access token for quick validation
 * @param accessToken - The access token
 * @param userId - User ID
 * @param ttl - Time to live in seconds
 */
export async function storeAccessToken(
    accessToken: string,
    userId: string,
    ttl: number = 900 // 15 minutes default
): Promise<void> {
    const redis = await getRedisClient();
    const tokenKey = `${SESSION_PREFIX}access:${accessToken}`;

    await redis.set(
        tokenKey,
        userId,
        { EX: ttl }
    );
}

/**
 * Validate access token
 * @param accessToken - The access token
 * @returns User ID if valid, null otherwise
 */
export async function validateAccessToken(
    accessToken: string
): Promise<string | null> {
    const redis = await getRedisClient();
    const tokenKey = `${SESSION_PREFIX}access:${accessToken}`;

    const userId = await redis.get(tokenKey);
    return userId || null;
}

/**
 * Invalidate access token
 * @param accessToken - The access token
 */
export async function invalidateAccessToken(accessToken: string): Promise<void> {
    const redis = await getRedisClient();
    const tokenKey = `${SESSION_PREFIX}access:${accessToken}`;

    await redis.del(tokenKey);
}

/**
 * Store temporary data (e.g., verification codes)
 * @param key - The key
 * @param value - The value to store
 * @param ttl - Time to live in seconds (default: 10 minutes)
 */
export async function setTemporaryData(
    key: string,
    value: string,
    ttl: number = 600
): Promise<void> {
    const redis = await getRedisClient();
    const tempKey = `${SESSION_PREFIX}temp:${key}`;

    await redis.set(tempKey, value, { EX: ttl });
}

/**
 * Get temporary data
 * @param key - The key
 * @returns Value or null if not found/expired
 */
export async function getTemporaryData(key: string): Promise<string | null> {
    const redis = await getRedisClient();
    const tempKey = `${SESSION_PREFIX}temp:${key}`;

    return await redis.get(tempKey);
}

/**
 * Delete temporary data
 * @param key - The key
 */
export async function deleteTemporaryData(key: string): Promise<void> {
    const redis = await getRedisClient();
    const tempKey = `${SESSION_PREFIX}temp:${key}`;

    await redis.del(tempKey);
}

export default {
    storeSession,
    getSession,
    deleteSession,
    refreshSessionTTL,
    storeAccessToken,
    validateAccessToken,
    invalidateAccessToken,
    setTemporaryData,
    getTemporaryData,
    deleteTemporaryData
};

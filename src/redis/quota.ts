/**
 * Quota management using Redis
 *
 * Provides fast quota tracking with Redis INCR for high throughput.
 * PostgreSQL is the source of truth; Redis is used for fast reads.
 */

import { getRedisClient } from './client.js';
import { getPool } from '../database/client.js';

// Quota configuration
const QUOTA_PREFIX = 'vibescan:quota:';
const QUOTA_CACHE_TTL = 60; // 60 seconds cache

/**
 * Quota check result
 */
interface QuotaResult {
    allowed: boolean;
    remaining: number;
    resetAt: Date;
}

/**
 * Get quota key for a user
 */
function getQuotaKey(userId: string): string {
    return `${QUOTA_PREFIX}user:${userId}`;
}

/**
 * Get monthly quota key
 */
function getMonthlyQuotaKey(userId: string, month: string): string {
    return `${QUOTA_PREFIX}user:${userId}:month:${month}`;
}

/**
 * Check and consume quota for a user
 * @param userId - User ID
 * @param amount - Amount of quota to consume (default: 1)
 * @returns Quota result with allowed status and remaining
 */
export async function checkAndConsumeQuota(
    userId: string,
    amount: number = 1
): Promise<QuotaResult> {
    const redis = await getRedisClient();
    const quotaKey = getQuotaKey(userId);

    // Get current quota usage
    const currentUsage = await redis.get(quotaKey);
    const usage = parseInt(currentUsage || '0', 10);

    // Get quota limit from database
    const pool = getPool();
    const now = new Date();
    const month = now.toISOString().slice(0, 7); // "2026-04"

    const result = await pool.query(
        `SELECT scans_limit, reset_at FROM quota_ledger
         WHERE user_id = $1 AND month = $2`,
        [userId, month]
    );

    if (result.rows.length === 0) {
        // No quota ledger found - create one
        await pool.query(
            `INSERT INTO quota_ledger (user_id, month, scans_used, scans_limit, reset_at, plan_at_creation)
             SELECT $1, $2, 0,
                    CASE
                        WHEN u.plan = 'free_trial' THEN 10
                        WHEN u.plan = 'starter' THEN 50
                        WHEN u.plan = 'pro' THEN 200
                        WHEN u.plan = 'enterprise' THEN 10000
                        ELSE 10
                    END,
                    date_trunc('month', $3::date) + interval '1 month',
                    u.plan
             FROM users u
             WHERE u.id = $1
             RETURNING scans_limit, reset_at`,
            [userId, month, now]
        );

        // Retry getting quota
        const newResult = await pool.query(
            `SELECT scans_limit, reset_at FROM quota_ledger
             WHERE user_id = $1 AND month = $2`,
            [userId, month]
        );

        if (newResult.rows.length === 0) {
            return { allowed: false, remaining: 0, resetAt: now };
        }

        const limit = parseInt(newResult.rows[0].scans_limit);
        return {
            allowed: amount <= limit,
            remaining: Math.max(0, limit - usage - amount),
            resetAt: newResult.rows[0].reset_at
        };
    }

    const limit = parseInt(result.rows[0].scans_limit);
    const resetAt = result.rows[0].reset_at;

    // Check if quota is available
    const remaining = limit - usage;
    const allowed = remaining >= amount;

    if (allowed) {
        // Atomically increment quota usage
        await redis.incrBy(quotaKey, amount);
    }

    return {
        allowed,
        remaining: Math.max(0, remaining - amount),
        resetAt
    };
}

/**
 * Refund quota (for cancelled scans)
 * @param userId - User ID
 * @param amount - Amount to refund (default: 1)
 */
export async function refundQuota(
    userId: string,
    amount: number = 1
): Promise<void> {
    const redis = await getRedisClient();
    const quotaKey = getQuotaKey(userId);

    // Decrement the quota counter
    await redis.decrBy(quotaKey, amount);
}

/**
 * Get current quota usage
 * @param userId - User ID
 * @returns Current usage count
 */
export async function getQuotaUsage(userId: string): Promise<number> {
    const redis = await getRedisClient();
    const quotaKey = getQuotaKey(userId);

    const usage = await redis.get(quotaKey);
    return parseInt(usage || '0', 10);
}

/**
 * Reset monthly quota
 * @param userId - User ID
 * @param month - Month in "YYYY-MM" format
 */
export async function resetMonthlyQuota(userId: string, month: string): Promise<void> {
    const pool = getPool();
    const redis = await getRedisClient();

    // Create new quota ledger entry
    await pool.query(
        `INSERT INTO quota_ledger (user_id, month, scans_used, scans_limit, reset_at, plan_at_creation)
         SELECT $1, $2, 0,
                CASE
                    WHEN u.plan = 'free_trial' THEN 10
                    WHEN u.plan = 'starter' THEN 50
                    WHEN u.plan = 'pro' THEN 200
                    WHEN u.plan = 'enterprise' THEN 10000
                    ELSE 10
                END,
                date_trunc('month', ($2 || '-01')::date) + interval '1 month',
                u.plan
         FROM users u
         WHERE u.id = $1
         ON CONFLICT DO NOTHING`,
        [userId, month]
    );

    // Reset Redis counter
    const quotaKey = getMonthlyQuotaKey(userId, month);
    await redis.set(quotaKey, '0', { EX: 60 * 60 * 24 * 30 }); // 30 days TTL
}

/**
 * Get quota limits for a plan
 */
export function getQuotaLimitsForPlan(plan: string): number {
    const limits: Record<string, number> = {
        free_trial: 10,
        starter: 50,
        pro: 200,
        enterprise: 10000
    };
    return limits[plan] || 10;
}

/**
 * Sync Redis quota with database
 * Used to recover from Redis restart or data loss
 */
export async function syncQuotaWithDatabase(userId: string): Promise<void> {
    const pool = getPool();
    const redis = await getRedisClient();

    const now = new Date();
    const month = now.toISOString().slice(0, 7);

    const result = await pool.query(
        `SELECT scans_used FROM quota_ledger
         WHERE user_id = $1 AND month = $2`,
        [userId, month]
    );

    if (result.rows.length > 0) {
        const quotaKey = getQuotaKey(userId);
        await redis.set(quotaKey, result.rows[0].scans_used.toString(), {
            EX: QUOTA_CACHE_TTL
        });
    }
}

export default {
    checkAndConsumeQuota,
    refundQuota,
    getQuotaUsage,
    resetMonthlyQuota,
    getQuotaLimitsForPlan,
    syncQuotaWithDatabase
};

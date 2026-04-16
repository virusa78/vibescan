/**
 * QuotaService
 *
 * Manages monthly quota tracking, usage, and enforcement.
 * Uses Redis for fast reads and PostgreSQL as the source of truth.
 */

import { getPool } from '../database/client.js';
import { checkAndConsumeQuota, refundQuota, getQuotaUsage, resetMonthlyQuota, getQuotaLimitsForPlan } from '../redis/quota.js';
import { generateUUID } from '../utils/index.js';

/**
 * Quota check result
 */
export interface QuotaCheckResult {
    allowed: boolean;
    remaining: number;
    resetAt: Date;
}

/**
 * QuotaService interface
 */
export class QuotaService {
    private pool: any;

    constructor() {
        this.pool = getPool();
    }

    /**
     * Check quota for a user
     * @param userId - User ID
     * @returns Quota check result
     */
    async checkQuota(userId: string): Promise<QuotaCheckResult> {
        return checkAndConsumeQuota(userId, 0);
    }

    /**
     * Consume quota for a scan
     * @param scanId - Scan ID
     * @param userId - User ID
     */
    async consumeQuota(scanId: string, userId: string): Promise<void> {
        const result = await checkAndConsumeQuota(userId, 1);

        if (!result.allowed) {
            throw {
                code: 'quota_exceeded',
                message: 'Monthly scan limit reached',
                remaining: result.remaining,
                resetAt: result.resetAt
            };
        }
    }

    /**
     * Refund quota for a cancelled scan
     * @param scanId - Scan ID
     * @param userId - User ID
     */
    async refundQuota(scanId: string, userId: string): Promise<void> {
        await refundQuota(userId, 1);
    }

    /**
     * Get current quota usage for a user
     * @param userId - User ID
     * @returns Current usage count
     */
    async getUsage(userId: string): Promise<number> {
        return getQuotaUsage(userId);
    }

    /**
     * Get quota limits for a plan
     * @param plan - Plan tier
     * @returns Scan limit
     */
    getLimitForPlan(plan: string): number {
        return getQuotaLimitsForPlan(plan);
    }

    /**
     * Reset monthly quota for all users
     * Called by cron job on first day of month
     */
    async resetAllQuotas(): Promise<void> {
        const pool = getPool();
        const now = new Date();
        const month = now.toISOString().slice(0, 7); // "2026-04"

        // Get all users with their plans
        const usersResult = await pool.query(
            'SELECT id, plan FROM users WHERE plan != \'free_trial\''
        );

        // Reset quota for each user
        for (const user of usersResult.rows) {
            await resetMonthlyQuota(user.id, month);
        }

        console.log(`Reset monthly quota for ${usersResult.rows.length} users for ${month}`);
    }

    /**
     * Get quota ledger for a user in a specific month
     * @param userId - User ID
     * @param month - Month in "YYYY-MM" format
     * @returns Quota ledger record
     */
    async getQuotaLedger(userId: string, month: string): Promise<any | null> {
        const result = await this.pool.query(
            `SELECT id, user_id, month, scans_used, scans_limit, reset_at,
                    plan_at_creation, created_at, updated_at
             FROM quota_ledger
             WHERE user_id = $1 AND month = $2`,
            [userId, month]
        );

        return result.rows[0] || null;
    }

    /**
     * Get current month's quota ledger for a user
     * @param userId - User ID
     * @returns Quota ledger record
     */
    async getCurrentMonthLedger(userId: string): Promise<any | null> {
        const month = new Date().toISOString().slice(0, 7);
        return this.getQuotaLedger(userId, month);
    }

    /**
     * Get quota status for a user (usage + limit)
     * @param userId - User ID
     * @returns Quota status
     */
    async getQuotaStatus(userId: string): Promise<{
        used: number;
        limit: number;
        remaining: number;
        resetAt: Date;
        percentage: number;
    }> {
        const usage = await this.getUsage(userId);
        const ledgerResult = await this.pool.query(
            `SELECT scans_limit, reset_at
             FROM quota_ledger
             WHERE user_id = $1
             ORDER BY created_at DESC
             LIMIT 1`,
            [userId],
        );
        const ledger = ledgerResult.rows[0] || null;

        if (!ledger) {
            return {
                used: 0,
                limit: 0,
                remaining: 0,
                resetAt: new Date(),
                percentage: 0
            };
        }

        const limit = Number.parseInt(String(ledger.scans_limit ?? ledger.scansLimit ?? 0), 10);
        const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : 0;
        const remaining = Math.max(0, safeLimit - usage);
        const percentage = safeLimit > 0 ? (usage / safeLimit) * 100 : 0;

        return {
            used: usage,
            limit: safeLimit,
            remaining,
            resetAt: ledger.reset_at,
            percentage
        };
    }
}

export const quotaService = new QuotaService();

export default quotaService;

import { prisma } from 'wasp/server';
import { HttpError } from 'wasp/server';
import { getQuotaLimitForPlan, isUnlimitedQuota } from '../config/quotas.js';

export interface QuotaInfo {
  used: number;
  limit: number;
  remaining: number;
  resetDate: Date;
}

export interface QuotaLedgerEntry {
  id: string;
  action: string;
  amount: number;
  reason?: string;
  balanceBefore: number;
  balanceAfter: number;
  createdAt: Date;
}

/**
 * QuotaService handles quota consumption, refunds, and auditability.
 * All quota operations are tracked in the QuotaLedger for audit purposes.
 *
 * Key invariants:
 * - Quota is consumed at scan submission time (not completion)
 * - Quota is only refunded on scan failure or manual admin action
 * - All operations must be atomic (wrapped in transactions)
 * - Monthly quota resets on the 1st of each month
 */
export class QuotaService {
  /**
   * Get current quota info for a user.
   * Automatically resets quota if reset date has passed.
   * @param userId The user ID
   * @param tx Optional Prisma transaction (for use within larger transaction)
   * @returns Quota information
   */
  async getQuota(userId: string, tx: any = null): Promise<QuotaInfo> {
    const executor = tx || prisma;

    const user = await executor.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new HttpError(404, 'User not found');
    }

    // Check if quota needs to be reset
    const now = new Date();
    let currentUser = user;

    if (user.quotaResetDate && user.quotaResetDate <= now) {
      // Reset has occurred - update the user record
      const nextResetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      currentUser = await executor.user.update({
        where: { id: userId },
        data: {
          monthlyQuotaUsed: 0,
          quotaResetDate: nextResetDate,
        },
      });

      // Record the reset in ledger
      if (!tx) {
        // Only record if not in a transaction (to avoid nested transaction issues)
        await this.recordLedgerEntry(
          userId,
          'monthly_reset',
          0, // amount doesn't matter for reset
          user.monthlyQuotaUsed,
          0,
          'automatic_monthly_reset'
        );
      }
    }

    const limit = getQuotaLimitForPlan(user.plan);
    const used = currentUser.monthlyQuotaUsed;
    const remaining = isUnlimitedQuota(limit) ? Infinity : limit - used;

    return {
      used,
      limit,
      remaining: remaining === Infinity ? 999999 : remaining, // Return large number instead of Infinity
      resetDate: currentUser.quotaResetDate,
    };
  }

  /**
   * Check if user can submit a scan without consuming quota.
   * @param userId The user ID
   * @param tx Optional Prisma transaction
   * @returns true if user has remaining quota
   */
  async canScan(userId: string, tx: any = null): Promise<boolean> {
    const quota = await this.getQuota(userId, tx);
    return quota.remaining > 0;
  }

  /**
   * Consume quota when a scan is submitted.
   * Must be called within a transaction that also creates the scan.
   * @param userId The user ID
   * @param scanId The scan ID being created
   * @param tx Prisma transaction (required)
   * @returns Updated quota info
   * @throws HttpError with 429 if quota exceeded
   */
  async consumeQuota(userId: string, scanId: string, tx: any): Promise<QuotaInfo> {
    if (!tx) {
      throw new Error('consumeQuota must be called within a transaction');
    }

    const user = await tx.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new HttpError(404, 'User not found');
    }

    // Check if quota reset is needed
    const now = new Date();
    let currentUser = user;

    if (user.quotaResetDate && user.quotaResetDate <= now) {
      const nextResetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      currentUser = await tx.user.update({
        where: { id: userId },
        data: {
          monthlyQuotaUsed: 0,
          quotaResetDate: nextResetDate,
        },
      });
    }

    const limit = getQuotaLimitForPlan(user.plan);
    const quotaAvailable = isUnlimitedQuota(limit) ? Infinity : limit - currentUser.monthlyQuotaUsed;

    if (!isUnlimitedQuota(limit) && quotaAvailable <= 0) {
      throw new HttpError(429, 'Monthly scan quota exceeded', {
        error: 'quota_exceeded',
        quota_limit: limit,
        quota_used: currentUser.monthlyQuotaUsed,
        quota_remaining: 0,
      });
    }

    const balanceBefore = currentUser.monthlyQuotaUsed;
    const balanceAfter = currentUser.monthlyQuotaUsed + 1;

    // Increment quota within transaction
    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: {
        monthlyQuotaUsed: balanceAfter,
      },
    });

    // Record ledger entry within transaction
    await tx.quotaLedger.create({
      data: {
        userId,
        action: 'scan_submitted',
        amount: 1,
        reason: `Scan submitted: ${scanId}`,
        balanceBefore,
        balanceAfter,
        relatedScanId: scanId,
      },
    });

    const newRemaining = isUnlimitedQuota(limit) ? Infinity : limit - balanceAfter;

    return {
      used: balanceAfter,
      limit,
      remaining: newRemaining === Infinity ? 999999 : newRemaining,
      resetDate: updatedUser.quotaResetDate,
    };
  }

  /**
   * Refund quota when a scan fails or is cancelled.
   * Creates a new transaction to ensure atomicity.
   * @param userId The user ID
   * @param scanId The scan ID
   * @param reason Reason for refund (e.g., 'scan_failed', 'manual_admin_refund')
   * @returns Updated quota info
   */
  async refundQuota(userId: string, scanId: string, reason: string): Promise<QuotaInfo> {
    return prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new HttpError(404, 'User not found');
      }

      if (user.monthlyQuotaUsed <= 0) {
        // No quota to refund
        return await this.getQuota(userId, tx);
      }

      const balanceBefore = user.monthlyQuotaUsed;
      const balanceAfter = Math.max(0, user.monthlyQuotaUsed - 1);

      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          monthlyQuotaUsed: balanceAfter,
        },
      });

      // Record ledger entry
      await tx.quotaLedger.create({
        data: {
          userId,
          action: 'scan_refunded',
          amount: -1,
          reason: `${reason}: ${scanId}`,
          balanceBefore,
          balanceAfter,
          relatedScanId: scanId,
        },
      });

      const limit = getQuotaLimitForPlan(user.plan);
      const newRemaining = isUnlimitedQuota(limit) ? Infinity : limit - balanceAfter;

      return {
        used: balanceAfter,
        limit,
        remaining: newRemaining === Infinity ? 999999 : newRemaining,
        resetDate: updatedUser.quotaResetDate,
      };
    });
  }

  /**
   * Get quota ledger entries for a user.
   * @param userId The user ID
   * @param limit Maximum number of entries to return (default 100)
   * @returns Array of ledger entries
   */
  async getLedgerEntries(userId: string, limit: number = 100): Promise<QuotaLedgerEntry[]> {
    const entries = await prisma.quotaLedger.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return entries.map((entry) => ({
      id: entry.id,
      action: entry.action,
      amount: entry.amount,
      reason: entry.reason || undefined,
      balanceBefore: entry.balanceBefore,
      balanceAfter: entry.balanceAfter,
      createdAt: entry.createdAt,
    }));
  }

  /**
   * Record a ledger entry for audit trail.
   * Used internally for non-transactional ledger operations.
   * @private
   */
  private async recordLedgerEntry(
    userId: string,
    action: string,
    amount: number,
    balanceBefore: number,
    balanceAfter: number,
    reason?: string
  ): Promise<void> {
    try {
      await prisma.quotaLedger.create({
        data: {
          userId,
          action,
          amount,
          reason,
          balanceBefore,
          balanceAfter,
        },
      });
    } catch (error) {
      // Log error but don't fail - ledger is audit-only
      console.error('Failed to record quota ledger entry:', error);
    }
  }
}

// Export singleton instance
export const quotaService = new QuotaService();

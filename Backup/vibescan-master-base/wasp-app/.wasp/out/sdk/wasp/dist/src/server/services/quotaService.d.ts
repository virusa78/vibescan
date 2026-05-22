import { prisma } from 'wasp/server';
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
type QuotaExecutor = typeof prisma;
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
export declare class QuotaService {
    private publishQuotaEvent;
    publishPostConsumeSignals(userId: string, quota: QuotaInfo): Promise<void>;
    /**
     * Get current quota info for a user.
     * Automatically resets quota if reset date has passed.
     * @param userId The user ID
     * @param tx Optional Prisma transaction (for use within larger transaction)
     * @returns Quota information
     */
    getQuota(userId: string, tx?: QuotaExecutor | null): Promise<QuotaInfo>;
    /**
     * Check if user can submit a scan without consuming quota.
     * @param userId The user ID
     * @param tx Optional Prisma transaction
     * @returns true if user has remaining quota
     */
    canScan(userId: string, tx?: QuotaExecutor | null): Promise<boolean>;
    /**
     * Consume quota when a scan is submitted.
     * Must be called within a transaction that also creates the scan.
     * @param userId The user ID
     * @param scanId The scan ID being created
     * @param tx Prisma transaction (required)
     * @returns Updated quota info
     * @throws HttpError with 429 if quota exceeded
     */
    consumeQuota(userId: string, scanId: string, tx: QuotaExecutor): Promise<QuotaInfo>;
    /**
     * Refund quota when a scan fails or is cancelled.
     * Creates a new transaction to ensure atomicity.
     * @param userId The user ID
     * @param scanId The scan ID
     * @param reason Reason for refund (e.g., 'scan_failed', 'manual_admin_refund')
     * @returns Updated quota info
     */
    refundQuota(userId: string, scanId: string, reason: string): Promise<QuotaInfo>;
    /**
     * Get quota ledger entries for a user.
     * @param userId The user ID
     * @param limit Maximum number of entries to return (default 100)
     * @returns Array of ledger entries
     */
    getLedgerEntries(userId: string, limit?: number): Promise<QuotaLedgerEntry[]>;
    /**
     * Record a ledger entry for audit trail.
     * Used internally for non-transactional ledger operations.
     * @private
     */
    private recordLedgerEntry;
}
export declare const quotaService: QuotaService;
export {};
//# sourceMappingURL=quotaService.d.ts.map
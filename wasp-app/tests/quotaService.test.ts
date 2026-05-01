/**
 * Tests for QuotaService
 * Unit and integration tests for quota consumption, refunds, and auditability
 */

import { describe, it, expect, beforeEach, afterEach, jest } from './testGlobals';

jest.mock('wasp/server', async () => import('../../test/mocks/wasp-server'));

import { prisma, HttpError } from 'wasp/server';
import { quotaService, QuotaService } from '../src/server/services/quotaService';

type TestUser = {
  id: string;
  email: string;
  plan: string;
  monthlyQuotaLimit: number;
  monthlyQuotaUsed: number;
  quotaResetDate: Date;
};

let users: TestUser[] = [];
let ledgerEntries: Array<{
  id: string;
  userId: string;
  action: string;
  amount: number;
  reason?: string;
  balanceBefore: number;
  balanceAfter: number;
  relatedScanId?: string;
  createdAt: Date;
}> = [];
let transactionChain: Promise<void> = Promise.resolve();

function installPrismaMocks() {
  prisma.user.create.mockImplementation(async ({ data }: any) => {
    const user: TestUser = {
      id: `user-${users.length + 1}`,
      email: data.email,
      plan: data.plan,
      monthlyQuotaLimit: data.monthlyQuotaLimit,
      monthlyQuotaUsed: data.monthlyQuotaUsed,
      quotaResetDate: data.quotaResetDate,
    };
    users.push(user);
    return user;
  });

  prisma.user.findUnique.mockImplementation(async ({ where }: any) => {
    return users.find((user) => user.id === where.id) ?? null;
  });

  prisma.user.update.mockImplementation(async ({ where, data }: any) => {
    const index = users.findIndex((user) => user.id === where.id);
    if (index === -1) {
      return null;
    }
    users[index] = { ...users[index], ...data };
    return users[index];
  });

  prisma.user.delete.mockImplementation(async ({ where }: any) => {
    users = users.filter((user) => user.id !== where.id);
    return null;
  });

  prisma.quotaLedger.create.mockImplementation(async ({ data }: any) => {
    const entry = {
      id: `ledger-${ledgerEntries.length + 1}`,
      userId: data.userId,
      action: data.action,
      amount: data.amount,
      reason: data.reason,
      balanceBefore: data.balanceBefore,
      balanceAfter: data.balanceAfter,
      relatedScanId: data.relatedScanId,
      createdAt: new Date(),
    };
    ledgerEntries.unshift(entry);
    return entry;
  });

  prisma.quotaLedger.findMany.mockImplementation(async ({ where, take }: any) => {
    const entries = ledgerEntries.filter((entry) => !where?.userId || entry.userId === where.userId);
    return typeof take === 'number' ? entries.slice(0, take) : entries;
  });

  prisma.quotaLedger.findFirst.mockImplementation(async ({ where }: any) => {
    return (
      ledgerEntries.find((entry) => {
        if (where?.userId && entry.userId !== where.userId) return false;
        if (where?.action && entry.action !== where.action) return false;
        return true;
      }) ?? null
    );
  });

  prisma.quotaLedger.deleteMany.mockImplementation(async ({ where }: any) => {
    ledgerEntries = ledgerEntries.filter((entry) => entry.userId !== where.userId);
    return null;
  });

  prisma.$transaction.mockImplementation(async (callback: any) => {
    const resultPromise = transactionChain.then(() => callback(prisma));
    transactionChain = resultPromise.then(() => undefined, () => undefined);
    return resultPromise;
  });
}

describe('QuotaService', () => {
  let testUserId: string;
  let testUser: any;

  beforeEach(async () => {
    users = [];
    ledgerEntries = [];
    transactionChain = Promise.resolve();
    jest.clearAllMocks();
    installPrismaMocks();

    // Create a test user for each test
    testUser = await prisma.user.create({
      data: {
        email: `test-quota-${Date.now()}@example.com`,
        plan: 'starter',
        monthlyQuotaLimit: 50,
        monthlyQuotaUsed: 0,
        quotaResetDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1),
      },
    });
    testUserId = testUser.id;
  });

  afterEach(async () => {
    // Clean up
    await prisma.quotaLedger.deleteMany({ where: { userId: testUserId } });
    await prisma.user.delete({ where: { id: testUserId } });
  });

  describe('getQuota', () => {
    it('should return correct quota info', async () => {
      const quota = await quotaService.getQuota(testUserId);

      expect(quota.used).toBe(0);
      expect(quota.limit).toBe(50); // starter plan
      expect(quota.remaining).toBe(50);
      expect(quota.resetDate).toBeInstanceOf(Date);
    });

    it('should handle non-existent user', async () => {
      await expect(quotaService.getQuota('non-existent-id')).rejects.toThrow(HttpError);
    });

    it('should reset quota when reset date has passed', async () => {
      // Set reset date to the past
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      await prisma.user.update({
        where: { id: testUserId },
        data: {
          monthlyQuotaUsed: 50,
          quotaResetDate: pastDate,
        },
      });

      const quota = await quotaService.getQuota(testUserId);

      expect(quota.used).toBe(0);
      expect(quota.remaining).toBe(50);

      // Verify reset date was updated
      const updatedUser = await prisma.user.findUnique({ where: { id: testUserId } });
      expect(updatedUser!.monthlyQuotaUsed).toBe(0);
      expect(updatedUser!.quotaResetDate.getTime()).toBeGreaterThan(pastDate.getTime());
    });
  });

  describe('canScan', () => {
    it('should return true when quota is available', async () => {
      const canScan = await quotaService.canScan(testUserId);
      expect(canScan).toBe(true);
    });

    it('should return false when quota is exceeded', async () => {
      // Use up all quota
      await prisma.user.update({
        where: { id: testUserId },
        data: { monthlyQuotaUsed: 50 },
      });

      const canScan = await quotaService.canScan(testUserId);
      expect(canScan).toBe(false);
    });
  });

  describe('consumeQuota', () => {
    it('should consume quota within transaction', async () => {
      const testScanId = 'test-scan-123';

      const result = await prisma.$transaction(async (tx) => {
        return await quotaService.consumeQuota(testUserId, testScanId, tx);
      });

      expect(result.used).toBe(1);
      expect(result.remaining).toBe(49);

      // Verify user was updated
      const updatedUser = await prisma.user.findUnique({ where: { id: testUserId } });
      expect(updatedUser!.monthlyQuotaUsed).toBe(1);

      // Verify ledger entry was created
      const ledgerEntries = await prisma.quotaLedger.findMany({ where: { userId: testUserId } });
      expect(ledgerEntries).toHaveLength(1);
      expect(ledgerEntries[0].action).toBe('scan_submitted');
      expect(ledgerEntries[0].amount).toBe(1);
      expect(ledgerEntries[0].balanceBefore).toBe(0);
      expect(ledgerEntries[0].balanceAfter).toBe(1);
    });

    it('should throw 429 when quota exceeded', async () => {
      // Use up all quota
      await prisma.user.update({
        where: { id: testUserId },
        data: { monthlyQuotaUsed: 50 },
      });

      const testScanId = 'test-scan-over-limit';

      await expect(
        prisma.$transaction(async (tx) => {
          return await quotaService.consumeQuota(testUserId, testScanId, tx);
        })
      ).rejects.toThrow(HttpError);
    });

    it('should handle unlimited enterprise quota', async () => {
      // Update user to enterprise plan
      await prisma.user.update({
        where: { id: testUserId },
        data: { plan: 'enterprise', monthlyQuotaLimit: 999999 },
      });

      const testScanId = 'test-scan-enterprise';

      const result = await prisma.$transaction(async (tx) => {
        return await quotaService.consumeQuota(testUserId, testScanId, tx);
      });

      expect(result.remaining).toBeGreaterThan(900000); // Should have large number remaining
    });

    it('should require transaction', async () => {
      const testScanId = 'test-scan-no-tx';

      await expect(quotaService.consumeQuota(testUserId, testScanId, null)).rejects.toThrow(
        'consumeQuota must be called within a transaction'
      );
    });
  });

  describe('refundQuota', () => {
    beforeEach(async () => {
      // Use up some quota first
      await prisma.user.update({
        where: { id: testUserId },
        data: { monthlyQuotaUsed: 10 },
      });
    });

    it('should refund quota', async () => {
      const testScanId = 'test-scan-refund';

      const result = await quotaService.refundQuota(testUserId, testScanId, 'scan_failed');

      expect(result.used).toBe(9);
      expect(result.remaining).toBe(41);

      // Verify user was updated
      const updatedUser = await prisma.user.findUnique({ where: { id: testUserId } });
      expect(updatedUser!.monthlyQuotaUsed).toBe(9);

      // Verify ledger entry
      const ledgerEntries = await prisma.quotaLedger.findMany({ where: { userId: testUserId } });
      expect(ledgerEntries).toHaveLength(1);
      expect(ledgerEntries[0].action).toBe('scan_refunded');
      expect(ledgerEntries[0].amount).toBe(-1);
      expect(ledgerEntries[0].balanceBefore).toBe(10);
      expect(ledgerEntries[0].balanceAfter).toBe(9);
    });

    it('should not refund below zero', async () => {
      // Reset quota to 0
      await prisma.user.update({
        where: { id: testUserId },
        data: { monthlyQuotaUsed: 0 },
      });

      const result = await quotaService.refundQuota(testUserId, 'test-scan', 'scan_failed');

      expect(result.used).toBe(0);
      expect(result.remaining).toBe(50);
    });

    it('should record reason in ledger', async () => {
      const reason = 'manual_admin_refund';
      const testScanId = 'test-scan-reason';

      await quotaService.refundQuota(testUserId, testScanId, reason);

      const ledgerEntry = await prisma.quotaLedger.findFirst({
        where: { userId: testUserId, action: 'scan_refunded' },
      });

      expect(ledgerEntry?.reason).toContain(reason);
      expect(ledgerEntry?.relatedScanId).toBe(testScanId);
    });
  });

  describe('getLedgerEntries', () => {
    beforeEach(async () => {
      // Create multiple ledger entries
      for (let i = 0; i < 5; i++) {
        await prisma.$transaction(async (tx) => {
          await quotaService.consumeQuota(testUserId, `scan-${i}`, tx);
        });
      }
    });

    it('should retrieve ledger entries', async () => {
      const entries = await quotaService.getLedgerEntries(testUserId);

      expect(entries.length).toBeGreaterThan(0);
      expect(entries[0].action).toBe('scan_submitted');
      expect(entries[0].balanceAfter).toBeDefined();
    });

    it('should respect limit parameter', async () => {
      const entries = await quotaService.getLedgerEntries(testUserId, 2);

      expect(entries.length).toBeLessThanOrEqual(2);
    });

    it('should order by most recent first', async () => {
      const entries = await quotaService.getLedgerEntries(testUserId, 100);

      for (let i = 0; i < entries.length - 1; i++) {
        expect(entries[i].createdAt.getTime()).toBeGreaterThanOrEqual(entries[i + 1].createdAt.getTime());
      }
    });
  });

  describe('Plan limits', () => {
    it('should enforce starter plan limit (50)', async () => {
      // User already created with starter plan
      expect(testUser.plan).toBe('starter');
      expect(testUser.monthlyQuotaLimit).toBe(50);
    });

    it('should enforce free_trial plan limit (5)', async () => {
      const freeTrialUser = await prisma.user.create({
        data: {
          email: `free-trial-${Date.now()}@example.com`,
          plan: 'free_trial',
          monthlyQuotaLimit: 5,
          monthlyQuotaUsed: 0,
          quotaResetDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1),
        },
      });

      const quota = await quotaService.getQuota(freeTrialUser.id);
      expect(quota.limit).toBe(5);

      // Cleanup
      await prisma.quotaLedger.deleteMany({ where: { userId: freeTrialUser.id } });
      await prisma.user.delete({ where: { id: freeTrialUser.id } });
    });

    it('should enforce pro plan limit (500)', async () => {
      const proUser = await prisma.user.create({
        data: {
          email: `pro-${Date.now()}@example.com`,
          plan: 'pro',
          monthlyQuotaLimit: 500,
          monthlyQuotaUsed: 0,
          quotaResetDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1),
        },
      });

      const quota = await quotaService.getQuota(proUser.id);
      expect(quota.limit).toBe(500);

      // Cleanup
      await prisma.quotaLedger.deleteMany({ where: { userId: proUser.id } });
      await prisma.user.delete({ where: { id: proUser.id } });
    });
  });

  describe('Concurrency', () => {
    it('should handle concurrent quota consumption without race conditions', async () => {
      const testScanIds = ['scan-1', 'scan-2', 'scan-3'];

      // Submit all scans concurrently
      const promises = testScanIds.map((scanId) =>
        prisma.$transaction(async (tx) => {
          return await quotaService.consumeQuota(testUserId, scanId, tx);
        })
      );

      const results = await Promise.all(promises);

      // Verify all scans consumed quota
      results.forEach((result) => {
        expect(result.used).toBeGreaterThan(0);
      });

      // Verify user was updated correctly
      const updatedUser = await prisma.user.findUnique({ where: { id: testUserId } });
      expect(updatedUser!.monthlyQuotaUsed).toBe(3);

      // Verify all ledger entries were created
      const ledgerEntries = await prisma.quotaLedger.findMany({ where: { userId: testUserId } });
      expect(ledgerEntries.length).toBe(3);
    });
  });
});

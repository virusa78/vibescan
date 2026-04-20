import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { prisma } from '../mocks/wasp-server';

const prismaMock = prisma;
let quotaService: typeof import('../../wasp-app/src/server/services/quotaService').quotaService;

describe('QuotaService', () => {
  beforeEach(async () => {
    if (!quotaService) {
      const mod = await import('../../wasp-app/src/server/services/quotaService');
      quotaService = mod.quotaService;
    }
  });

  beforeEach(() => {
    prismaMock.user.findUnique.mockReset();
    prismaMock.user.update.mockReset();
    prismaMock.quotaLedger.create.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('resets monthly quota and records ledger entry when reset date passed', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-04-15T12:00:00.000Z'));

    const userId = 'user-1';
    const user = {
      id: userId,
      plan: 'starter',
      monthlyQuotaUsed: 3,
      quotaResetDate: new Date('2026-04-01T00:00:00.000Z'),
    };
    const updatedUser = {
      ...user,
      monthlyQuotaUsed: 0,
      quotaResetDate: new Date('2026-05-01T00:00:00.000Z'),
    };

    prismaMock.user.findUnique.mockResolvedValueOnce(user);
    prismaMock.user.update.mockResolvedValueOnce(updatedUser);
    prismaMock.quotaLedger.create.mockResolvedValueOnce({});

    const result = await quotaService.getQuota(userId);

    expect(result.used).toBe(0);
    expect(result.remaining).toBe(50);
    expect(result.resetDate).toEqual(updatedUser.quotaResetDate);
    expect(prismaMock.user.update).toHaveBeenCalled();
    expect(prismaMock.quotaLedger.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'monthly_reset' }),
      })
    );
  });

  it('throws quota_exceeded when limit reached', async () => {
    const userId = 'user-2';
    const tx = {
      user: {
        findUnique: jest.fn() as jest.MockedFunction<
          () => Promise<{
            id: string;
            plan: string;
            monthlyQuotaUsed: number;
            quotaResetDate: Date;
          }>
        >,
        update: jest.fn() as jest.MockedFunction<() => Promise<unknown>>,
      },
      quotaLedger: {
        create: jest.fn() as jest.MockedFunction<() => Promise<unknown>>,
      },
    };
    tx.user.findUnique.mockResolvedValue({
      id: userId,
      plan: 'starter',
      monthlyQuotaUsed: 50,
      quotaResetDate: new Date('2026-05-01T00:00:00.000Z'),
    });

    await expect(quotaService.consumeQuota(userId, 'scan-1', tx)).rejects.toMatchObject({
      statusCode: 429,
      data: expect.objectContaining({ error: 'quota_exceeded', quota_remaining: 0 }),
    });

    expect(tx.user.update).not.toHaveBeenCalled();
    expect(tx.quotaLedger.create).not.toHaveBeenCalled();
  });
});

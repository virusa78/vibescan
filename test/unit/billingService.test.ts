import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockPool: { query: ReturnType<typeof jest.fn> } = {
    query: jest.fn(),
};

jest.mock('../../src/database/client.js', () => ({
    getPool: jest.fn(() => mockPool),
}));

import { BillingService } from '../../src/services/billingService.js';

describe('BillingService lifecycle contracts', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.ENCRYPTION_KEY = 'test-encryption-key';
    });

    it('marks user for starter downgrade when subscription is set to cancel at period end', async () => {
        const service = new BillingService();
        mockPool.query
            .mockResolvedValueOnce({ rows: [{ id: 'user-1' }] })
            .mockResolvedValueOnce({ rows: [] });

        await (service as any).handleSubscriptionUpdated({
            data: {
                object: {
                    customer: 'cus_123',
                    cancel_at_period_end: true,
                },
            },
        });

        expect(mockPool.query).toHaveBeenCalledWith(
            expect.stringContaining('pgp_sym_decrypt(stripe_customer_id_encrypted'),
            ['test-encryption-key', 'cus_123']
        );
        expect(mockPool.query).toHaveBeenCalledWith(
            expect.stringContaining('UPDATE users SET plan = $1 WHERE id = $2'),
            ['starter', 'user-1']
        );
    });

    it('downgrades user after third payment failure within 30 days', async () => {
        const service = new BillingService();
        mockPool.query
            .mockResolvedValueOnce({ rows: [{ id: 'user-2' }] })
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [{ count: '3' }] })
            .mockResolvedValueOnce({ rows: [] });

        await (service as any).handlePaymentFailed({
            data: {
                object: {
                    id: 'in_123',
                    customer: 'cus_abc',
                    subscription: 'sub_abc',
                },
            },
        });

        expect(mockPool.query).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO payment_failures'),
            ['in_123', 'user-2']
        );
        expect(mockPool.query).toHaveBeenCalledWith(
            expect.stringContaining('UPDATE users SET plan = \'starter\' WHERE id = $1'),
            ['user-2']
        );
    });

    it('does not downgrade user when payment failures are below threshold', async () => {
        const service = new BillingService();
        mockPool.query
            .mockResolvedValueOnce({ rows: [{ id: 'user-3' }] })
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [{ count: '2' }] });

        await (service as any).handlePaymentFailed({
            data: {
                object: {
                    id: 'in_456',
                    customer: 'cus_def',
                    subscription: 'sub_def',
                },
            },
        });

        expect(mockPool.query).toHaveBeenCalledWith(
            expect.stringContaining('SELECT COUNT(*) as count FROM payment_failures'),
            ['user-3']
        );
        expect(mockPool.query).not.toHaveBeenCalledWith(
            expect.stringContaining('UPDATE users SET plan = \'starter\' WHERE id = $1'),
            ['user-3']
        );
    });
});

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockQuery = jest.fn();
const mockRefundQuota = jest.fn();
const mockGetFreeScanQueue = jest.fn();
const mockGetEnterpriseScanQueue = jest.fn();

jest.mock('../../src/database/client.js', () => ({
    getPool: () => ({ query: mockQuery })
}));

jest.mock('../../src/redis/pubsub.js', () => ({
    publishScanStatus: jest.fn()
}));

jest.mock('../../src/redis/client.js', () => ({
    getRedisClient: jest.fn()
}));

jest.mock('../../src/redis/lock.js', () => ({
    acquireLock: jest.fn(),
    releaseLock: jest.fn()
}));

jest.mock('../../src/services/quotaService.js', () => ({
    quotaService: {
        refundQuota: mockRefundQuota,
        consumeQuota: jest.fn()
    }
}));

jest.mock('../../src/queues/config.js', () => ({
    addFreeScanJob: jest.fn(),
    addEnterpriseScanJob: jest.fn(),
    getFreeScanQueue: mockGetFreeScanQueue,
    getEnterpriseScanQueue: mockGetEnterpriseScanQueue,
    getPriorityForPlan: jest.fn(() => 3),
    getPriorityTierForPlan: jest.fn(() => 'low')
}));

describe('ScanOrchestrator cancel semantics', () => {
    const resolvedMock = (value: any) => (jest.fn() as any).mockResolvedValue(value);

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('returns not_found semantics for non-owner cancellation attempts', async () => {
        const { ScanOrchestrator } = require('../../src/services/scanOrchestrator');
        const orchestrator = new ScanOrchestrator();

        (mockQuery as any).mockResolvedValueOnce({
            rows: [{ id: 'scan-1', user_id: 'owner-1', status: 'pending' }]
        });

        await expect(orchestrator.cancelScan('scan-1', 'attacker-1')).rejects.toMatchObject({
            code: 'not_found'
        });
    });

    it('returns conflict when scan is already processing and cannot be revoked', async () => {
        const { ScanOrchestrator } = require('../../src/services/scanOrchestrator');
        const orchestrator = new ScanOrchestrator();
        const activeJob = {
            id: 'job-free-1',
            data: { scanId: 'scan-2' },
            isActive: (jest.fn() as any).mockResolvedValue(true),
            remove: jest.fn()
        };

        (mockQuery as any).mockResolvedValueOnce({
            rows: [{ id: 'scan-2', user_id: 'user-1', status: 'scanning' }]
        });
        (mockGetFreeScanQueue as any).mockResolvedValue({
            getJobs: resolvedMock([activeJob])
        });
        (mockGetEnterpriseScanQueue as any).mockResolvedValue({
            getJobs: resolvedMock([])
        });

        await expect(orchestrator.cancelScan('scan-2', 'user-1')).rejects.toMatchObject({
            code: 'conflict',
            status: 'scanning',
            cancellation_state: 'processing'
        });
        expect(mockRefundQuota).not.toHaveBeenCalled();
    });

    it('revokes queued jobs, cancels scan, and refunds quota when removable', async () => {
        const { ScanOrchestrator } = require('../../src/services/scanOrchestrator');
        const orchestrator = new ScanOrchestrator();
        const waitingFreeJob = {
            id: 'job-free-2',
            data: { scanId: 'scan-3' },
            isActive: (jest.fn() as any).mockResolvedValue(false),
            remove: (jest.fn() as any).mockResolvedValue(undefined)
        };
        const waitingEnterpriseJob = {
            id: 'job-enterprise-2',
            data: { scanId: 'scan-3' },
            isActive: (jest.fn() as any).mockResolvedValue(false),
            remove: (jest.fn() as any).mockResolvedValue(undefined)
        };

        (mockQuery as any)
            .mockResolvedValueOnce({
                rows: [{ id: 'scan-3', user_id: 'user-3', status: 'pending' }]
            })
            .mockResolvedValueOnce({ rows: [] });

        (mockGetFreeScanQueue as any).mockResolvedValue({
            getJobs: resolvedMock([waitingFreeJob])
        });
        (mockGetEnterpriseScanQueue as any).mockResolvedValue({
            getJobs: resolvedMock([waitingEnterpriseJob])
        });

        await orchestrator.cancelScan('scan-3', 'user-3');

        expect(waitingFreeJob.remove).toHaveBeenCalled();
        expect(waitingEnterpriseJob.remove).toHaveBeenCalled();
        expect(mockQuery).toHaveBeenNthCalledWith(
            2,
            expect.stringContaining("UPDATE scans SET status = 'cancelled'"),
            ['scan-3']
        );
        expect(mockRefundQuota).toHaveBeenCalledWith('scan-3', 'user-3');
    });
});

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockPool: any = { query: jest.fn() };

const addWebhookDeliveryJob = jest.fn();
const addReportGenerationJob = jest.fn();
const getPriorityForPlan = jest.fn(() => 2);
jest.mock('../../src/queues/config.js', () => ({
    addWebhookDeliveryJob,
    addReportGenerationJob,
    getPriorityForPlan
}));

jest.mock('../../src/database/client.js', () => ({
    getPool: jest.fn(() => mockPool),
}));

jest.mock('../../src/config/index.js', () => ({
    __esModule: true,
    default: { ENCRYPTION_KEY: 'enc-key' }
}));

jest.mock('../../src/utils/index.js', () => ({
    generateHMAC: jest.fn((payload: string, secret: string, algo: string) => `${algo}:${secret}:${payload.length}`),
    generateUUID: jest.fn(() => 'delivery-1')
}));

describe('report-webhook-ci-gate contracts', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('uses plan_at_submission to scope CI decision for starter scans', async () => {
        const { ReportService } = require('../../src/services/reportService');
        (mockPool.query as any)
            .mockResolvedValueOnce({
                rows: [{ id: 'scan-1', user_id: 'user-1', plan_at_submission: 'starter', status: 'done' }]
            })
            .mockResolvedValueOnce({
                rows: [
                    { source: 'free', vulnerabilities: [{ cve_id: 'CVE-free-1', severity: 'HIGH' }] },
                    { source: 'enterprise', vulnerabilities: [{ cve_id: 'CVE-ent-1', severity: 'CRITICAL' }] }
                ]
            });

        const service = new ReportService();
        const ci = await service.getCiDecision('scan-1', 'user-1', 'HIGH');

        expect(ci.pass).toBe(false);
        expect(ci.thresholdSeverity).toBe('HIGH');
        expect(ci.blockingCount).toBe(1);
        expect(ci.blockingVulns).toEqual([{ cve_id: 'CVE-free-1', severity: 'HIGH' }]);
    });

    it('rejects invalid CI threshold severity explicitly', async () => {
        const { ReportService } = require('../../src/services/reportService');
        const service = new ReportService();

        await expect(service.getCiDecision('scan-1', 'user-1', 'SEVERE'))
            .rejects
            .toMatchObject({ code: 'validation_error' });
    });

    it('filters webhook payload fields by plan_at_submission', () => {
        const { WebhookService } = require('../../src/services/webhookService');
        const service = new WebhookService();
        const baseDelta = {
            total_free_count: 1,
            total_enterprise_count: 2,
            delta_count: 1,
            delta_by_severity: { CRITICAL: 1 },
            delta_vulnerabilities: [{ cve_id: 'CVE-ent-1', severity: 'CRITICAL' }]
        };
        const results = [
            { source: 'free', vulnerabilities: [{ cve_id: 'CVE-free-1', severity: 'HIGH' }] },
            { source: 'enterprise', vulnerabilities: [{ cve_id: 'CVE-ent-1', severity: 'CRITICAL' }] }
        ];

        const starterPayload = service.buildPayload(
            { id: 'scan-1', status: 'done', plan_at_submission: 'starter', created_at: '2026-01-01' },
            baseDelta,
            results
        );
        expect(starterPayload.freeVulnerabilities).toHaveLength(1);
        expect(starterPayload.enterpriseVulnerabilities).toEqual([]);
        expect(starterPayload.deltaVulnerabilities).toEqual([]);

        const proPayload = service.buildPayload(
            { id: 'scan-2', status: 'done', plan_at_submission: 'pro', created_at: '2026-01-01' },
            baseDelta,
            results
        );
        expect(proPayload.enterpriseVulnerabilities).toHaveLength(1);
        expect(proPayload.deltaVulnerabilities).toHaveLength(1);
    });

    it('uses deterministic retry delays and stable signing source for webhook retries', async () => {
        const { WebhookService } = require('../../src/services/webhookService');
        const originalFetch = global.fetch;
        global.fetch = jest.fn(async () => { throw new Error('network'); }) as any;

        (mockPool.query as any)
            .mockResolvedValueOnce({
                rows: [{ id: 'delivery-1', scan_id: 'scan-1', attempt_number: 1 }]
            })
            .mockResolvedValueOnce({
                rows: [{ signing_secret: 'secret-1' }]
            })
            .mockResolvedValueOnce({ rows: [] });

        const service = new WebhookService();
        await service.deliver('delivery-1', { scanId: 'scan-1', status: 'done' }, 'https://example.com/webhook');

        expect(addWebhookDeliveryJob).toHaveBeenCalledWith(
            'delivery-1',
            'scan-1',
            { scanId: 'scan-1', status: 'done' },
            'https://example.com/webhook',
            { delay: 60000 }
        );

        global.fetch = originalFetch;
    });

    it('schedules a delivery for every enabled webhook on the scan owner', async () => {
        const { WebhookService } = require('../../src/services/webhookService');
        const { generateUUID } = require('../../src/utils/index.js');
        generateUUID
            .mockReturnValueOnce('delivery-1')
            .mockReturnValueOnce('delivery-2');

        (mockPool.query as any)
            .mockResolvedValueOnce({
                rows: [
                    {
                        id: 'scan-1',
                        user_id: 'user-1',
                        status: 'done',
                        plan_at_submission: 'pro',
                        created_at: '2026-01-01',
                        webhook_id: 'webhook-1',
                        webhook_url: 'https://example.com/hook-1',
                        signing_secret: 'secret-1'
                    },
                    {
                        id: 'scan-1',
                        user_id: 'user-1',
                        status: 'done',
                        plan_at_submission: 'pro',
                        created_at: '2026-01-01',
                        webhook_id: 'webhook-2',
                        webhook_url: 'https://example.com/hook-2',
                        signing_secret: 'secret-2'
                    }
                ]
            })
            .mockResolvedValueOnce({
                rows: [{
                    total_free_count: 1,
                    total_enterprise_count: 1,
                    delta_count: 0,
                    delta_by_severity: {}
                }]
            })
            .mockResolvedValueOnce({
                rows: [
                    { source: 'free', vulnerabilities: [] },
                    { source: 'enterprise', vulnerabilities: [] }
                ]
            })
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [] });

        const service = new WebhookService();
        await service.scheduleDelivery('scan-1');

        expect(addWebhookDeliveryJob).toHaveBeenCalledTimes(2);
        expect(addWebhookDeliveryJob).toHaveBeenNthCalledWith(
            1,
            'delivery-1',
            'scan-1',
            expect.any(Object),
            'https://example.com/hook-1'
        );
        expect(addWebhookDeliveryJob).toHaveBeenNthCalledWith(
            2,
            'delivery-2',
            'scan-1',
            expect.any(Object),
            'https://example.com/hook-2'
        );
    });
});

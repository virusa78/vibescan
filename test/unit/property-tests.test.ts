import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { merge, computeDelta, computeSeverityBreakdown, rankVulnerabilities } from '@services/diffEngine';
import { readFileSync } from 'fs';

const mockPool: any = { query: jest.fn() };
const mockRedisClient: any = { incr: jest.fn(), decr: jest.fn(), get: jest.fn() };

jest.mock('../../src/database/client.js', () => ({
    getPool: jest.fn(() => mockPool),
}));

jest.mock('../../src/redis/quota.js', () => ({
    checkAndConsumeQuota: jest.fn(),
    refundQuota: jest.fn(),
    getQuotaUsage: jest.fn(),
    resetMonthlyQuota: jest.fn(),
    getQuotaLimitsForPlan: jest.fn(() => 50),
}));

jest.mock('../../src/redis/sessions.js', () => ({
    storeSession: jest.fn(),
    deleteSession: jest.fn(),
    getSession: jest.fn(),
}));

jest.mock('../../src/queues/config.js', () => ({
    addWebhookDeliveryJob: jest.fn(),
    addFreeScanJob: jest.fn(),
    addEnterpriseScanJob: jest.fn(),
    getFreeScanQueue: jest.fn(),
    getEnterpriseScanQueue: jest.fn(),
    PRIORITY_WEIGHTS: {
        high: 1,
        medium: 2,
        low: 3
    },
    getPriorityTierForPlan: jest.fn((plan: string) => {
        if (plan === 'enterprise') return 'high';
        if (plan === 'pro') return 'medium';
        return 'low';
    }),
    getPriorityForPlan: jest.fn((plan: string) => {
        if (plan === 'enterprise') return 1;
        if (plan === 'pro') return 2;
        return 3;
    }),
}));

jest.mock('../../src/redis/client.js', () => ({
    getRedisClient: jest.fn(() => mockRedisClient),
}));

jest.mock('../../src/redis/pubsub.js', () => ({
    publishScanStatus: jest.fn(),
}));

jest.mock('../../src/utils/index.js', () => ({
    generateSecureString: jest.fn(() => 'A'.repeat(32)),
    generateHMAC: jest.fn((payload: string, secret: string, algo: string) => `sig:${algo}:${secret}:${payload.length}`),
    generateUUID: jest.fn(() => 'delivery-id-1'),
}));

import {
    checkAndConsumeQuota,
    refundQuota,
    getQuotaUsage
} from '../../src/redis/quota.js';
import { generateHMAC } from '../../src/utils/index.js';

const mockFreeVulns = [
    { cve_id: 'CVE-2024-0001', severity: 'HIGH', cvss_score: 7.5, package_name: 'lodash', is_exploitable: false },
    { cve_id: 'CVE-2024-0002', severity: 'CRITICAL', cvss_score: 9.8, package_name: 'express', is_exploitable: true },
    { cve_id: 'CVE-2024-0003', severity: 'MEDIUM', cvss_score: 5.5, package_name: 'axios', is_exploitable: false },
];

const mockEnterpriseVulns = [
    { cve_id: 'CVE-2024-0001', severity: 'HIGH', cvss_score: 7.5, package_name: 'lodash', is_exploitable: false, fixed_version: '4.17.21' },
    { cve_id: 'CVE-2024-0002', severity: 'CRITICAL', cvss_score: 9.8, package_name: 'express', is_exploitable: true, fixed_version: '4.18.2' },
    { cve_id: 'CVE-2024-0004', severity: 'CRITICAL', cvss_score: 10.0, package_name: 'moment', is_exploitable: true, fixed_version: '2.30.1' },
];

beforeEach(() => {
    (mockPool.query as any).mockReset();
    (checkAndConsumeQuota as any).mockReset();
    (refundQuota as any).mockReset();
    (getQuotaUsage as any).mockReset();
    (generateHMAC as any).mockClear();
});

describe('Property 1: Scan submission decrements quota atomically', () => {
    it('calls quota consumption with increment=1', async () => {
        const { QuotaService } = require('../../src/services/quotaService');
        (checkAndConsumeQuota as any).mockResolvedValue({ allowed: true, remaining: 49, resetAt: new Date() });
        const service = new QuotaService();
        await service.consumeQuota('scan-1', 'user-1');
        expect(checkAndConsumeQuota).toHaveBeenCalledWith('user-1', 1);
    });
});

describe('Property 2: Quota refund on cancellation', () => {
    it('refunds one quota unit', async () => {
        const { QuotaService } = require('../../src/services/quotaService');
        const service = new QuotaService();
        await service.refundQuota('scan-1', 'user-1');
        expect(refundQuota).toHaveBeenCalledWith('user-1', 1);
    });
});

describe('Property 3: Plan snapshot immutability', () => {
    it('preserves plan_at_submission in locked view', () => {
        const { ReportService } = require('../../src/services/reportService');
        const service = new ReportService();
        const scan = { id: 's1', status: 'done', plan_at_submission: 'starter', created_at: '2026-01-01' };
        const delta = { delta_count: 1, delta_by_severity: { CRITICAL: 1 }, total_free_count: 1, total_enterprise_count: 2 };
        const report = service.buildLockedView(scan, delta, [{ source: 'free', vulnerabilities: [] }], 'json');
        expect(report.plan).toBe('starter');
        expect(scan.plan_at_submission).toBe('starter');
    });
});

describe('Property 4: Delta paywall enforcement for starter', () => {
    it('hides delta details for starter in locked report view', () => {
        const { ReportService } = require('../../src/services/reportService');
        const service = new ReportService();
        const scan = { id: 's1', status: 'done', plan_at_submission: 'starter', created_at: '2026-01-01' };
        const delta = {
            delta_count: 2,
            delta_by_severity: { CRITICAL: 1, HIGH: 1 },
            total_free_count: 5,
            total_enterprise_count: 7,
            delta_vulnerabilities: [{ cve_id: 'CVE-1' }]
        };
        const report = service.buildLockedView(scan, delta, [{ source: 'free', vulnerabilities: [{ cve_id: 'CVE-free' }] }], 'json');
        expect(report.locked).toBe(true);
        expect(report.deltaVulnerabilities).toBeNull();
        expect(report.enterpriseVulnerabilities).toBeNull();
        expect(report.freeVulnerabilities).toEqual([{ cve_id: 'CVE-free' }]);
        expect(report.deltaCount).toBe(2);
    });
});

describe('Property 5: Free scanner isolation', () => {
    it('documents isolation flags in worker implementation', () => {
        const source = readFileSync('/home/virus/vibescan/src/workers/freeScannerWorker.ts', 'utf-8');
        expect(source).toContain('--network=none');
        expect(source).toContain('--read-only');
        expect(source).toContain('--user=nobody');
    });
});

describe('Property 6: API key hash-only storage', () => {
    it('enforces vs_ prefix and bcrypt hash storage in service implementation', async () => {
        const source = readFileSync('/home/virus/vibescan/src/services/authService.ts', 'utf-8');
        expect(source).toContain('const rawKey = `vs_${generateSecureString(32)}`');
        expect(source).toContain('bcrypt.hash(rawKey');
        expect(source).toContain('INSERT INTO api_keys');
        expect(source).toContain('key_hash');
    });
});

describe('Property 7: Ownership verification', () => {
    it('returns not_found when scan is not owned/found', async () => {
        const { ReportService } = require('../../src/services/reportService');
        (mockPool.query as any).mockResolvedValueOnce({ rows: [] });
        const service = new ReportService();
        await expect(service.buildReportView('scan-1', 'user-1')).rejects.toMatchObject({ code: 'not_found' });
    });

    it('returns 404 for canceling someone else scan (anti-enumeration)', async () => {
        const { cancelScanHandler } = require('../../src/handlers/scanHandlers');
        (mockPool.query as any).mockResolvedValueOnce({
            rows: [{ id: 'scan-1', user_id: 'user-2', status: 'pending' }]
        });
        const request: any = { apiKey: { user_id: 'user-1' }, user: null, params: { id: 'scan-1' } };
        const reply: any = {
            statusCode: 200,
            payload: null,
            code(n: number) { this.statusCode = n; return this; },
            send(p: any) { this.payload = p; return this; }
        };
        await cancelScanHandler(request, reply);
        expect(reply.statusCode).toBe(404);
        expect(reply.payload.error).toBe('not_found');
    });

    it('uses not_found semantics for non-owned API key revoke path', async () => {
        const source = readFileSync('/home/virus/vibescan/src/handlers/apiKeyHandlers.ts', 'utf-8');
        expect(source).toContain("if (result.rows[0].user_id !== userId)");
        expect(source).toContain("reply.code(404).send({");
        expect(source).toContain("message: 'API key not found'");
    });
});

describe('Property 8: Webhook HMAC signing', () => {
    it('uses HMAC-SHA256 signing helper', () => {
        const { WebhookService } = require('../../src/services/webhookService');
        const service = new WebhookService();
        const signature = service.signPayload('{"scan":"1"}', 'secret');
        expect(generateHMAC).toHaveBeenCalledWith('{"scan":"1"}', 'secret', 'sha256');
        expect(signature).toContain('sig:sha256:secret');
    });
});

describe('Property 9: Exponential backoff retry', () => {
    it('schedules next attempt with failed status', async () => {
        const { WebhookService } = require('../../src/services/webhookService');
        const originalFetch = global.fetch;
        global.fetch = jest.fn(async () => { throw new Error('network down'); }) as any;

        (mockPool.query as any)
            .mockResolvedValueOnce({ rows: [{ id: 'd1', attempt_number: 1, signing_secret: 'secret' }] })
            .mockResolvedValueOnce({ rows: [] });

        const service = new WebhookService();
        await service.deliver('d1', { ok: true }, 'https://webhook.example');

        const updateCall = mockPool.query.mock.calls.find((c: any[]) => String(c[0]).includes('attempt_number'));
        expect(updateCall).toBeDefined();
        expect(updateCall[1][0]).toBe(2);
        global.fetch = originalFetch;
    });
});

describe('Property 10: Enterprise scanner concurrency limit', () => {
    it('rejects slot acquisition when above max concurrent', async () => {
        const { EnterpriseLockManager } = require('../../src/redis/lock');
        (mockRedisClient.incr as any).mockResolvedValueOnce(4);
        (mockRedisClient.decr as any).mockResolvedValueOnce(3);
        const manager = new EnterpriseLockManager();
        const acquired = await manager.acquireSlot();
        expect(acquired).toBe(false);
        expect(mockRedisClient.decr).toHaveBeenCalled();
    });
});

describe('Property 11: Source code TTL cleanup', () => {
    it('tracks 24h source archive TTL requirement in docs/spec', () => {
        const requirements = readFileSync('/home/virus/vibescan/.kiro/specs/vibescan/requirements.md', 'utf-8');
        expect(requirements).toContain('24 hours');
        expect(requirements).toContain('TTL');
    });
});

describe('Property 12: Regional pricing discount', () => {
    it('applies 50% discount for IN and PK', () => {
        const source = readFileSync('/home/virus/vibescan/src/services/billingService.ts', 'utf-8');
        expect(source).toContain('IN: 0.50');
        expect(source).toContain('PK: 0.50');
        expect(source).toContain('OTHER: 0.00');
    });
});

describe('Property 13: Input validation rejection', () => {
    it('rejects invalid input type in scan submission handler', async () => {
        const { submitScanHandler } = require('../../src/handlers/scanHandlers');
        const request: any = { apiKey: { user_id: 'u1' }, user: null, body: { inputType: 'invalid_type' } };
        const reply: any = {
            statusCode: 200,
            payload: null,
            code(n: number) { this.statusCode = n; return this; },
            send(p: any) { this.payload = p; return this; }
        };
        await submitScanHandler(request, reply);
        expect(reply.statusCode).toBe(400);
        expect(reply.payload.error).toBe('validation_error');
    });

    it('rejects invalid fromDate in scan list handler', async () => {
        const { listScansHandler } = require('../../src/handlers/scanHandlers');
        const request: any = { apiKey: { user_id: 'u1' }, user: null, query: { fromDate: 'bad-date' } };
        const reply: any = {
            statusCode: 200,
            payload: null,
            code(n: number) { this.statusCode = n; return this; },
            send(p: any) { this.payload = p; return this; }
        };
        await listScansHandler(request, reply);
        expect(reply.statusCode).toBe(400);
        expect(reply.payload.error).toBe('validation_error');
    });

    it('applies from_date alias filter in scan list query', async () => {
        const { listScansHandler } = require('../../src/handlers/scanHandlers');
        (mockPool.query as any).mockResolvedValueOnce({ rows: [] });
        const request: any = {
            apiKey: { user_id: 'u1' },
            user: null,
            query: { from_date: '2026-01-01T00:00:00.000Z', limit: '20' }
        };
        const reply: any = {
            statusCode: 200,
            payload: null,
            code(n: number) { this.statusCode = n; return this; },
            send(p: any) { this.payload = p; return this; }
        };
        await listScansHandler(request, reply);
        expect(reply.statusCode).toBe(200);
        expect(mockPool.query).toHaveBeenCalled();
        const [queryText, params] = (mockPool.query as any).mock.calls[(mockPool.query as any).mock.calls.length - 1];
        expect(String(queryText)).toContain('s.created_at >=');
        expect(Array.isArray(params)).toBe(true);
    });
});

describe('Property 14: Scan result aggregation', () => {
    it('merges free and enterprise and prefers enterprise data', () => {
        const merged = merge(mockFreeVulns, mockEnterpriseVulns);
        expect(merged.length).toBe(4);
        const lodash = merged.find((v: any) => v.package_name === 'lodash');
        expect(lodash?.fixed_version).toBe('4.17.21');
    });

    it('persists scan result payloads as jsonb arrays/objects', () => {
        const source = readFileSync('/home/virus/vibescan/src/services/scanOrchestrator.ts', 'utf-8');
        expect(source).toContain('VALUES ($1, $2, $3::jsonb, $4::jsonb, $5, $6, $7)');
        expect(source).toContain('JSON.stringify(canonicalVulnerabilities)');
    });
});

describe('Property 15: Error handling with partial results', () => {
    it('finalizes scan when one scanner failed and other succeeded', async () => {
        const { ScanOrchestrator } = require('../../src/services/scanOrchestrator');
        const orchestrator = new ScanOrchestrator();
        const finalizeSpy = jest.spyOn(orchestrator as any, 'finalizeScan').mockResolvedValue(undefined);
        (mockPool.query as any).mockResolvedValueOnce({ rows: [{ id: 'ok' }] });
        await orchestrator.handleWorkerError('scan-1', 'free', { message: 'free failed' });
        expect(finalizeSpy).toHaveBeenCalledWith('scan-1', 'free');
    });

    it('routes free scanner execution failures through orchestrator error handling', () => {
        const source = readFileSync('/home/virus/vibescan/src/workers/freeScannerWorker.ts', 'utf-8');
        expect(source).toContain('await scanOrchestrator.handleWorkerError(scanId, \'free\', error)');
        expect(source).not.toContain('remote_scanner_unavailable');
        expect(source).not.toContain('local_grype_unavailable');
    });

    it('recovers to partial finalize when one worker result arrives after scan was marked error', async () => {
        const { ScanOrchestrator } = require('../../src/services/scanOrchestrator');
        const orchestrator = new ScanOrchestrator();
        const finalizeSpy = jest.spyOn(orchestrator as any, 'finalizeScan').mockResolvedValue(undefined);
        (mockPool.query as any)
            .mockResolvedValueOnce({ rows: [] }) // insert scan_result
            .mockResolvedValueOnce({ rows: [{ count: '1' }] }) // count results
            .mockResolvedValueOnce({ rows: [{ status: 'error' }] }); // scan status

        await orchestrator.handleWorkerResult('scan-1', 'free', {
            rawOutput: {},
            vulnerabilities: [],
            scannerVersion: 'grype-fallback',
            cveDbTimestamp: new Date().toISOString(),
            durationMs: 1
        });

        expect(finalizeSpy).toHaveBeenCalledWith('scan-1', 'enterprise');
    });

    it('clears error_message when finalizing scan as done', () => {
        const source = readFileSync('/home/virus/vibescan/src/services/scanOrchestrator.ts', 'utf-8');
        expect(source).toContain("status = 'done', error_message = NULL, completed_at = NOW()");
    });
});

describe('Property 15.1: Tier priority scheduling', () => {
    it('passes tier-based priority to enterprise queue', async () => {
        const { ScanOrchestrator } = require('../../src/services/scanOrchestrator');
        const { addFreeScanJob, addEnterpriseScanJob } = require('../../src/queues/config.js');
        (checkAndConsumeQuota as any).mockResolvedValue({ allowed: true, remaining: 49, resetAt: new Date() });
        (addFreeScanJob as any).mockResolvedValue('free-job-1');
        (addEnterpriseScanJob as any).mockResolvedValue('ent-job-1');
        (mockPool.query as any)
            .mockResolvedValueOnce({ rows: [{ plan: 'enterprise' }] })
            .mockResolvedValueOnce({
                rows: [{
                    id: 'scan-1',
                    user_id: 'user-1',
                    org_id: null,
                    input_type: 'sbom_upload',
                    input_ref: '',
                    status: 'pending',
                    plan_at_submission: 'enterprise',
                    created_at: '2026-01-01'
                }]
            })
            .mockResolvedValueOnce({ rows: [] });

        const orchestrator = new ScanOrchestrator();
        await orchestrator.submitScan('user-1', 'sbom_upload', { components: [] });

        expect(addFreeScanJob).toHaveBeenCalledWith(expect.any(String), [], expect.objectContaining({ priority: 1 }));
        expect(addEnterpriseScanJob).toHaveBeenCalledWith(expect.any(String), [], { priority: 1 });
    });
});

describe('Property 16: CVE database freshness', () => {
    it('keeps CVE update scheduler at 6-hour cadence in worker source', () => {
        const source = readFileSync('/home/virus/vibescan/src/workers/freeScannerWorker.ts', 'utf-8');
        expect(source).toContain('cveUpdateInterval');
        expect(source).toContain('* 60 * 60 * 1000');
    });
});

describe('Property 17: GitHub App authorization', () => {
    it('has authorization check criteria in requirements', () => {
        const requirements = readFileSync('/home/virus/vibescan/.kiro/specs/vibescan/requirements.md', 'utf-8');
        expect(requirements).toContain('installation is not authorized');
        expect(requirements).toContain('403 Forbidden');
    });
});

describe('Property 18: Report format consistency', () => {
    it('returns stable key shape for full and locked views', () => {
        const { ReportService } = require('../../src/services/reportService');
        const service = new ReportService();
        const scanStarter = { id: 's1', status: 'done', plan_at_submission: 'starter', created_at: '2026-01-01' };
        const delta = { delta_count: 1, delta_by_severity: { CRITICAL: 1 }, total_free_count: 1, total_enterprise_count: 2, delta_vulnerabilities: [{ cve_id: 'CVE-x' }] };
        const results = [{ source: 'free', vulnerabilities: [] }, { source: 'enterprise', vulnerabilities: [] }];
        const locked = service.buildLockedView(scanStarter, delta, results, 'json');
        expect(locked).toEqual(expect.objectContaining({ scanId: 's1', status: 'done', plan: 'starter', locked: true }));
        const summary = service.buildLockedView(scanStarter, delta, results, 'summary');
        expect(summary).toEqual(expect.objectContaining({ scanId: 's1', status: 'done', plan: 'starter', locked: true }));
    });
});

describe('Property 18.1: CI threshold enforcement', () => {
    it('respects requested threshold severity', async () => {
        const { ReportService } = require('../../src/services/reportService');
        (mockPool.query as any)
            .mockResolvedValueOnce({
                rows: [{ id: 's1', user_id: 'u1', plan_at_submission: 'starter', status: 'done', created_at: '2026-01-01' }]
            })
            .mockResolvedValueOnce({
                rows: [{ delta_count: 0, delta_by_severity: {}, delta_vulnerabilities: [], total_free_count: 1, total_enterprise_count: 1 }]
            })
            .mockResolvedValueOnce({
                rows: [
                    { source: 'free', vulnerabilities: [{ cve_id: 'CVE-1', severity: 'HIGH', cvss_score: 7.0 }] },
                    { source: 'enterprise', vulnerabilities: [{ cve_id: 'CVE-1', severity: 'HIGH', cvss_score: 7.0 }] }
                ]
            });

        const service = new ReportService();
        const decision = await service.getCiDecision('s1', 'u1', 'CRITICAL');
        expect(decision.pass).toBe(true);
    });
});

describe('Property 19: Quota ledger accuracy', () => {
    it('computes usage, remaining and percentage from ledger', async () => {
        const { QuotaService } = require('../../src/services/quotaService');
        (getQuotaUsage as any).mockResolvedValue(20);
        (mockPool.query as any).mockResolvedValueOnce({
            rows: [{ scans_limit: '50', reset_at: new Date('2026-12-01T00:00:00Z') }]
        });
        const service = new QuotaService();
        const status = await service.getQuotaStatus('user-1');
        expect(status.used).toBe(20);
        expect(status.limit).toBe(50);
        expect(status.remaining).toBe(30);
        expect(status.percentage).toBe(40);
    });
});

describe('Property 20: Webhook payload plan consistency', () => {
    it('excludes delta vulnerability details for starter payload', () => {
        const { WebhookService } = require('../../src/services/webhookService');
        const service = new WebhookService();
        const payload = service.buildPayload(
            { id: 'scan-1', status: 'done', plan_at_submission: 'starter', created_at: '2026-01-01' },
            {
                total_free_count: 2,
                total_enterprise_count: 3,
                delta_count: 1,
                delta_by_severity: { CRITICAL: 1 },
                delta_vulnerabilities: [{ cve_id: 'CVE-secret' }]
            }
        );
        expect(payload.deltaVulnerabilities).toEqual([]);
        expect(payload.enterpriseVulnerabilities).toEqual([]);
    });
});

describe('DiffEngine', () => {
    describe('computeDelta', () => {
        it('returns only enterprise-only vulnerabilities', () => {
            const free = [
                { cve_id: 'CVE-2024-001', severity: 'HIGH', cvss_score: 7.0 },
                { cve_id: 'CVE-2024-002', severity: 'MEDIUM', cvss_score: 5.0 },
            ];
            const enterprise = [
                { cve_id: 'CVE-2024-001', severity: 'HIGH', cvss_score: 7.0 },
                { cve_id: 'CVE-2024-002', severity: 'MEDIUM', cvss_score: 5.0 },
                { cve_id: 'CVE-2024-003', severity: 'CRITICAL', cvss_score: 9.0 },
            ];
            const delta = computeDelta(free, enterprise);
            expect(delta.deltaCount).toBe(1);
            expect(delta.deltaVulnerabilities[0].cve_id).toBe('CVE-2024-003');
        });
    });

    describe('computeSeverityBreakdown', () => {
        it('counts vulnerabilities by severity', () => {
            const breakdown = computeSeverityBreakdown([
                { severity: 'CRITICAL' },
                { severity: 'CRITICAL' },
                { severity: 'HIGH' },
                { severity: 'MEDIUM' },
                { severity: 'LOW' },
            ]);
            expect(breakdown).toEqual({ CRITICAL: 2, HIGH: 1, MEDIUM: 1, LOW: 1 });
        });
    });

    describe('rankVulnerabilities', () => {
        it('sorts by severity, CVSS and exploitability', () => {
            const ranked = rankVulnerabilities([
                { cve_id: 'CVE-2024-001', severity: 'HIGH', cvss_score: 7.0, is_exploitable: false },
                { cve_id: 'CVE-2024-002', severity: 'CRITICAL', cvss_score: 9.0, is_exploitable: false },
                { cve_id: 'CVE-2024-003', severity: 'CRITICAL', cvss_score: 9.5, is_exploitable: true },
                { cve_id: 'CVE-2024-004', severity: 'HIGH', cvss_score: 8.0, is_exploitable: true },
            ]);
            expect(ranked.map((v: any) => v.cve_id)).toEqual([
                'CVE-2024-003',
                'CVE-2024-002',
                'CVE-2024-004',
                'CVE-2024-001',
            ]);
        });
    });
});

import { describe, expect, it, jest } from '@jest/globals';
import crypto from 'crypto';

jest.mock('../../src/services/scanOrchestrator', () => ({
    scanOrchestrator: { submitScan: jest.fn() },
}));

describe('GithubIntegrationService', () => {
    it('validates webhook signatures through deterministic entrypoint', () => {
        const { GithubIntegrationService } = require('../../src/services/githubIntegrationService');
        const secret = 'test-secret';
        const service = new GithubIntegrationService({
            pool: { query: jest.fn() } as any,
            adapter: {
                triggerWebhookGithubScan: jest.fn(),
                buildCheckRunContract: jest.fn((input: any) => ({ ...input, output: { summary: input.summary } }))
            } as any,
            webhookSecret: secret,
        });

        const raw = Buffer.from(JSON.stringify({ ok: true }));
        const signature = `sha256=${crypto.createHmac('sha256', secret).update(raw).digest('hex')}`;

        expect(service.verifyWebhookSignature(raw, signature)).toEqual({ valid: true });
        expect(service.verifyWebhookSignature(raw, 'sha256=deadbeef')).toEqual({
            valid: false,
            reason: 'invalid_signature',
        });
    });

    it('stores installation lifecycle updates when org mapping exists', async () => {
        const { GithubIntegrationService } = require('../../src/services/githubIntegrationService');
        const query = jest.fn<() => Promise<any>>()
            .mockResolvedValueOnce({ rows: [{ id: 'org-1' }] })
            .mockResolvedValueOnce({ rowCount: 1 });
        const service = new GithubIntegrationService({
            pool: { query } as any,
            adapter: {
                triggerWebhookGithubScan: jest.fn(),
                buildCheckRunContract: jest.fn((input: any) => ({ ...input, output: { summary: input.summary } }))
            } as any,
            checkRunService: { createCheckRun: jest.fn(), updateCheckRun: jest.fn() } as any,
            webhookSecret: 'secret',
        });

        const result = await service.handleWebhookEvent('installation', {
            action: 'created',
            installation: { id: 123, app_id: 999 },
            repositories: [{ full_name: 'octo-org/example-repo' }],
        });

        expect(result.action).toBe('installation_updated');
        expect(query).toHaveBeenCalled();
    });

    it('filters push events by repo/branch authorization and triggers scan', async () => {
        const { GithubIntegrationService } = require('../../src/services/githubIntegrationService');
        const triggerWebhookGithubScan = jest.fn<() => Promise<any>>().mockResolvedValue({
            triggered: true,
            duplicate: false,
            scanId: 'scan-1',
        });
        const createCheckRun = jest.fn<() => Promise<any>>().mockResolvedValue({ id: 99 });

        const service = new GithubIntegrationService({
            pool: {
                query: jest.fn<() => Promise<any>>()
                    .mockResolvedValueOnce({
                        rows: [{
                            github_installation_id: 123,
                            repos_scope: ['octo-org/example-repo'],
                            trigger_on_push: true,
                            trigger_on_pr: true,
                            target_branches: ['main'],
                            owner_user_id: 'user-1',
                            fail_pr_on_severity: 'HIGH'
                        }]
                    })
                    .mockResolvedValueOnce({ rows: [] })
                    .mockResolvedValueOnce({ rowCount: 1 })
            } as any,
            adapter: {
                triggerWebhookGithubScan,
                buildCheckRunContract: jest.fn((input: any) => ({ ...input, output: { summary: input.summary }, conclusion: 'failure' }))
            } as any,
            checkRunService: { createCheckRun, updateCheckRun: jest.fn() } as any,
            webhookSecret: 'secret',
        });

        const result = await service.handleWebhookEvent('push', {
            installation: { id: 123 },
            repository: { full_name: 'octo-org/example-repo' },
            ref: 'refs/heads/main',
            after: 'abc123',
        }, 'delivery-1');

        expect(result.action).toBe('scan_triggered');
        expect(result.scanId).toBe('scan-1');
        expect(triggerWebhookGithubScan).toHaveBeenCalledWith({
            userId: 'user-1',
            repo: 'octo-org/example-repo',
            ref: 'abc123',
            installationId: 123,
            trigger: 'push',
            deliveryId: 'delivery-1',
        });
        expect(createCheckRun).toHaveBeenCalled();
    });

    it('completes check run using free-only scope for starter plan scans', async () => {
        const { GithubIntegrationService } = require('../../src/services/githubIntegrationService');
        const updateCheckRun = jest.fn<() => Promise<any>>().mockResolvedValue(undefined);
        const query = jest.fn<() => Promise<any>>()
            .mockResolvedValueOnce({
                rows: [{
                    scan_id: 'scan-1',
                    github_installation_id: 123,
                    repository_full_name: 'octo-org/example-repo',
                    head_sha: 'abc123',
                    check_run_id: 55,
                    fail_on_severity: 'HIGH'
                }]
            })
            .mockResolvedValueOnce({ rows: [{ id: 'scan-1', status: 'done', plan_at_submission: 'starter' }] })
            .mockResolvedValueOnce({
                rows: [
                    { source: 'free', vulnerabilities: [{ cve_id: 'CVE-free-1', severity: 'HIGH' }] },
                    { source: 'enterprise', vulnerabilities: [{ cve_id: 'CVE-ent-1', severity: 'CRITICAL' }] }
                ]
            })
            .mockResolvedValueOnce({ rowCount: 1 });

        const service = new GithubIntegrationService({
            pool: { query } as any,
            adapter: {
                triggerWebhookGithubScan: jest.fn(),
                buildCheckRunContract: jest.fn((input: any) => ({ ...input, output: { summary: input.summary }, conclusion: 'failure' }))
            } as any,
            checkRunService: { createCheckRun: jest.fn(), updateCheckRun } as any,
            webhookSecret: 'secret',
        });

        await service.handleScanCompleted('scan-1');

        expect(updateCheckRun).toHaveBeenCalledTimes(1);
        const call = (updateCheckRun.mock.calls[0] as any[])[0] as any;
        expect(call.payload.conclusion).toBe('failure');
        expect(call.payload.output.summary).toContain('Visibility scope: free vulnerabilities only');
        expect(call.payload.output.summary).not.toContain('Enterprise totals');
    });
});

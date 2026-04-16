import { describe, expect, it, jest } from '@jest/globals';

jest.mock('../../src/services/scanOrchestrator', () => ({
    scanOrchestrator: { submitScan: jest.fn() },
}));

describe('GithubOrchestratorAdapter', () => {
    it('normalizes explicit github payload and canonicalizes repo/ref', () => {
        const { GithubOrchestratorAdapter } = require('../../src/services/githubOrchestratorAdapter');
        const adapter = new GithubOrchestratorAdapter({
            pool: { query: jest.fn() } as any,
            orchestrator: { submitScan: jest.fn() } as any,
            inputAdapter: { fromGithubUrl: jest.fn() } as any,
        });

        const normalized = adapter.normalizeGithubScanPayload({
            github: {
                repo: 'octo-org/example-repo',
                ref: ' main ',
                installationId: '42',
            },
        });

        expect(normalized).toEqual({
            repo: 'octo-org/example-repo',
            ref: 'main',
            cloneUrl: 'https://github.com/octo-org/example-repo.git',
            installationId: 42,
        });
    });

    it('rejects github repo values that are not owner/repo', () => {
        const { GithubOrchestratorAdapter } = require('../../src/services/githubOrchestratorAdapter');
        const adapter = new GithubOrchestratorAdapter({
            pool: { query: jest.fn() } as any,
            orchestrator: { submitScan: jest.fn() } as any,
            inputAdapter: { fromGithubUrl: jest.fn() } as any,
        });

        expect(() => adapter.normalizeGithubScanPayload({
            github: {
                repo: 'https://github.com/octo-org/example-repo',
                ref: 'main',
            },
        })).toThrow(expect.objectContaining({
            code: 'validation_error',
            validation_errors: [expect.objectContaining({ field: 'github.repo' })]
        }));
    });

    it('rejects github ref values with invalid git ref sequences', () => {
        const { GithubOrchestratorAdapter } = require('../../src/services/githubOrchestratorAdapter');
        const adapter = new GithubOrchestratorAdapter({
            pool: { query: jest.fn() } as any,
            orchestrator: { submitScan: jest.fn() } as any,
            inputAdapter: { fromGithubUrl: jest.fn() } as any,
        });

        expect(() => adapter.normalizeGithubScanPayload({
            githubRepo: 'octo-org/example-repo',
            githubRef: 'feature..broken',
        })).toThrow(expect.objectContaining({
            code: 'validation_error',
            validation_errors: [expect.objectContaining({ field: 'github.ref' })]
        }));
    });

    it('supports legacy githubRepo/githubRef payload and default ref', () => {
        const { GithubOrchestratorAdapter } = require('../../src/services/githubOrchestratorAdapter');
        const adapter = new GithubOrchestratorAdapter({
            pool: { query: jest.fn() } as any,
            orchestrator: { submitScan: jest.fn() } as any,
            inputAdapter: { fromGithubUrl: jest.fn() } as any,
        });

        const normalized = adapter.normalizeGithubScanPayload({
            githubRepo: 'octo-org/example-repo',
        });

        expect(normalized.repo).toBe('octo-org/example-repo');
        expect(normalized.ref).toBe('HEAD');
    });

    it('deduplicates webhook-triggered scans using delivery-based inputRef', async () => {
        const { GithubOrchestratorAdapter } = require('../../src/services/githubOrchestratorAdapter');
        const query = jest.fn<() => Promise<any>>().mockResolvedValueOnce({ rows: [{ id: 'scan-existing' }] });
        const submitScan = jest.fn<() => Promise<any>>();
        const adapter = new GithubOrchestratorAdapter({
            pool: { query } as any,
            orchestrator: { submitScan } as any,
            inputAdapter: { fromGithubUrl: jest.fn() } as any,
        });

        const result = await adapter.triggerWebhookGithubScan({
            userId: 'user-1',
            repo: 'octo-org/example-repo',
            ref: 'abc123',
            trigger: 'push',
            deliveryId: 'delivery-1',
        });

        expect(result).toEqual({ triggered: false, duplicate: true, scanId: 'scan-existing' });
        expect(submitScan).not.toHaveBeenCalled();
    });

    it('builds stable check-run payload contract', () => {
        const { GithubOrchestratorAdapter } = require('../../src/services/githubOrchestratorAdapter');
        const adapter = new GithubOrchestratorAdapter({
            pool: { query: jest.fn() } as any,
            orchestrator: { submitScan: jest.fn() } as any,
            inputAdapter: { fromGithubUrl: jest.fn() } as any,
        });

        const contract = adapter.buildCheckRunContract({
            headSha: 'abc123',
            summary: 'No blocking vulnerabilities',
            failingCount: 0,
        });

        expect(contract.name).toBe('VibeScan Security');
        expect(contract.head_sha).toBe('abc123');
        expect(contract.status).toBe('completed');
        expect(contract.conclusion).toBe('success');
    });
});

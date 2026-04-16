import { describe, expect, it, jest } from '@jest/globals';

jest.mock('../../src/services/scanOrchestrator.js', () => ({
    scanOrchestrator: {
        submitScan: jest.fn()
    }
}));

jest.mock('../../src/services/inputAdapterService.js', () => ({
    inputAdapterService: {
        fromSourceZip: jest.fn(),
        validateCycloneDX: jest.fn(() => ({ valid: true, errors: [] }))
    }
}));

jest.mock('../../src/services/githubOrchestratorAdapter.js', () => ({
    githubOrchestratorAdapter: {
        submitGithubAppScan: jest.fn(async () => {
            throw {
                code: 'validation_error',
                message: 'github.repo must match owner/repo format',
                validation_errors: [{ field: 'github.repo', message: 'Repository must use owner/repo format' }]
            };
        })
    }
}));

describe('submitScanHandler github validation contract', () => {
    it('returns validation_error payload with field-level details', async () => {
        const { submitScanHandler } = require('../../src/handlers/scanHandlers');

        const request: any = {
            apiKey: { user_id: 'user-1' },
            user: null,
            body: {
                inputType: 'github_app',
                githubRepo: 'https://github.com/octo-org/example-repo',
                githubRef: 'main'
            }
        };

        const reply: any = {
            statusCode: 200,
            payload: null,
            code(n: number) { this.statusCode = n; return this; },
            send(p: any) { this.payload = p; return this; }
        };

        await submitScanHandler(request, reply);

        expect(reply.statusCode).toBe(400);
        expect(reply.payload).toEqual({
            error: 'validation_error',
            message: 'github.repo must match owner/repo format',
            validation_errors: [{ field: 'github.repo', message: 'Repository must use owner/repo format' }]
        });
    });
});

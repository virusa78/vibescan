import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockFromSourceZip = jest.fn();

jest.mock('../../src/services/scanOrchestrator.js', () => ({
    scanOrchestrator: {
        submitScan: jest.fn()
    }
}));

jest.mock('../../src/services/githubOrchestratorAdapter.js', () => ({
    githubOrchestratorAdapter: {
        submitGithubAppScan: jest.fn()
    }
}));

jest.mock('../../src/services/inputAdapterService.js', () => ({
    inputAdapterService: {
        fromSourceZip: mockFromSourceZip,
        validateCycloneDX: jest.fn(() => ({ valid: true, errors: [] }))
    }
}));

describe('submitScanHandler payload-too-large contract', () => {
    beforeEach(() => {
        mockFromSourceZip.mockReset();
    });

    it('returns 413 payload_too_large when source ZIP exceeds max size', async () => {
        const { submitScanHandler } = require('../../src/handlers/scanHandlers');
        (mockFromSourceZip as any).mockRejectedValueOnce({
            code: 'payload_too_large',
            message: 'Source ZIP exceeds 50MB limit',
            maxSizeBytes: 52428800,
            actualSizeBytes: 52428801
        });

        const request: any = {
            apiKey: { user_id: 'user-1' },
            user: null,
            body: {
                inputType: 'source_zip',
                sourceZipKey: 'sources/big.zip'
            }
        };
        const reply: any = {
            statusCode: 200,
            payload: null,
            code(n: number) { this.statusCode = n; return this; },
            send(p: any) { this.payload = p; return this; }
        };

        await submitScanHandler(request, reply);

        expect(reply.statusCode).toBe(413);
        expect(reply.payload).toMatchObject({
            error: 'payload_too_large',
            maxSizeBytes: 52428800,
            actualSizeBytes: 52428801
        });
    });
});

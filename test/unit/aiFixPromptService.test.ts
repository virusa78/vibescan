import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockPool: { query: ReturnType<typeof jest.fn> } = {
    query: jest.fn(),
};

jest.mock('../../src/database/client.js', () => ({
    getPool: jest.fn(() => mockPool),
}));

import { AiFixPromptService } from '../../src/services/aiFixPromptService.js';

describe('AiFixPromptService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('returns cached prompt on cve/package/version cache hit', async () => {
        const service = new AiFixPromptService();
        mockPool.query
            .mockResolvedValueOnce({ rows: [{ id: 'scan-1' }] })
            .mockResolvedValueOnce({
                rows: [{
                    id: 'prompt-1',
                    scan_id: 'scan-1',
                    user_id: 'user-1',
                    vulnerability_id: 'CVE-2026-0001|openssl|1.1.1',
                    cache_key: 'CVE-2026-0001|openssl|1.1.1',
                    prompt_text: 'cached prompt',
                    status: 'generated',
                }],
            });

        const result = await service.generatePrompt({
            scanId: 'scan-1',
            userId: 'user-1',
            cveId: 'CVE-2026-0001',
            packageName: 'openssl',
            installedVersion: '1.1.1',
        });

        expect(result.cacheHit).toBe(true);
        expect(result.prompt.id).toBe('prompt-1');
        expect(mockPool.query).toHaveBeenCalledTimes(2);
    });
});

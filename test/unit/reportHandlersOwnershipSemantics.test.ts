import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockBuildReportView = jest.fn();

jest.mock('../../src/services/reportService.js', () => ({
    reportService: {
        buildReportView: mockBuildReportView,
        generatePdf: jest.fn(),
        getCiDecision: jest.fn(),
        getPdfGenerationStatus: jest.fn()
    }
}));

describe('report handler ownership anti-enumeration', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('maps forbidden errors to 404 not_found semantics', async () => {
        const { getReportHandler } = require('../../src/handlers/reportHandlers');
        (mockBuildReportView as any).mockRejectedValueOnce({
            code: 'forbidden',
            message: 'forbidden'
        });

        const request: any = {
            apiKey: { user_id: 'user-1' },
            params: { scanId: 'scan-1' },
            query: { format: 'json' }
        };
        const reply: any = {
            statusCode: 200,
            payload: null,
            code(n: number) { this.statusCode = n; return this; },
            send(p: any) { this.payload = p; return this; }
        };

        await getReportHandler(request, reply);

        expect(reply.statusCode).toBe(404);
        expect(reply.payload).toEqual({
            error: 'not_found',
            message: 'Report not found'
        });
    });
});

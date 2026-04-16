import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockCancelScan = jest.fn();

jest.mock('../../src/services/scanOrchestrator.js', () => ({
    scanOrchestrator: {
        submitScan: jest.fn(),
        cancelScan: mockCancelScan
    }
}));

describe('cancelScanHandler semantics', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('returns 401 when unauthenticated', async () => {
        const { cancelScanHandler } = require('../../src/handlers/scanHandlers');
        const request: any = {
            apiKey: null,
            user: null,
            params: { id: 'scan-1' }
        };
        const reply: any = {
            statusCode: 200,
            payload: null,
            code(n: number) { this.statusCode = n; return this; },
            send(p: any) { this.payload = p; return this; }
        };

        await cancelScanHandler(request, reply);

        expect(reply.statusCode).toBe(401);
        expect(reply.payload).toEqual(expect.objectContaining({ error: 'unauthorized' }));
    });

    it('returns 404 not_found semantics for ownership failures', async () => {
        const { cancelScanHandler } = require('../../src/handlers/scanHandlers');
        (mockCancelScan as any).mockRejectedValueOnce({ code: 'not_found', message: 'Scan not found' });

        const request: any = {
            apiKey: { user_id: 'user-1' },
            params: { id: 'scan-2' }
        };
        const reply: any = {
            statusCode: 200,
            payload: null,
            code(n: number) { this.statusCode = n; return this; },
            send(p: any) { this.payload = p; return this; }
        };

        await cancelScanHandler(request, reply);

        expect(reply.statusCode).toBe(404);
        expect(reply.payload).toEqual({ error: 'not_found', message: 'Scan not found' });
    });

    it('returns 409 conflict payload with cancellation context', async () => {
        const { cancelScanHandler } = require('../../src/handlers/scanHandlers');
        (mockCancelScan as any).mockRejectedValueOnce({
            code: 'conflict',
            message: 'Scan cancellation conflict: scan is already processing and cannot be revoked',
            status: 'scanning',
            cancellation_state: 'processing'
        });

        const request: any = {
            apiKey: { user_id: 'user-3' },
            params: { id: 'scan-3' }
        };
        const reply: any = {
            statusCode: 200,
            payload: null,
            code(n: number) { this.statusCode = n; return this; },
            send(p: any) { this.payload = p; return this; }
        };

        await cancelScanHandler(request, reply);

        expect(reply.statusCode).toBe(409);
        expect(reply.payload).toEqual({
            error: 'conflict',
            message: 'Scan cancellation conflict: scan is already processing and cannot be revoked',
            status: 'scanning',
            cancellation_state: 'processing'
        });
    });
});

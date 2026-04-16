import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import fastify, { FastifyInstance } from 'fastify';
import {
    getRemediationProgressHandler,
    listRemediationItemsHandler,
    upsertRemediationItemHandler,
} from '../../src/handlers/cveRemediationHandlers';

async function createAppWithRemediationRoutes(): Promise<FastifyInstance> {
    const app = fastify();
    app.post('/remediation/:scanId/items', upsertRemediationItemHandler);
    app.get('/remediation/:scanId/items', listRemediationItemsHandler);
    app.get('/remediation/:scanId/progress', getRemediationProgressHandler);
    await app.ready();
    return app;
}

describe('Remediation API contract (auth boundary)', () => {
    let app: FastifyInstance;

    beforeEach(async () => {
        app = await createAppWithRemediationRoutes();
    });

    afterEach(async () => {
        await app.close();
    });

    it('POST /remediation/:scanId/items requires authentication', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/remediation/scan-123/items',
            payload: { cveId: 'CVE-2026-0001', status: 'in_progress' },
        });

        expect(response.statusCode).toBe(401);
        expect(response.json()).toEqual(expect.objectContaining({
            error: 'unauthorized',
            message: expect.any(String),
        }));
    });

    it('GET /remediation/:scanId/items requires authentication', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/remediation/scan-123/items',
        });

        expect(response.statusCode).toBe(401);
        expect(response.json()).toEqual(expect.objectContaining({
            error: 'unauthorized',
            message: expect.any(String),
        }));
    });

    it('GET /remediation/:scanId/progress requires authentication', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/remediation/scan-123/progress',
        });

        expect(response.statusCode).toBe(401);
        expect(response.json()).toEqual(expect.objectContaining({
            error: 'unauthorized',
            message: expect.any(String),
        }));
    });
});

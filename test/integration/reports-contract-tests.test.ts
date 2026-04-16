import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import fastify, { FastifyInstance } from 'fastify';
import {
    getCiDecisionHandler,
    getReportHandler,
    generatePdfReportHandler,
    getPdfReportStatusHandler
} from '../../src/handlers/reportHandlers';

async function createAppWithReportRoutes(): Promise<FastifyInstance> {
    const app = fastify();
    app.get('/reports/:scanId', getReportHandler);
    app.post('/reports/:scanId/pdf', generatePdfReportHandler);
    app.get('/reports/:scanId/ci', getCiDecisionHandler);
    app.get('/reports/jobs/:jobId', getPdfReportStatusHandler);
    await app.ready();
    return app;
}

describe('Reports API contract (auth boundary)', () => {
    let app: FastifyInstance;

    beforeEach(async () => {
        app = await createAppWithReportRoutes();
    });

    afterEach(async () => {
        await app.close();
    });

    it('GET /reports/:scanId requires authentication', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/reports/scan-123?format=json',
        });

        expect(response.statusCode).toBe(401);
        expect(response.json()).toEqual(expect.objectContaining({
            error: 'unauthorized',
            message: expect.any(String),
        }));
    });

    it('POST /reports/:scanId/pdf requires authentication', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/reports/scan-123/pdf',
        });

        expect(response.statusCode).toBe(401);
        expect(response.json()).toEqual(expect.objectContaining({
            error: 'unauthorized',
            message: expect.any(String),
        }));
    });

    it('GET /reports/:scanId/ci requires authentication', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/reports/scan-123/ci',
        });

        expect(response.statusCode).toBe(401);
        expect(response.json()).toEqual(expect.objectContaining({
            error: 'unauthorized',
            message: expect.any(String),
        }));
    });

    it('GET /reports/jobs/:jobId requires authentication', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/reports/jobs/job-123',
        });

        expect(response.statusCode).toBe(401);
        expect(response.json()).toEqual(expect.objectContaining({
            error: 'unauthorized',
            message: expect.any(String),
        }));
    });
});

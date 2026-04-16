/**
 * Report handlers
 *
 * Handles /reports/* endpoints.
 */

import type { FastifyReply, FastifyRequest } from 'fastify';
import { reportService } from '../services/reportService.js';

function getReportService(): any {
    return reportService;
}

type ReportParams = {
    scanId: string;
};

type ReportJobParams = {
    jobId: string;
};

type ReportQuery = {
    format?: 'json' | 'summary';
    thresholdSeverity?: string;
};

function getAuthenticatedUserId(request: FastifyRequest): string | null {
    const req = request as FastifyRequest & {
        apiKey?: { user_id?: string };
        user?: { userId?: string };
    };
    return req.apiKey?.user_id || req.user?.userId || null;
}

function sendReportError(reply: FastifyReply, error: unknown): void {
    const reportError = error as { code?: string; message?: string; validation_errors?: unknown[] };

    switch (reportError?.code) {
        case 'unauthorized':
            reply.code(401).send({
                error: 'unauthorized',
                message: reportError.message || 'Authentication required'
            });
            return;
        case 'forbidden':
            reply.code(404).send({
                error: 'not_found',
                message: 'Report not found'
            });
            return;
        case 'not_found':
            reply.code(404).send({
                error: 'not_found',
                message: reportError.message || 'Report not found'
            });
            return;
        case 'validation_error':
            reply.code(400).send({
                error: 'validation_error',
                message: reportError.message || 'Validation failed',
                validation_errors: reportError.validation_errors
            });
            return;
        case 'conflict':
            reply.code(409).send({
                error: 'conflict',
                message: reportError.message || 'Conflict'
            });
            return;
        default:
            reply.code(500).send({
                error: 'internal_error',
                message: reportError?.message || 'Failed to process report request'
            });
    }
}

/**
 * Get report handler
 * GET /reports/:scanId?format=json|summary
 */
export async function getReportHandler(
    request: FastifyRequest<{ Params: ReportParams; Querystring: ReportQuery }>,
    reply: FastifyReply
): Promise<void> {
    const userId = getAuthenticatedUserId(request);
    if (!userId) {
        reply.code(401).send({
            error: 'unauthorized',
            message: 'Authentication required'
        });
        return;
    }

    const { scanId } = request.params;
    const format = request.query?.format || 'json';

    if (!['json', 'summary'].includes(format)) {
        reply.code(400).send({
            error: 'validation_error',
            message: 'Invalid format. Valid formats: json, summary',
            validation_errors: [{ field: 'format', message: 'format must be one of: json, summary' }]
        });
        return;
    }

    try {
        const reportService = getReportService();
        const report = await reportService.buildReportView(scanId, userId, format);
        reply.code(200).send(report);
    } catch (error) {
        sendReportError(reply, error);
    }
}

/**
 * Generate PDF report handler
 * POST /reports/:scanId/pdf
 */
export async function generatePdfReportHandler(
    request: FastifyRequest<{ Params: ReportParams }>,
    reply: FastifyReply
): Promise<void> {
    const userId = getAuthenticatedUserId(request);
    if (!userId) {
        reply.code(401).send({
            error: 'unauthorized',
            message: 'Authentication required'
        });
        return;
    }

    const { scanId } = request.params;

    try {
        const reportService = getReportService();
        const result = await reportService.generatePdf(scanId, userId);
        reply.code(202).send(result);
    } catch (error) {
        sendReportError(reply, error);
    }
}

/**
 * Get CI decision handler
 * GET /reports/:scanId/ci
 */
export async function getCiDecisionHandler(
    request: FastifyRequest<{ Params: ReportParams; Querystring: ReportQuery }>,
    reply: FastifyReply
): Promise<void> {
    const userId = getAuthenticatedUserId(request);
    if (!userId) {
        reply.code(401).send({
            error: 'unauthorized',
            message: 'Authentication required'
        });
        return;
    }

    const { scanId } = request.params;
    const thresholdSeverity = request.query?.thresholdSeverity || 'HIGH';

    try {
        const reportService = getReportService();
        const result = await reportService.getCiDecision(scanId, userId, thresholdSeverity);
        reply.code(200).send(result);
    } catch (error) {
        sendReportError(reply, error);
    }
}

/**
 * Get PDF generation job status handler
 * GET /reports/jobs/:jobId
 */
export async function getPdfReportStatusHandler(
    request: FastifyRequest<{ Params: ReportJobParams }>,
    reply: FastifyReply
): Promise<void> {
    const userId = getAuthenticatedUserId(request);
    if (!userId) {
        reply.code(401).send({
            error: 'unauthorized',
            message: 'Authentication required'
        });
        return;
    }

    const { jobId } = request.params;

    try {
        const reportService = getReportService();
        const result = await reportService.getPdfGenerationStatus(jobId, userId);
        reply.code(200).send(result);
    } catch (error) {
        sendReportError(reply, error);
    }
}

export default {
    getReportHandler,
    generatePdfReportHandler,
    getCiDecisionHandler,
    getPdfReportStatusHandler
};

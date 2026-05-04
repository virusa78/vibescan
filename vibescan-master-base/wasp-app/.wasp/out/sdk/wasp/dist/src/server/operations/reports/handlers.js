import { getReport, getReportSummary, generateReportPDF, getCIDecision, upsertFindingAnnotation, listFindingAnnotations, } from './index';
import { resolveRequestUser } from '../../services/requestAuth';
import { parseJsonBodyWithLimit, enforceRateLimit, getRateLimitKey } from '../../http/requestGuards';
import { sendOperationError } from '../../http/httpErrors';
export async function getReportApiHandler(request, response, context) {
    try {
        const user = await resolveRequestUser(request, context);
        const result = await getReport({ scanId: String(request.params.scanId) }, { user: user || undefined });
        response.status(200).json(result);
    }
    catch (error) {
        sendOperationError('report-operation', error, response);
    }
}
export async function getReportSummaryApiHandler(request, response, context) {
    try {
        const user = await resolveRequestUser(request, context);
        const result = await getReportSummary({ scanId: String(request.params.scanId) }, { user: user || undefined });
        response.status(200).json(result);
    }
    catch (error) {
        sendOperationError('report-operation', error, response);
    }
}
export async function generateReportPDFApiHandler(request, response, context) {
    try {
        const body = parseJsonBodyWithLimit(request.body);
        const user = await resolveRequestUser(request, context);
        await enforceRateLimit({
            key: getRateLimitKey('report-pdf', user?.id || request.ip || 'anonymous'),
            limit: 30,
            windowSeconds: 60,
        });
        const result = await generateReportPDF({
            scanId: String(request.params.scanId),
            ...body,
        }, { user: user || undefined });
        response.status(200).json(result);
    }
    catch (error) {
        sendOperationError('report-operation', error, response);
    }
}
export async function getCIDecisionApiHandler(request, response, context) {
    try {
        const user = await resolveRequestUser(request, context);
        const result = await getCIDecision({ scanId: String(request.params.scanId) }, { user: user || undefined });
        response.status(200).json(result);
    }
    catch (error) {
        sendOperationError('report-operation', error, response);
    }
}
export async function upsertFindingAnnotationApiHandler(request, response, context) {
    try {
        const user = await resolveRequestUser(request, context);
        const body = parseJsonBodyWithLimit(request.body);
        const result = await upsertFindingAnnotation({
            scanId: String(request.params.scanId),
            findingId: String(request.params.findingId),
            ...body,
        }, { user: user || undefined });
        response.status(200).json(result);
    }
    catch (error) {
        sendOperationError('report-operation', error, response);
    }
}
export async function listFindingAnnotationsApiHandler(request, response, context) {
    try {
        const user = await resolveRequestUser(request, context);
        const state = Array.isArray(request.query.state) ? request.query.state[0] : request.query.state;
        const result = await listFindingAnnotations({
            scanId: String(request.params.scanId),
            ...(typeof state === 'string' ? { state } : {}),
        }, { user: user || undefined });
        response.status(200).json(result);
    }
    catch (error) {
        sendOperationError('report-operation', error, response);
    }
}
//# sourceMappingURL=handlers.js.map
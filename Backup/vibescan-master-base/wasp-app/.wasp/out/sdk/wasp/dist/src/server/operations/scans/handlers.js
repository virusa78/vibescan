import { submitScan, listScans, getScan, cancelScan, getScanStats, } from './index';
import { resolveRequestUser } from '../../services/requestAuth';
import { enforceRateLimit, getRateLimitKey, parseJsonBodyWithLimit } from '../../http/requestGuards';
import { sendOperationError } from '../../http/httpErrors';
export async function submitScanApiHandler(request, response, context) {
    try {
        let body = {};
        body = parseJsonBodyWithLimit(request.body);
        const user = await resolveRequestUser(request, context);
        await enforceRateLimit({
            key: getRateLimitKey('scan-submit', user?.id || request.ip || 'anonymous'),
            limit: 20,
            windowSeconds: 60,
        });
        const result = await submitScan(body, {
            user: user || undefined,
        });
        response.status(201).json(result);
    }
    catch (error) {
        sendOperationError('scan-operation', error, response);
    }
}
export async function listScansApiHandler(request, response, context) {
    try {
        const limitParam = request.query.limit;
        const offsetParam = request.query.offset;
        const statusParam = request.query.status;
        const createdFromParam = request.query.created_from;
        const createdToParam = request.query.created_to;
        const limit = limitParam ? parseInt(Array.isArray(limitParam) ? limitParam[0] : limitParam) : 25;
        const offset = offsetParam ? parseInt(Array.isArray(offsetParam) ? offsetParam[0] : offsetParam) : 0;
        const status = Array.isArray(statusParam) ? statusParam[0] : statusParam;
        const createdFrom = Array.isArray(createdFromParam) ? createdFromParam[0] : createdFromParam;
        const createdTo = Array.isArray(createdToParam) ? createdToParam[0] : createdToParam;
        const args = {
            limit,
            offset,
            status,
            created_from: createdFrom,
            created_to: createdTo,
        };
        const user = await resolveRequestUser(request, context);
        const result = await listScans(args, {
            user: user || undefined,
        });
        response.status(200).json(result);
    }
    catch (error) {
        sendOperationError('scan-operation', error, response);
    }
}
export async function getScanApiHandler(request, response, context) {
    try {
        const args = {
            scan_id: String(request.params.scanId),
        };
        const user = await resolveRequestUser(request, context);
        const result = await getScan(args, {
            user: user || undefined,
        });
        response.status(200).json(result);
    }
    catch (error) {
        sendOperationError('scan-operation', error, response);
    }
}
export async function cancelScanApiHandler(request, response, context) {
    try {
        const args = {
            scan_id: String(request.params.scanId),
        };
        const user = await resolveRequestUser(request, context);
        const result = await cancelScan(args, {
            user: user || undefined,
        });
        response.status(200).json(result);
    }
    catch (error) {
        sendOperationError('scan-operation', error, response);
    }
}
export async function getScanStatsApiHandler(request, response, context) {
    try {
        const timeRangeParam = request.query.time_range;
        const timeRange = Array.isArray(timeRangeParam) ? timeRangeParam[0] : (timeRangeParam || '30d');
        const args = {
            time_range: timeRange,
        };
        const user = await resolveRequestUser(request, context);
        const result = await getScanStats(args, {
            user: user || undefined,
        });
        response.status(200).json(result);
    }
    catch (error) {
        sendOperationError('scan-operation', error, response);
    }
}
//# sourceMappingURL=handlers.js.map
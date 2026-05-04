import { getDashboardMetrics, getRecentScans, getSeverityBreakdown, getQuotaStatus, getTrendSeries, listScanSavedViews, createScanSavedView, updateScanSavedView, deleteScanSavedView, bulkCancelScans, bulkRerunScans, exportScans, } from './index';
import { resolveRequestUser } from '../../services/requestAuth';
import { sendOperationError } from '../../http/httpErrors';
import { parseJsonBodyWithLimit } from '../../http/requestGuards';
const allowedStatuses = new Set(['pending', 'scanning', 'done', 'error', 'cancelled']);
const allowedSortFields = new Set(['submitted', 'target', 'type', 'status', 'findings']);
const allowedSortDirections = new Set(['asc', 'desc']);
function normalizeTimeRange(value) {
    const raw = Array.isArray(value) ? value[0] : value;
    if (raw === '7d' || raw === '30d' || raw === 'all') {
        return raw;
    }
    return '30d';
}
function normalizeGranularity(value) {
    const raw = Array.isArray(value) ? value[0] : value;
    if (raw === 'day' || raw === 'week') {
        return raw;
    }
    return undefined;
}
function normalizeStatuses(value) {
    if (!value) {
        return [];
    }
    const raw = Array.isArray(value) ? value : [value];
    return Array.from(new Set(raw
        .flatMap((item) => item.split(','))
        .map((item) => item.trim())
        .filter((item) => allowedStatuses.has(item))));
}
function normalizeSort(value) {
    const raw = Array.isArray(value) ? value[0] : value;
    if (!raw) {
        return [{ field: 'submitted', direction: 'desc' }];
    }
    const parsed = raw
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
        .map((entry) => {
        const [fieldRaw, directionRaw] = entry.split(':');
        const field = fieldRaw?.trim();
        const direction = directionRaw?.trim();
        if (!field || !direction) {
            return null;
        }
        if (!allowedSortFields.has(field) || !allowedSortDirections.has(direction)) {
            return null;
        }
        return { field, direction };
    })
        .filter((value) => value !== null);
    return parsed.length > 0 ? parsed : [{ field: 'submitted', direction: 'desc' }];
}
export async function getDashboardMetricsApiHandler(request, response, context) {
    try {
        const timeRange = normalizeTimeRange(request.query.time_range);
        const user = await resolveRequestUser(request, context);
        const args = { time_range: timeRange };
        const result = await getDashboardMetrics(args, { user: user || undefined });
        response.status(200).json(result);
    }
    catch (error) {
        sendOperationError('dashboard-operation', error, response);
    }
}
export async function getRecentScansApiHandler(request, response, context) {
    try {
        const limitParam = request.query.limit;
        const statusParam = request.query.status;
        const searchParam = request.query.q;
        const sortParam = request.query.sort;
        const limit = limitParam ? parseInt(Array.isArray(limitParam) ? limitParam[0] : limitParam, 10) : 10;
        const user = await resolveRequestUser(request, context);
        const args = {
            limit: Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 50) : 10,
            status: normalizeStatuses(statusParam),
            sort: normalizeSort(sortParam),
            ...((Array.isArray(searchParam) ? searchParam[0] : searchParam)?.trim()
                ? { q: (Array.isArray(searchParam) ? searchParam[0] : searchParam)?.trim() }
                : {}),
        };
        const result = await getRecentScans(args, { user: user || undefined });
        response.status(200).json(result);
    }
    catch (error) {
        sendOperationError('dashboard-operation', error, response);
    }
}
export async function getSeverityBreakdownApiHandler(request, response, context) {
    try {
        const timeRange = normalizeTimeRange(request.query.time_range);
        const user = await resolveRequestUser(request, context);
        const args = { time_range: timeRange };
        const result = await getSeverityBreakdown(args, { user: user || undefined });
        response.status(200).json(result);
    }
    catch (error) {
        sendOperationError('dashboard-operation', error, response);
    }
}
export async function getQuotaStatusApiHandler(request, response, context) {
    try {
        const user = await resolveRequestUser(request, context);
        const result = await getQuotaStatus({}, { user: user || undefined });
        response.status(200).json(result);
    }
    catch (error) {
        sendOperationError('dashboard-operation', error, response);
    }
}
export async function getTrendSeriesApiHandler(request, response, context) {
    try {
        const timeRange = normalizeTimeRange(request.query.time_range);
        const granularity = normalizeGranularity(request.query.granularity);
        const user = await resolveRequestUser(request, context);
        const args = {
            time_range: timeRange,
            ...(granularity ? { granularity } : {}),
        };
        const result = await getTrendSeries(args, { user: user || undefined });
        response.status(200).json(result);
    }
    catch (error) {
        sendOperationError('dashboard-operation', error, response);
    }
}
export async function listScanSavedViewsApiHandler(request, response, context) {
    try {
        const user = await resolveRequestUser(request, context);
        const result = await listScanSavedViews({}, { user: user || undefined });
        response.status(200).json(result);
    }
    catch (error) {
        sendOperationError('dashboard-operation', error, response);
    }
}
export async function createScanSavedViewApiHandler(request, response, context) {
    try {
        const user = await resolveRequestUser(request, context);
        const body = parseJsonBodyWithLimit(request.body);
        const result = await createScanSavedView(body, { user: user || undefined });
        response.status(201).json(result);
    }
    catch (error) {
        sendOperationError('dashboard-operation', error, response);
    }
}
export async function updateScanSavedViewApiHandler(request, response, context) {
    try {
        const user = await resolveRequestUser(request, context);
        const body = parseJsonBodyWithLimit(request.body);
        const result = await updateScanSavedView({ ...body, viewId: String(request.params.viewId) }, { user: user || undefined });
        response.status(200).json(result);
    }
    catch (error) {
        sendOperationError('dashboard-operation', error, response);
    }
}
export async function deleteScanSavedViewApiHandler(request, response, context) {
    try {
        const user = await resolveRequestUser(request, context);
        const result = await deleteScanSavedView({ viewId: String(request.params.viewId) }, { user: user || undefined });
        response.status(200).json(result);
    }
    catch (error) {
        sendOperationError('dashboard-operation', error, response);
    }
}
export async function bulkCancelScansApiHandler(request, response, context) {
    try {
        const user = await resolveRequestUser(request, context);
        const body = parseJsonBodyWithLimit(request.body);
        const result = await bulkCancelScans(body, { user: user || undefined, entities: context.entities });
        response.status(200).json(result);
    }
    catch (error) {
        sendOperationError('dashboard-operation', error, response);
    }
}
export async function bulkRerunScansApiHandler(request, response, context) {
    try {
        const user = await resolveRequestUser(request, context);
        const body = parseJsonBodyWithLimit(request.body);
        const result = await bulkRerunScans(body, { user: user || undefined, entities: context.entities });
        response.status(200).json(result);
    }
    catch (error) {
        sendOperationError('dashboard-operation', error, response);
    }
}
export async function exportScansApiHandler(request, response, context) {
    try {
        const user = await resolveRequestUser(request, context);
        const body = parseJsonBodyWithLimit(request.body);
        const result = await exportScans(body, { user: user || undefined, entities: context.entities });
        response.status(200).json(result);
    }
    catch (error) {
        sendOperationError('dashboard-operation', error, response);
    }
}
//# sourceMappingURL=handlers.js.map
import type { Response } from 'express';
import {
  getDashboardMetrics,
  getRecentScans,
  getSeverityBreakdown,
  getQuotaStatus,
  getTrendSeries,
  listScanSavedViews,
  createScanSavedView,
  updateScanSavedView,
  deleteScanSavedView,
  bulkCancelScans,
  bulkRerunScans,
  exportScans,
  type GetDashboardMetricsInput,
  type GetRecentScansInput,
  type GetSeverityBreakdownInput,
  type GetTrendSeriesInput,
  type TrendGranularity,
} from './index';
import { resolveRequestUser } from '../../services/requestAuth';
import { sendOperationError } from '../../http/httpErrors';
import { parseJsonBodyWithLimit } from '../../http/requestGuards';
import type { HandlerContext, HandlerRequest } from '../../http/handlerTypes';

type DashboardTimeRange = '7d' | '30d' | 'all';
type DashboardScanStatus = 'pending' | 'scanning' | 'done' | 'error' | 'cancelled';
type DashboardSortField = 'submitted' | 'target' | 'type' | 'status' | 'findings';
type DashboardSortDirection = 'asc' | 'desc';

const allowedStatuses = new Set<DashboardScanStatus>(['pending', 'scanning', 'done', 'error', 'cancelled']);
const allowedSortFields = new Set<DashboardSortField>(['submitted', 'target', 'type', 'status', 'findings']);
const allowedSortDirections = new Set<DashboardSortDirection>(['asc', 'desc']);

function normalizeTimeRange(value: string | string[] | undefined): DashboardTimeRange {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === '7d' || raw === '30d' || raw === 'all') {
    return raw;
  }
  return '30d';
}

function normalizeGranularity(value: string | string[] | undefined): TrendGranularity | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === 'day' || raw === 'week') {
    return raw;
  }
  return undefined;
}

function normalizeStatuses(value: string | string[] | undefined): DashboardScanStatus[] {
  if (!value) {
    return [];
  }

  const raw = Array.isArray(value) ? value : [value];
  return Array.from(
    new Set(
      raw
        .flatMap((item) => item.split(','))
        .map((item) => item.trim())
        .filter((item): item is DashboardScanStatus => allowedStatuses.has(item as DashboardScanStatus)),
    ),
  );
}

function normalizeSort(
  value: string | string[] | undefined,
): Array<{ field: DashboardSortField; direction: DashboardSortDirection }> {
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
      const field = fieldRaw?.trim() as DashboardSortField | undefined;
      const direction = directionRaw?.trim() as DashboardSortDirection | undefined;
      if (!field || !direction) {
        return null;
      }
      if (!allowedSortFields.has(field) || !allowedSortDirections.has(direction)) {
        return null;
      }
      return { field, direction };
    })
    .filter((value): value is { field: DashboardSortField; direction: DashboardSortDirection } => value !== null);

  return parsed.length > 0 ? parsed : [{ field: 'submitted', direction: 'desc' }];
}

export async function getDashboardMetricsApiHandler(
  request: HandlerRequest,
  response: Response,
  context: any
) {
  try {
    const timeRange = normalizeTimeRange(request.query.time_range as string | string[] | undefined);
    const user = await resolveRequestUser(request, context);
    const args: GetDashboardMetricsInput = { time_range: timeRange };
    const result = await getDashboardMetrics(args, { user: user || undefined });
    response.status(200).json(result);
  } catch (error) {
    sendOperationError('dashboard-operation', error, response);
  }
}

export async function getRecentScansApiHandler(
  request: HandlerRequest,
  response: Response,
  context: any
) {
  try {
    const limitParam = request.query.limit as string | string[] | undefined;
    const statusParam = request.query.status as string | string[] | undefined;
    const searchParam = request.query.q as string | string[] | undefined;
    const sortParam = request.query.sort as string | string[] | undefined;

    const limit = limitParam ? parseInt(Array.isArray(limitParam) ? limitParam[0] : limitParam, 10) : 10;
    const user = await resolveRequestUser(request, context);
    const args: GetRecentScansInput = {
      limit: Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 50) : 10,
      status: normalizeStatuses(statusParam),
      sort: normalizeSort(sortParam),
      ...((Array.isArray(searchParam) ? searchParam[0] : searchParam)?.trim()
        ? { q: (Array.isArray(searchParam) ? searchParam[0] : searchParam)?.trim() }
        : {}),
    };
    const result = await getRecentScans(args, { user: user || undefined });
    response.status(200).json(result);
  } catch (error) {
    sendOperationError('dashboard-operation', error, response);
  }
}

export async function getSeverityBreakdownApiHandler(
  request: HandlerRequest,
  response: Response,
  context: any
) {
  try {
    const timeRange = normalizeTimeRange(request.query.time_range as string | string[] | undefined);
    const user = await resolveRequestUser(request, context);
    const args: GetSeverityBreakdownInput = { time_range: timeRange };
    const result = await getSeverityBreakdown(args, { user: user || undefined });
    response.status(200).json(result);
  } catch (error) {
    sendOperationError('dashboard-operation', error, response);
  }
}

export async function getQuotaStatusApiHandler(
  request: HandlerRequest,
  response: Response,
  context: any
) {
  try {
    const user = await resolveRequestUser(request, context);
    const result = await getQuotaStatus({}, { user: user || undefined });
    response.status(200).json(result);
  } catch (error) {
    sendOperationError('dashboard-operation', error, response);
  }
}

export async function getTrendSeriesApiHandler(
  request: HandlerRequest,
  response: Response,
  context: any
) {
  try {
    const timeRange = normalizeTimeRange(request.query.time_range as string | string[] | undefined);
    const granularity = normalizeGranularity(request.query.granularity as string | string[] | undefined);
    const user = await resolveRequestUser(request, context);
    const args: GetTrendSeriesInput = {
      time_range: timeRange,
      ...(granularity ? { granularity } : {}),
    };
    const result = await getTrendSeries(args, { user: user || undefined });
    response.status(200).json(result);
  } catch (error) {
    sendOperationError('dashboard-operation', error, response);
  }
}

export async function listScanSavedViewsApiHandler(
  request: HandlerRequest,
  response: Response,
  context: any,
) {
  try {
    const user = await resolveRequestUser(request, context);
    const result = await listScanSavedViews({}, { user: user || undefined });
    response.status(200).json(result);
  } catch (error) {
    sendOperationError('dashboard-operation', error, response);
  }
}

export async function createScanSavedViewApiHandler(
  request: HandlerRequest,
  response: Response,
  context: any,
) {
  try {
    const user = await resolveRequestUser(request, context);
    const body = parseJsonBodyWithLimit<Record<string, unknown>>(request.body);
    const result = await createScanSavedView(body, { user: user || undefined });
    response.status(201).json(result);
  } catch (error) {
    sendOperationError('dashboard-operation', error, response);
  }
}

export async function updateScanSavedViewApiHandler(
  request: HandlerRequest,
  response: Response,
  context: any,
) {
  try {
    const user = await resolveRequestUser(request, context);
    const body = parseJsonBodyWithLimit<Record<string, unknown>>(request.body);
    const result = await updateScanSavedView(
      { ...body, viewId: String(request.params.viewId) },
      { user: user || undefined },
    );
    response.status(200).json(result);
  } catch (error) {
    sendOperationError('dashboard-operation', error, response);
  }
}

export async function deleteScanSavedViewApiHandler(
  request: HandlerRequest,
  response: Response,
  context: any,
) {
  try {
    const user = await resolveRequestUser(request, context);
    const result = await deleteScanSavedView(
      { viewId: String(request.params.viewId) },
      { user: user || undefined },
    );
    response.status(200).json(result);
  } catch (error) {
    sendOperationError('dashboard-operation', error, response);
  }
}

export async function bulkCancelScansApiHandler(
  request: HandlerRequest,
  response: Response,
  context: any,
) {
  try {
    const user = await resolveRequestUser(request, context);
    const body = parseJsonBodyWithLimit<Record<string, unknown>>(request.body);
    const result = await bulkCancelScans(body, { user: user || undefined, entities: context.entities as any });
    response.status(200).json(result);
  } catch (error) {
    sendOperationError('dashboard-operation', error, response);
  }
}

export async function bulkRerunScansApiHandler(
  request: HandlerRequest,
  response: Response,
  context: any,
) {
  try {
    const user = await resolveRequestUser(request, context);
    const body = parseJsonBodyWithLimit<Record<string, unknown>>(request.body);
    const result = await bulkRerunScans(body, { user: user || undefined, entities: context.entities as any });
    response.status(200).json(result);
  } catch (error) {
    sendOperationError('dashboard-operation', error, response);
  }
}

export async function exportScansApiHandler(
  request: HandlerRequest,
  response: Response,
  context: any,
) {
  try {
    const user = await resolveRequestUser(request, context);
    const body = parseJsonBodyWithLimit<Record<string, unknown>>(request.body);
    const result = await exportScans(body, { user: user || undefined, entities: context.entities as any });
    response.status(200).json(result);
  } catch (error) {
    sendOperationError('dashboard-operation', error, response);
  }
}

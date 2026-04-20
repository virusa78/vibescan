import type { Request, Response } from 'express';
import {
  getDashboardMetrics,
  getRecentScans,
  getSeverityBreakdown,
  getQuotaStatus,
  type GetDashboardMetricsInput,
  type GetRecentScansInput,
  type GetSeverityBreakdownInput,
} from './index';
import { resolveRequestUser } from '../../services/requestAuth';
import { sendOperationError } from '../../http/httpErrors';

type OperationContext = {
  entities: Record<string, unknown>;
};

type DashboardTimeRange = '7d' | '30d' | 'all';

function normalizeTimeRange(value: string | string[] | undefined): DashboardTimeRange {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === '7d' || raw === '30d' || raw === 'all') {
    return raw;
  }
  return '30d';
}

export async function getDashboardMetricsApiHandler(
  request: Request,
  response: Response,
  context: OperationContext
) {
  try {
    const timeRange = normalizeTimeRange(request.query.time_range as string | string[] | undefined);
    const user = await resolveRequestUser(request as any, context);
    const args: GetDashboardMetricsInput = { time_range: timeRange };
    const result = await getDashboardMetrics(args, { user, entities: context.entities });
    response.status(200).json(result);
  } catch (error) {
    sendOperationError('dashboard-operation', error, response);
  }
}

export async function getRecentScansApiHandler(
  request: Request,
  response: Response,
  context: OperationContext
) {
  try {
    const limitParam = request.query.limit as string | string[] | undefined;
    const limit = limitParam ? parseInt(Array.isArray(limitParam) ? limitParam[0] : limitParam) : 10;
    const user = await resolveRequestUser(request as any, context);
    const args: GetRecentScansInput = { limit: Math.min(Math.max(limit, 1), 20) };
    const result = await getRecentScans(args, { user, entities: context.entities });
    response.status(200).json(result);
  } catch (error) {
    sendOperationError('dashboard-operation', error, response);
  }
}

export async function getSeverityBreakdownApiHandler(
  request: Request,
  response: Response,
  context: OperationContext
) {
  try {
    const timeRange = normalizeTimeRange(request.query.time_range as string | string[] | undefined);
    const user = await resolveRequestUser(request as any, context);
    const args: GetSeverityBreakdownInput = { time_range: timeRange };
    const result = await getSeverityBreakdown(args, { user, entities: context.entities });
    response.status(200).json(result);
  } catch (error) {
    sendOperationError('dashboard-operation', error, response);
  }
}

export async function getQuotaStatusApiHandler(
  request: Request,
  response: Response,
  context: OperationContext
) {
  try {
    const user = await resolveRequestUser(request as any, context);
    const result = await getQuotaStatus({}, { user, entities: context.entities });
    response.status(200).json(result);
  } catch (error) {
    sendOperationError('dashboard-operation', error, response);
  }
}

import { HttpError } from 'wasp/server';
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

type AuthenticatedRequest = Request & {
  user?: {
    id: string;
  } | null;
};

type OperationContext = {
  entities: Record<string, unknown>;
};

type HttpErrorWithData = Error & {
  statusCode?: number;
  data?: {
    error?: string;
  };
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

    const args: GetDashboardMetricsInput = {
      time_range: timeRange,
    };

    const authRequest = request as AuthenticatedRequest;
    const result = await getDashboardMetrics(args, {
      user: authRequest.user,
      entities: context.entities,
    });

    response.status(200).json(result);
  } catch (error) {
    handleOperationError(error, response);
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

    const args: GetRecentScansInput = {
      limit: Math.min(Math.max(limit, 1), 20), // Clamp between 1-20
    };

    const authRequest = request as AuthenticatedRequest;
    const result = await getRecentScans(args, {
      user: authRequest.user,
      entities: context.entities,
    });

    response.status(200).json(result);
  } catch (error) {
    handleOperationError(error, response);
  }
}

export async function getSeverityBreakdownApiHandler(
  request: Request,
  response: Response,
  context: OperationContext
) {
  try {
    const timeRange = normalizeTimeRange(request.query.time_range as string | string[] | undefined);

    const args: GetSeverityBreakdownInput = {
      time_range: timeRange,
    };

    const authRequest = request as AuthenticatedRequest;
    const result = await getSeverityBreakdown(args, {
      user: authRequest.user,
      entities: context.entities,
    });

    response.status(200).json(result);
  } catch (error) {
    handleOperationError(error, response);
  }
}

export async function getQuotaStatusApiHandler(
  request: Request,
  response: Response,
  context: OperationContext
) {
  try {
    const authRequest = request as AuthenticatedRequest;
    const result = await getQuotaStatus({}, {
      user: authRequest.user,
      entities: context.entities,
    });

    response.status(200).json(result);
  } catch (error) {
    handleOperationError(error, response);
  }
}

function handleOperationError(error: unknown, response: Response) {
  if (error instanceof HttpError) {
    const statusCode = error.statusCode || 500;
    const message = error.message || 'Internal server error';
    const data = (error as HttpErrorWithData).data;

    response.status(statusCode).json({
      error: data?.error || getErrorCode(statusCode),
      message,
      ...(data && { details: data }),
    });
    return;
  }

  if (error instanceof SyntaxError) {
    response.status(400).json({
      error: 'validation_error',
      message: 'Invalid JSON in request body',
    });
    return;
  }

  console.error('Unexpected error in dashboard operation:', error);
  response.status(500).json({
    error: 'internal_error',
    message: 'An unexpected error occurred',
  });
}

function getErrorCode(statusCode: number): string {
  switch (statusCode) {
    case 400:
      return 'bad_request';
    case 401:
      return 'unauthorized';
    case 403:
      return 'forbidden';
    case 404:
      return 'not_found';
    case 429:
      return 'too_many_requests';
    default:
      return 'internal_error';
  }
}

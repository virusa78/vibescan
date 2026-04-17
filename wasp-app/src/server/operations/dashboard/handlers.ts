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

export async function getDashboardMetricsApiHandler(
  request: Request,
  response: Response,
  context: any
) {
  try {
    const timeRangeParam = request.query.time_range as string | string[] | undefined;
    const timeRange = Array.isArray(timeRangeParam) ? timeRangeParam[0] : (timeRangeParam || '30d');

    const args: GetDashboardMetricsInput = {
      time_range: timeRange as any,
    };

    const result = await getDashboardMetrics(args, {
      user: (request as any).user,
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
  context: any
) {
  try {
    const limitParam = request.query.limit as string | string[] | undefined;
    const limit = limitParam ? parseInt(Array.isArray(limitParam) ? limitParam[0] : limitParam) : 10;

    const args: GetRecentScansInput = {
      limit: Math.min(Math.max(limit, 1), 20), // Clamp between 1-20
    };

    const result = await getRecentScans(args, {
      user: (request as any).user,
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
  context: any
) {
  try {
    const timeRangeParam = request.query.time_range as string | string[] | undefined;
    const timeRange = Array.isArray(timeRangeParam) ? timeRangeParam[0] : (timeRangeParam || '30d');

    const args: GetSeverityBreakdownInput = {
      time_range: timeRange as any,
    };

    const result = await getSeverityBreakdown(args, {
      user: (request as any).user,
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
  context: any
) {
  try {
    const result = await getQuotaStatus({}, {
      user: (request as any).user,
      entities: context.entities,
    });

    response.status(200).json(result);
  } catch (error) {
    handleOperationError(error, response);
  }
}

function handleOperationError(error: any, response: Response) {
  if (error instanceof HttpError) {
    const statusCode = error.statusCode || 500;
    const message = error.message || 'Internal server error';
    const data = (error as any).data;

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

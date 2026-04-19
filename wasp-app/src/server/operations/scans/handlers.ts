import { HttpError } from 'wasp/server';
import type { Request, Response } from 'express';
import {
  submitScan,
  listScans,
  getScan,
  cancelScan,
  getScanStats,
  type SubmitScanInput,
  type ListScansInput,
  type GetScanInput,
  type CancelScanInput,
  type GetScanStatsInput,
} from './index';

type AuthenticatedRequest = Request & {
  user?: {
    id: string;
  } | null;
};

type OperationContext = {
  user?: {
    id: string;
  } | null;
  entities: Record<string, unknown>;
};

type HttpErrorWithData = Error & {
  statusCode?: number;
  data?: {
    error?: string;
  };
};

export async function submitScanApiHandler(request: Request, response: Response, context: OperationContext) {
  try {
    let body: unknown = {};
    if (request.body) {
      body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
    }

    const authRequest = request as AuthenticatedRequest;
    const result = await submitScan(body as SubmitScanInput, {
      user: authRequest.user,
      entities: context.entities,
    });

    response.status(201).json(result);
  } catch (error) {
    handleOperationError(error, response);
  }
}

export async function listScansApiHandler(request: Request, response: Response, context: OperationContext) {
  try {
    const limitParam = request.query.limit as string | string[] | undefined;
    const offsetParam = request.query.offset as string | string[] | undefined;
    const statusParam = request.query.status as string | string[] | undefined;
    const createdFromParam = request.query.created_from as string | string[] | undefined;
    const createdToParam = request.query.created_to as string | string[] | undefined;

    const limit = limitParam ? parseInt(Array.isArray(limitParam) ? limitParam[0] : limitParam) : 25;
    const offset = offsetParam ? parseInt(Array.isArray(offsetParam) ? offsetParam[0] : offsetParam) : 0;
    const status = Array.isArray(statusParam) ? statusParam[0] : statusParam;
    const createdFrom = Array.isArray(createdFromParam) ? createdFromParam[0] : createdFromParam;
    const createdTo = Array.isArray(createdToParam) ? createdToParam[0] : createdToParam;

    const args: ListScansInput = {
      limit,
      offset,
      status,
      created_from: createdFrom,
      created_to: createdTo,
    };

    const authRequest = request as AuthenticatedRequest;
    const result = await listScans(args, {
      user: authRequest.user,
      entities: context.entities,
    });

    response.status(200).json(result);
  } catch (error) {
    handleOperationError(error, response);
  }
}

export async function getScanApiHandler(request: Request, response: Response, context: OperationContext) {
  try {
    const args: GetScanInput = {
      scan_id: String(request.params.scanId),
    };

    const authRequest = request as AuthenticatedRequest;
    const result = await getScan(args, {
      user: authRequest.user,
      entities: context.entities,
    });

    response.status(200).json(result);
  } catch (error) {
    handleOperationError(error, response);
  }
}

export async function cancelScanApiHandler(request: Request, response: Response, context: OperationContext) {
  try {
    const args: CancelScanInput = {
      scan_id: String(request.params.scanId),
    };

    const authRequest = request as AuthenticatedRequest;
    const result = await cancelScan(args, {
      user: authRequest.user,
      entities: context.entities,
    });

    response.status(200).json(result);
  } catch (error) {
    handleOperationError(error, response);
  }
}

export async function getScanStatsApiHandler(request: Request, response: Response, context: OperationContext) {
  try {
    const timeRangeParam = request.query.time_range as string | string[] | undefined;
    const timeRange = Array.isArray(timeRangeParam) ? timeRangeParam[0] : (timeRangeParam || '30d');

    const args: GetScanStatsInput = {
      time_range: timeRange,
    };

    const authRequest = request as AuthenticatedRequest;
    const result = await getScanStats(args, {
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

  console.error('Unexpected error in scan operation:', error);
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

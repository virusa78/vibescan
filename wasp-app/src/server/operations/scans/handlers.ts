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

export async function submitScanApiHandler(request: Request, response: Response, context: any) {
  try {
    let body: any = {};
    if (request.body) {
      body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
    }

    const result = await submitScan(body as SubmitScanInput, {
      user: (request as any).user,
      entities: context.entities,
    });

    response.status(201).json(result);
  } catch (error) {
    handleOperationError(error, response);
  }
}

export async function listScansApiHandler(request: Request, response: Response, context: any) {
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
      status: status as any,
      created_from: createdFrom,
      created_to: createdTo,
    };

    const result = await listScans(args, {
      user: (request as any).user,
      entities: context.entities,
    });

    response.status(200).json(result);
  } catch (error) {
    handleOperationError(error, response);
  }
}

export async function getScanApiHandler(request: Request, response: Response, context: any) {
  try {
    const args: GetScanInput = {
      scan_id: String(request.params.scanId),
    };

    const result = await getScan(args, {
      user: (request as any).user,
      entities: context.entities,
    });

    response.status(200).json(result);
  } catch (error) {
    handleOperationError(error, response);
  }
}

export async function cancelScanApiHandler(request: Request, response: Response, context: any) {
  try {
    const args: CancelScanInput = {
      scan_id: String(request.params.scanId),
    };

    const result = await cancelScan(args, {
      user: (request as any).user,
      entities: context.entities,
    });

    response.status(200).json(result);
  } catch (error) {
    handleOperationError(error, response);
  }
}

export async function getScanStatsApiHandler(request: Request, response: Response, context: any) {
  try {
    const timeRangeParam = request.query.time_range as string | string[] | undefined;
    const timeRange = Array.isArray(timeRangeParam) ? timeRangeParam[0] : (timeRangeParam || '30d');

    const args: GetScanStatsInput = {
      time_range: timeRange as any,
    };

    const result = await getScanStats(args, {
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

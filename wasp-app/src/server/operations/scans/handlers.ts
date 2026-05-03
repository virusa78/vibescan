import type { Response } from 'express';
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
import { resolveRequestUser } from '../../services/requestAuth';
import { enforceRateLimit, getRateLimitKey, parseJsonBodyWithLimit } from '../../http/requestGuards';
import { sendOperationError } from '../../http/httpErrors';
import type { HandlerContext, HandlerRequest } from '../../http/handlerTypes';

export async function submitScanApiHandler(request: HandlerRequest, response: Response, context: any) {
  try {
    let body: unknown = {};
    body = parseJsonBodyWithLimit(request.body);

    const user = await resolveRequestUser(request, context);
    await enforceRateLimit({
      key: getRateLimitKey('scan-submit', user?.id || request.ip || 'anonymous'),
      limit: 20,
      windowSeconds: 60,
    });
    const result = await submitScan(body as SubmitScanInput, {
      user: user || undefined,
    });

    response.status(201).json(result);
  } catch (error) {
    sendOperationError('scan-operation', error, response);
  }
}

export async function listScansApiHandler(request: HandlerRequest, response: Response, context: any) {
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

    const user = await resolveRequestUser(request, context);
    const result = await listScans(args, {
      user: user || undefined,
    });

    response.status(200).json(result);
  } catch (error) {
    sendOperationError('scan-operation', error, response);
  }
}

export async function getScanApiHandler(request: HandlerRequest, response: Response, context: any) {
  try {
    const args: GetScanInput = {
      scan_id: String(request.params.scanId),
    };

    const user = await resolveRequestUser(request, context);
    const result = await getScan(args, {
      user: user || undefined,
    });

    response.status(200).json(result);
  } catch (error) {
    sendOperationError('scan-operation', error, response);
  }
}

export async function cancelScanApiHandler(request: HandlerRequest, response: Response, context: any) {
  try {
    const args: CancelScanInput = {
      scan_id: String(request.params.scanId),
    };

    const user = await resolveRequestUser(request, context);
    const result = await cancelScan(args, {
      user: user || undefined,
    });

    response.status(200).json(result);
  } catch (error) {
    sendOperationError('scan-operation', error, response);
  }
}

export async function getScanStatsApiHandler(request: HandlerRequest, response: Response, context: any) {
  try {
    const timeRangeParam = request.query.time_range as string | string[] | undefined;
    const timeRange = Array.isArray(timeRangeParam) ? timeRangeParam[0] : (timeRangeParam || '30d');

    const args: GetScanStatsInput = {
      time_range: timeRange,
    };

    const user = await resolveRequestUser(request, context);
    const result = await getScanStats(args, {
      user: user || undefined,
    });

    response.status(200).json(result);
  } catch (error) {
    sendOperationError('scan-operation', error, response);
  }
}

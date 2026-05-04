import type { Response } from 'express';
import { getBillingAccount, getBillingEntitlements, listBillingEvents } from './index';
import { resolveRequestUser } from '../../services/requestAuth';
import { sendOperationError } from '../../http/httpErrors';
import type { HandlerRequest } from '../../http/handlerTypes';

export async function getBillingAccountApiHandler(request: HandlerRequest, response: Response, context: any) {
  try {
    const result = await getBillingAccount(
      {},
      { user: (await resolveRequestUser(request, context)) || undefined, entities: context.entities },
    );
    response.status(200).json(result);
  } catch (error) {
    sendOperationError('billing-operation', error, response);
  }
}

export async function listBillingEventsApiHandler(request: HandlerRequest, response: Response, context: any) {
  try {
    const limitParam = request.query.limit as string | string[] | undefined;
    const limit = limitParam ? parseInt(Array.isArray(limitParam) ? limitParam[0] : limitParam, 10) : undefined;

    const result = await listBillingEvents(
      { limit },
      { user: (await resolveRequestUser(request, context)) || undefined, entities: context.entities },
    );
    response.status(200).json(result);
  } catch (error) {
    sendOperationError('billing-operation', error, response);
  }
}

export async function getBillingEntitlementsApiHandler(request: HandlerRequest, response: Response, context: any) {
  try {
    const result = await getBillingEntitlements(
      {},
      { user: (await resolveRequestUser(request, context)) || undefined, entities: context.entities },
    );
    response.status(200).json(result);
  } catch (error) {
    sendOperationError('billing-operation', error, response);
  }
}

import type { Response } from 'express';
import {
  createEventSubscription,
  getEventDelivery,
  listEventDeliveries,
  listEventSubscriptions,
  retryEventDelivery,
} from './index';
import { resolveRequestUser } from '../../services/requestAuth';
import { parseJsonBodyWithLimit } from '../../http/requestGuards';
import { sendOperationError } from '../../http/httpErrors';
import type { HandlerRequest } from '../../http/handlerTypes';

export async function listEventSubscriptionsApiHandler(
  request: HandlerRequest,
  response: Response,
  context: any,
) {
  try {
    const result = await listEventSubscriptions(
      {},
      { user: (await resolveRequestUser(request, context)) || undefined, entities: context.entities },
    );
    response.status(200).json(result);
  } catch (error) {
    sendOperationError('event-operation', error, response);
  }
}

export async function createEventSubscriptionApiHandler(
  request: HandlerRequest,
  response: Response,
  context: any,
) {
  try {
    const body = parseJsonBodyWithLimit<Record<string, unknown>>(request.body);
    const result = await createEventSubscription(
      body,
      { user: (await resolveRequestUser(request, context)) || undefined, entities: context.entities },
    );
    response.status(201).json(result);
  } catch (error) {
    sendOperationError('event-operation', error, response);
  }
}

export async function listEventDeliveriesApiHandler(
  request: HandlerRequest,
  response: Response,
  context: any,
) {
  try {
    const limitParam = request.query.limit as string | string[] | undefined;
    const statusParam = request.query.status as string | string[] | undefined;
    const result = await listEventDeliveries(
      {
        limit: limitParam ? parseInt(Array.isArray(limitParam) ? limitParam[0] : limitParam, 10) : undefined,
        status: Array.isArray(statusParam) ? statusParam[0] : statusParam,
      },
      { user: (await resolveRequestUser(request, context)) || undefined, entities: context.entities },
    );
    response.status(200).json(result);
  } catch (error) {
    sendOperationError('event-operation', error, response);
  }
}

export async function getEventDeliveryApiHandler(
  request: HandlerRequest,
  response: Response,
  context: any,
) {
  try {
    const result = await getEventDelivery(
      { deliveryId: String(request.params.deliveryId) },
      { user: (await resolveRequestUser(request, context)) || undefined, entities: context.entities },
    );
    response.status(200).json(result);
  } catch (error) {
    sendOperationError('event-operation', error, response);
  }
}

export async function retryEventDeliveryApiHandler(
  request: HandlerRequest,
  response: Response,
  context: any,
) {
  try {
    const result = await retryEventDelivery(
      { deliveryId: String(request.params.deliveryId) },
      { user: (await resolveRequestUser(request, context)) || undefined, entities: context.entities },
    );
    response.status(200).json(result);
  } catch (error) {
    sendOperationError('event-operation', error, response);
  }
}

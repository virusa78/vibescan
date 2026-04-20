import type { Response } from 'express';
import { createWebhook, listWebhooks, getWebhook, updateWebhook, deleteWebhook } from './index';
import { resolveRequestUser } from '../../services/requestAuth';
import { parseJsonBodyWithLimit, enforceRateLimit, getRateLimitKey } from '../../http/requestGuards';
import { sendOperationError } from '../../http/httpErrors';
import type { HandlerContext, HandlerRequest } from '../../http/handlerTypes';

export async function createWebhookApiHandler(request: HandlerRequest, response: Response, context: HandlerContext) {
  try {
    const body = parseJsonBodyWithLimit<Record<string, unknown>>(request.body);
    const user = await resolveRequestUser(request, context);
    await enforceRateLimit({
      key: getRateLimitKey('webhook-create', user?.id || request.ip || 'anonymous'),
      limit: 20,
      windowSeconds: 60,
    });

    const result = await createWebhook(body, {
      user,
      entities: context.entities,
    });

    response.status(201).json(result);
  } catch (error) {
    sendOperationError('webhook-operation', error, response);
  }
}

export async function listWebhooksApiHandler(_request: HandlerRequest, response: Response, context: HandlerContext) {
  try {
    const result = await listWebhooks(undefined, {
      user: await resolveRequestUser(_request, context),
      entities: context.entities,
    });

    response.status(200).json(result);
  } catch (error) {
    sendOperationError('webhook-operation', error, response);
  }
}

export async function getWebhookApiHandler(request: HandlerRequest, response: Response, context: HandlerContext) {
  try {
    const result = await getWebhook(
      { webhookId: String(request.params.webhookId) },
      {
        user: await resolveRequestUser(request, context),
        entities: context.entities,
      },
    );

    response.status(200).json(result);
  } catch (error) {
    sendOperationError('webhook-operation', error, response);
  }
}

export async function updateWebhookApiHandler(request: HandlerRequest, response: Response, context: HandlerContext) {
  try {
    const body = parseJsonBodyWithLimit<Record<string, unknown>>(request.body);
    const user = await resolveRequestUser(request, context);
    await enforceRateLimit({
      key: getRateLimitKey('webhook-update', user?.id || request.ip || 'anonymous'),
      limit: 30,
      windowSeconds: 60,
    });

    const result = await updateWebhook(
      {
        webhookId: String(request.params.webhookId),
        ...body,
      },
      {
        user,
        entities: context.entities,
      },
    );

    response.status(200).json(result);
  } catch (error) {
    sendOperationError('webhook-operation', error, response);
  }
}

export async function deleteWebhookApiHandler(request: HandlerRequest, response: Response, context: HandlerContext) {
  try {
    const user = await resolveRequestUser(request, context);
    await enforceRateLimit({
      key: getRateLimitKey('webhook-delete', user?.id || request.ip || 'anonymous'),
      limit: 20,
      windowSeconds: 60,
    });

    const result = await deleteWebhook(
      { webhookId: String(request.params.webhookId) },
      {
        user,
        entities: context.entities,
      },
    );

    response.status(200).json(result);
  } catch (error) {
    sendOperationError('webhook-operation', error, response);
  }
}

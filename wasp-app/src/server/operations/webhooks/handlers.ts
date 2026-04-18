import { HttpError } from 'wasp/server';
import type { Request, Response } from 'express';
import { createWebhook, listWebhooks, getWebhook, updateWebhook, deleteWebhook } from './index';

export async function createWebhookApiHandler(request: Request, response: Response, context: any) {
  try {
    let body: Record<string, unknown> = {};
    if (request.body) {
      body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
    }

    const result = await createWebhook(body, {
      user: (request as any).user,
      entities: context.entities,
    });

    response.status(201).json(result);
  } catch (error) {
    handleOperationError(error, response);
  }
}

export async function listWebhooksApiHandler(_request: Request, response: Response, context: any) {
  try {
    const result = await listWebhooks(undefined, {
      user: (_request as any).user,
      entities: context.entities,
    });

    response.status(200).json(result);
  } catch (error) {
    handleOperationError(error, response);
  }
}

export async function getWebhookApiHandler(request: Request, response: Response, context: any) {
  try {
    const result = await getWebhook(
      { webhookId: String(request.params.webhookId) },
      {
        user: (request as any).user,
        entities: context.entities,
      },
    );

    response.status(200).json(result);
  } catch (error) {
    handleOperationError(error, response);
  }
}

export async function updateWebhookApiHandler(request: Request, response: Response, context: any) {
  try {
    let body: Record<string, unknown> = {};
    if (request.body) {
      body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
    }

    const result = await updateWebhook(
      {
        webhookId: String(request.params.webhookId),
        ...body,
      },
      {
        user: (request as any).user,
        entities: context.entities,
      },
    );

    response.status(200).json(result);
  } catch (error) {
    handleOperationError(error, response);
  }
}

export async function deleteWebhookApiHandler(request: Request, response: Response, context: any) {
  try {
    const result = await deleteWebhook(
      { webhookId: String(request.params.webhookId) },
      {
        user: (request as any).user,
        entities: context.entities,
      },
    );

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

  console.error('Unexpected error in webhook operation:', error);
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

import { HttpError } from 'wasp/server';
import type { Request, Response } from 'express';
import {
  getProfileSettings,
  updateProfileSettings,
  getNotificationSettings,
  updateNotificationSettings,
  type UpdateProfileSettingsInput,
  type UpdateNotificationSettingsInput,
} from './index';

function handleOperationError(error: any, response: Response) {
  if (error instanceof HttpError) {
    response.status(error.statusCode).json({ error: error.message });
  } else {
    response.status(500).json({ error: 'Internal server error' });
  }
}

export async function getProfileSettingsApiHandler(
  request: Request,
  response: Response,
  context: any
) {
  try {
    const result = await getProfileSettings(
      {},
      {
        user: (request as any).user,
        entities: context.entities,
      }
    );

    response.status(200).json(result);
  } catch (error) {
    handleOperationError(error, response);
  }
}

export async function updateProfileSettingsApiHandler(
  request: Request,
  response: Response,
  context: any
) {
  try {
    let body: any = {};
    if (request.body) {
      body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
    }

    const result = await updateProfileSettings(body as UpdateProfileSettingsInput, {
      user: (request as any).user,
      entities: context.entities,
    });

    response.status(200).json(result);
  } catch (error) {
    handleOperationError(error, response);
  }
}

export async function getNotificationSettingsApiHandler(
  request: Request,
  response: Response,
  context: any
) {
  try {
    const result = await getNotificationSettings(
      {},
      {
        user: (request as any).user,
        entities: context.entities,
      }
    );

    response.status(200).json(result);
  } catch (error) {
    handleOperationError(error, response);
  }
}

export async function updateNotificationSettingsApiHandler(
  request: Request,
  response: Response,
  context: any
) {
  try {
    let body: any = {};
    if (request.body) {
      body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
    }

    const result = await updateNotificationSettings(
      body as UpdateNotificationSettingsInput,
      {
        user: (request as any).user,
        entities: context.entities,
      }
    );

    response.status(200).json(result);
  } catch (error) {
    handleOperationError(error, response);
  }
}

import type { Request, Response } from 'express';
import {
  getProfileSettings,
  updateProfileSettings,
  getNotificationSettings,
  updateNotificationSettings,
  type UpdateProfileSettingsInput,
  type UpdateNotificationSettingsInput,
} from './index';
import { resolveRequestUser } from '../../services/requestAuth';
import { parseJsonBodyWithLimit, enforceRateLimit, getRateLimitKey } from '../../http/requestGuards';
import { sendOperationError } from '../../http/httpErrors';

export async function getProfileSettingsApiHandler(
  request: Request,
  response: Response,
  context: any
) {
  try {
    const result = await getProfileSettings(
      {},
      {
        user: await resolveRequestUser(request as any, context),
        entities: context.entities,
      }
    );

    response.status(200).json(result);
  } catch (error) {
    sendOperationError('settings-operation', error, response);
  }
}

export async function updateProfileSettingsApiHandler(
  request: Request,
  response: Response,
  context: any
) {
  try {
    const body = parseJsonBodyWithLimit<Record<string, unknown>>(request.body);
    const user = await resolveRequestUser(request as any, context);
    await enforceRateLimit({
      key: getRateLimitKey('settings-profile', user?.id || request.ip || 'anonymous'),
      limit: 20,
      windowSeconds: 60,
    });

    const result = await updateProfileSettings(body as UpdateProfileSettingsInput, {
      user,
      entities: context.entities,
    });

    response.status(200).json(result);
  } catch (error) {
    sendOperationError('settings-operation', error, response);
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
        user: await resolveRequestUser(request as any, context),
        entities: context.entities,
      }
    );

    response.status(200).json(result);
  } catch (error) {
    sendOperationError('settings-operation', error, response);
  }
}

export async function updateNotificationSettingsApiHandler(
  request: Request,
  response: Response,
  context: any
) {
  try {
    const body = parseJsonBodyWithLimit<Record<string, unknown>>(request.body);
    const user = await resolveRequestUser(request as any, context);
    await enforceRateLimit({
      key: getRateLimitKey('settings-notifications', user?.id || request.ip || 'anonymous'),
      limit: 20,
      windowSeconds: 60,
    });

    const result = await updateNotificationSettings(
      body as UpdateNotificationSettingsInput,
      {
        user,
        entities: context.entities,
      }
    );

    response.status(200).json(result);
  } catch (error) {
    sendOperationError('settings-operation', error, response);
  }
}

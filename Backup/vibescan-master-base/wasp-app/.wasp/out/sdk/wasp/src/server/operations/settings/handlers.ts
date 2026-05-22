import type { Response } from 'express';
import {
  getProfileSettings,
  updateProfileSettings,
  getNotificationSettings,
  updateNotificationSettings,
  getScannerAccessSettings,
  updateScannerAccessSettings,
  type UpdateProfileSettingsInput,
  type UpdateNotificationSettingsInput,
  type UpdateScannerAccessSettingsInput,
} from './index';
import { resolveRequestUser } from '../../services/requestAuth';
import { parseJsonBodyWithLimit, enforceRateLimit, getRateLimitKey } from '../../http/requestGuards';
import { sendOperationError } from '../../http/httpErrors';
import type { HandlerContext, HandlerRequest } from '../../http/handlerTypes';

export async function getProfileSettingsApiHandler(
  request: HandlerRequest,
  response: Response,
  context: any
) {
  try {
    const result = await getProfileSettings(
      {},
      {
        user: (await resolveRequestUser(request, context)) || undefined,
      }
    );

    response.status(200).json(result);
  } catch (error) {
    sendOperationError('settings-operation', error, response);
  }
}

export async function updateProfileSettingsApiHandler(
  request: HandlerRequest,
  response: Response,
  context: any
) {
  try {
    const body = parseJsonBodyWithLimit<Record<string, unknown>>(request.body);
    const user = await resolveRequestUser(request, context);
    await enforceRateLimit({
      key: getRateLimitKey('settings-profile', user?.id || request.ip || 'anonymous'),
      limit: 20,
      windowSeconds: 60,
    });

    const result = await updateProfileSettings(body as UpdateProfileSettingsInput, {
      user: user || undefined,
    });

    response.status(200).json(result);
  } catch (error) {
    sendOperationError('settings-operation', error, response);
  }
}

export async function getNotificationSettingsApiHandler(
  request: HandlerRequest,
  response: Response,
  context: any
) {
  try {
    const projectKeyParam = request.query.project_key as string | string[] | undefined;
    const projectKey = Array.isArray(projectKeyParam) ? projectKeyParam[0] : projectKeyParam;
    const result = await getNotificationSettings(
      {
        project_key: projectKey,
      },
      {
        user: (await resolveRequestUser(request, context)) || undefined,
      }
    );

    response.status(200).json(result);
  } catch (error) {
    sendOperationError('settings-operation', error, response);
  }
}

export async function updateNotificationSettingsApiHandler(
  request: HandlerRequest,
  response: Response,
  context: any
) {
  try {
    const body = parseJsonBodyWithLimit<Record<string, unknown>>(request.body);
    const user = await resolveRequestUser(request, context);
    await enforceRateLimit({
      key: getRateLimitKey('settings-notifications', user?.id || request.ip || 'anonymous'),
      limit: 20,
      windowSeconds: 60,
    });

    const result = await updateNotificationSettings(
      body as UpdateNotificationSettingsInput,
      {
        user: user || undefined,
      }
    );

    response.status(200).json(result);
  } catch (error) {
    sendOperationError('settings-operation', error, response);
  }
}

export async function getScannerAccessSettingsApiHandler(
  request: HandlerRequest,
  response: Response,
  context: any
) {
  try {
    const user = await resolveRequestUser(request, context);
    const result = await getScannerAccessSettings(
      {},
      {
        user: user || undefined,
      }
    );

    response.status(200).json(result);
  } catch (error) {
    sendOperationError('settings-operation', error, response);
  }
}

export async function updateScannerAccessSettingsApiHandler(
  request: HandlerRequest,
  response: Response,
  context: any
) {
  try {
    const body = parseJsonBodyWithLimit<Record<string, unknown>>(request.body);
    const user = await resolveRequestUser(request, context);
    await enforceRateLimit({
      key: getRateLimitKey('settings-scanner-access', user?.id || request.ip || 'anonymous'),
      limit: 20,
      windowSeconds: 60,
    });

    const result = await updateScannerAccessSettings(
      body as UpdateScannerAccessSettingsInput,
      {
        user: user || undefined,
      }
    );

    response.status(200).json(result);
  } catch (error) {
    sendOperationError('settings-operation', error, response);
  }
}

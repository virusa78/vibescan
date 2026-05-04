import type { Response } from 'express';
import {
  generateAPIKey,
  listAPIKeys,
  getAPIKeyDetails,
  revokeAPIKey,
  type GenerateAPIKeyInput,
} from './index';
import { resolveRequestUser } from '../../services/requestAuth';
import { parseJsonBodyWithLimit, enforceRateLimit, getRateLimitKey } from '../../http/requestGuards';
import { sendOperationError } from '../../http/httpErrors';
import type { HandlerContext, HandlerRequest } from '../../http/handlerTypes';

export async function generateAPIKeyApiHandler(
  request: HandlerRequest,
  response: Response,
  context: any
) {
  try {
    const body = parseJsonBodyWithLimit<Record<string, unknown>>(request.body);
    const user = await resolveRequestUser(request, context);
    await enforceRateLimit({
      key: getRateLimitKey('apikey-generate', user?.id || request.ip || 'anonymous'),
      limit: 10,
      windowSeconds: 60,
    });

    const result = await generateAPIKey(body as GenerateAPIKeyInput, {
      user: user || undefined,
    });

    response.status(201).json(result);
  } catch (error) {
    sendOperationError('apikey-operation', error, response);
  }
}

export async function listAPIKeysApiHandler(
  request: HandlerRequest,
  response: Response,
  context: any
) {
  try {
    const result = await listAPIKeys(
      {},
      {
        user: (await resolveRequestUser(request, context)) || undefined,
      }
    );

    response.status(200).json(result);
  } catch (error) {
    sendOperationError('apikey-operation', error, response);
  }
}

export async function getAPIKeyDetailsApiHandler(
  request: HandlerRequest,
  response: Response,
  context: any
) {
  try {
    const keyId = request.params.keyId;
    const result = await getAPIKeyDetails(
      { keyId },
      {
        user: (await resolveRequestUser(request, context)) || undefined,
      }
    );

    response.status(200).json(result);
  } catch (error) {
    sendOperationError('apikey-operation', error, response);
  }
}

export async function revokeAPIKeyApiHandler(
  request: HandlerRequest,
  response: Response,
  context: any
) {
  try {
    const keyId = request.params.keyId;
    const result = await revokeAPIKey(
      { keyId },
      {
        user: (await resolveRequestUser(request, context)) || undefined,
      }
    );

    response.status(200).json(result);
  } catch (error) {
    sendOperationError('apikey-operation', error, response);
  }
}

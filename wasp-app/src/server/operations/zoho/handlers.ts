import type { Response } from 'express';
import { resolveRequestUser } from '../../services/requestAuth';
import { parseJsonBodyWithLimit, enforceRateLimit, getRateLimitKey } from '../../http/requestGuards';
import { sendOperationError } from '../../http/httpErrors';
import type { HandlerRequest } from '../../http/handlerTypes';
import { connectZoho, type ConnectZohoInput } from './connectZoho';
import { disconnectZoho } from './disconnectZoho';
import { getZohoIntegrationStatus } from './getZohoIntegrationStatus';
import { resyncZohoWorkspace } from './resyncZohoWorkspace';
import { testZohoConnection } from './testZohoConnection';

export async function getZohoIntegrationStatusApiHandler(
  request: HandlerRequest,
  response: Response,
  context: any,
) {
  try {
    const result = await getZohoIntegrationStatus(
      {},
      {
        user: await resolveRequestUser(request, context),
      },
    );

    response.status(200).json(result);
  } catch (error) {
    sendOperationError('zoho-operation', error, response);
  }
}

export async function connectZohoApiHandler(
  request: HandlerRequest,
  response: Response,
  context: any,
) {
  try {
    const user = await resolveRequestUser(request, context);
    await enforceRateLimit({
      key: getRateLimitKey('zoho-connect', user?.id || request.ip || 'anonymous'),
      limit: 10,
      windowSeconds: 60,
    });

    const body = parseJsonBodyWithLimit<Record<string, unknown>>(request.body);
    const result = await connectZoho(body as ConnectZohoInput, {
      user,
    });

    response.status(200).json(result);
  } catch (error) {
    sendOperationError('zoho-operation', error, response);
  }
}

export async function disconnectZohoApiHandler(
  request: HandlerRequest,
  response: Response,
  context: any,
) {
  try {
    const user = await resolveRequestUser(request, context);
    await enforceRateLimit({
      key: getRateLimitKey('zoho-disconnect', user?.id || request.ip || 'anonymous'),
      limit: 10,
      windowSeconds: 60,
    });

    const result = await disconnectZoho({}, { user });

    response.status(200).json(result);
  } catch (error) {
    sendOperationError('zoho-operation', error, response);
  }
}

export async function testZohoConnectionApiHandler(
  request: HandlerRequest,
  response: Response,
  context: any,
) {
  try {
    const user = await resolveRequestUser(request, context);
    await enforceRateLimit({
      key: getRateLimitKey('zoho-test', user?.id || request.ip || 'anonymous'),
      limit: 20,
      windowSeconds: 60,
    });

    const result = await testZohoConnection({}, { user });
    response.status(200).json(result);
  } catch (error) {
    sendOperationError('zoho-operation', error, response);
  }
}

export async function resyncZohoWorkspaceApiHandler(
  request: HandlerRequest,
  response: Response,
  context: any,
) {
  try {
    const user = await resolveRequestUser(request, context);
    await enforceRateLimit({
      key: getRateLimitKey('zoho-resync', user?.id || request.ip || 'anonymous'),
      limit: 10,
      windowSeconds: 60,
    });

    const result = await resyncZohoWorkspace({}, { user });
    response.status(202).json(result);
  } catch (error) {
    sendOperationError('zoho-operation', error, response);
  }
}

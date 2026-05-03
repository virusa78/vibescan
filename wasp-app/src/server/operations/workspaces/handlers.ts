import type { Response } from 'express';
import { getWorkspaceContext } from './getWorkspaceContext';
import { listWorkspaces } from './listWorkspaces';
import { switchWorkspace, type SwitchWorkspaceInput } from './switchWorkspace';
import { resolveRequestUser } from '../../services/requestAuth';
import { parseJsonBodyWithLimit, enforceRateLimit, getRateLimitKey } from '../../http/requestGuards';
import { sendOperationError } from '../../http/httpErrors';
import type { HandlerContext, HandlerRequest } from '../../http/handlerTypes';

export async function getWorkspaceContextApiHandler(
  request: HandlerRequest,
  response: Response,
  context: any,
) {
  try {
    const result = await getWorkspaceContext(
      {},
      {
        user: await resolveRequestUser(request, context),
      },
    );

    response.status(200).json(result);
  } catch (error) {
    sendOperationError('workspace-operation', error, response);
  }
}

export async function listWorkspacesApiHandler(
  request: HandlerRequest,
  response: Response,
  context: any,
) {
  try {
    const result = await listWorkspaces(
      {},
      {
        user: await resolveRequestUser(request, context),
      },
    );

    response.status(200).json(result);
  } catch (error) {
    sendOperationError('workspace-operation', error, response);
  }
}

export async function switchWorkspaceApiHandler(
  request: HandlerRequest,
  response: Response,
  context: any,
) {
  try {
    const user = await resolveRequestUser(request, context);
    await enforceRateLimit({
      key: getRateLimitKey('workspace-switch', user?.id || request.ip || 'anonymous'),
      limit: 30,
      windowSeconds: 60,
    });

    const body = parseJsonBodyWithLimit<Record<string, unknown>>(request.body);
    const result = await switchWorkspace(body as SwitchWorkspaceInput, {
      user,
    });

    response.status(200).json(result);
  } catch (error) {
    sendOperationError('workspace-operation', error, response);
  }
}

import type { Response } from 'express';
import { listGithubInstallations } from './listGithubInstallations';
import { linkGithubInstallation, type LinkGithubInstallationInput } from './linkGithubInstallation';
import {
  updateGithubInstallationSettings,
  type UpdateGithubInstallationSettingsInput,
} from './updateGithubInstallationSettings';
import { resolveRequestUser } from '../../services/requestAuth';
import { parseJsonBodyWithLimit, enforceRateLimit, getRateLimitKey } from '../../http/requestGuards';
import { sendOperationError } from '../../http/httpErrors';
import type { HandlerContext, HandlerRequest } from '../../http/handlerTypes';

export async function listGithubInstallationsApiHandler(
  request: HandlerRequest,
  response: Response,
  context: any,
) {
  try {
    const result = await listGithubInstallations(
      {},
      {
        user: await resolveRequestUser(request, context),
      },
    );

    response.status(200).json(result);
  } catch (error) {
    sendOperationError('github-operation', error, response);
  }
}

export async function linkGithubInstallationApiHandler(
  request: HandlerRequest,
  response: Response,
  context: any,
) {
  try {
    const user = await resolveRequestUser(request, context);
    await enforceRateLimit({
      key: getRateLimitKey('github-installation-link', user?.id || request.ip || 'anonymous'),
      limit: 20,
      windowSeconds: 60,
    });
    const body = parseJsonBodyWithLimit<Record<string, unknown>>(request.body);

    const result = await linkGithubInstallation(body as LinkGithubInstallationInput, {
      user,
    });

    response.status(200).json(result);
  } catch (error) {
    sendOperationError('github-operation', error, response);
  }
}

export async function updateGithubInstallationSettingsApiHandler(
  request: HandlerRequest,
  response: Response,
  context: any,
) {
  try {
    const user = await resolveRequestUser(request, context);
    await enforceRateLimit({
      key: getRateLimitKey('github-installation-settings', user?.id || request.ip || 'anonymous'),
      limit: 20,
      windowSeconds: 60,
    });
    const body = parseJsonBodyWithLimit<Record<string, unknown>>(request.body);
    const installationId = request.params.installationId;

    const result = await updateGithubInstallationSettings(
      {
        ...(body as UpdateGithubInstallationSettingsInput),
        installationId,
      },
      {
        user,
      },
    );

    response.status(200).json(result);
  } catch (error) {
    sendOperationError('github-operation', error, response);
  }
}

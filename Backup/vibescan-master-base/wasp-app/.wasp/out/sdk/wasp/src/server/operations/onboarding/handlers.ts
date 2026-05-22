import type { Response } from 'express';
import { getOnboardingState } from './getOnboardingState';
import { completeOnboarding } from './completeOnboarding';
import { resolveRequestUser } from '../../services/requestAuth';
import { enforceRateLimit, getRateLimitKey } from '../../http/requestGuards';
import { sendOperationError } from '../../http/httpErrors';
import type { HandlerContext, HandlerRequest } from '../../http/handlerTypes';

export async function getOnboardingStateApiHandler(
  request: HandlerRequest,
  response: Response,
  context: any,
) {
  try {
    const result = await getOnboardingState(
      {},
      {
        user: await resolveRequestUser(request, context),
      },
    );

    response.status(200).json(result);
  } catch (error) {
    sendOperationError('onboarding-operation', error, response);
  }
}

export async function completeOnboardingApiHandler(
  request: HandlerRequest,
  response: Response,
  context: any,
) {
  try {
    const user = await resolveRequestUser(request, context);
    await enforceRateLimit({
      key: getRateLimitKey('onboarding-complete', user?.id || request.ip || 'anonymous'),
      limit: 20,
      windowSeconds: 60,
    });

    const result = await completeOnboarding(
      {},
      {
        user,
      },
    );

    response.status(200).json(result);
  } catch (error) {
    sendOperationError('onboarding-operation', error, response);
  }
}

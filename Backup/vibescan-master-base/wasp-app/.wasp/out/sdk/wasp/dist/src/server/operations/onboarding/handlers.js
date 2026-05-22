import { getOnboardingState } from './getOnboardingState';
import { completeOnboarding } from './completeOnboarding';
import { resolveRequestUser } from '../../services/requestAuth';
import { enforceRateLimit, getRateLimitKey } from '../../http/requestGuards';
import { sendOperationError } from '../../http/httpErrors';
export async function getOnboardingStateApiHandler(request, response, context) {
    try {
        const result = await getOnboardingState({}, {
            user: await resolveRequestUser(request, context),
        });
        response.status(200).json(result);
    }
    catch (error) {
        sendOperationError('onboarding-operation', error, response);
    }
}
export async function completeOnboardingApiHandler(request, response, context) {
    try {
        const user = await resolveRequestUser(request, context);
        await enforceRateLimit({
            key: getRateLimitKey('onboarding-complete', user?.id || request.ip || 'anonymous'),
            limit: 20,
            windowSeconds: 60,
        });
        const result = await completeOnboarding({}, {
            user,
        });
        response.status(200).json(result);
    }
    catch (error) {
        sendOperationError('onboarding-operation', error, response);
    }
}
//# sourceMappingURL=handlers.js.map
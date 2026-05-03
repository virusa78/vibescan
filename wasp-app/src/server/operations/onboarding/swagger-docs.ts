/**
 * @swagger
 * /api/v1/onboarding/state:
 *   get:
 *     summary: Get onboarding state
 *     description: Retrieve onboarding visibility and first-scan guidance state for the authenticated user.
 *     operationId: getOnboardingState
 *     tags:
 *       - Onboarding
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     responses:
 *       200:
 *         description: Onboarding state retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OnboardingStateResponse'
 *       401:
 *         description: User not authenticated
 *
 * /api/v1/onboarding/complete:
 *   post:
 *     summary: Complete onboarding
 *     description: Mark onboarding as completed for the authenticated user.
 *     operationId: completeOnboarding
 *     tags:
 *       - Onboarding
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     responses:
 *       200:
 *         description: Onboarding marked as completed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CompleteOnboardingResponse'
 *       401:
 *         description: User not authenticated
 */

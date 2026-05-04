/**
 * @swagger
 * /operations/generateCheckoutSession:
 *   post:
 *     summary: Create a checkout session
 *     description: |
 *       Create a payment processor checkout session for the selected plan.
 *       Returns a hosted checkout URL and session identifier.
 *     operationId: generateCheckoutSession
 *     tags:
 *       - Billing
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PaymentPlanId'
 *     responses:
 *       200:
 *         description: Checkout session created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CheckoutSessionResponse'
 *       400:
 *         description: Invalid payment plan
 *       401:
 *         description: User not authenticated
 *       403:
 *         description: User missing required email for checkout
 *
 * /operations/getCustomerPortalUrl:
 *   post:
 *     summary: Get customer portal URL
 *     description: |
 *       Fetch the billing customer portal URL for the authenticated user.
 *       Returns null when no portal is available.
 *     operationId: getCustomerPortalUrl
 *     tags:
 *       - Billing
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Customer portal URL
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CustomerPortalUrlResponse'
 *       401:
 *         description: User not authenticated
 */

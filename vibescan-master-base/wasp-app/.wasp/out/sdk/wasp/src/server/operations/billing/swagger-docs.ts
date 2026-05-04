/**
 * @swagger
 * /api/v1/billing/account:
 *   get:
 *     summary: Get current billing account snapshot
 *     operationId: getBillingAccount
 *     tags:
 *       - Billing
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     responses:
 *       200:
 *         description: Billing account snapshot
 *       401:
 *         description: User not authenticated
 *
 * /api/v1/billing/events:
 *   get:
 *     summary: List billing ledger events
 *     operationId: listBillingEvents
 *     tags:
 *       - Billing
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     parameters:
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 200
 *     responses:
 *       200:
 *         description: Billing ledger events
 *       401:
 *         description: User not authenticated
 *
 * /api/v1/billing/entitlements:
 *   get:
 *     summary: Get current entitlement snapshot
 *     operationId: getBillingEntitlements
 *     tags:
 *       - Billing
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     responses:
 *       200:
 *         description: Entitlement snapshot
 *       401:
 *         description: User not authenticated
 */

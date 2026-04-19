/**
 * @swagger
 * /api/v1/webhooks:
 *   post:
 *     summary: Create a new webhook
 *     description: Configure a webhook endpoint for scan notifications.
 *     operationId: createWebhook
 *     tags:
 *       - Webhooks
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateWebhookRequest'
 *     responses:
 *       201:
 *         description: Webhook created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WebhookResponse'
 *       400:
 *         description: Invalid request body
 *       401:
 *         description: Unauthorized
 *       409:
 *         description: Webhook already exists for this URL
 *
 *   get:
 *     summary: List webhooks
 *     description: Get all webhooks configured for the authenticated user.
 *     operationId: listWebhooks
 *     tags:
 *       - Webhooks
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     responses:
 *       200:
 *         description: List of webhooks
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WebhookListResponse'
 *       401:
 *         description: Unauthorized
 *
 * /api/v1/webhooks/{webhookId}:
 *   get:
 *     summary: Get webhook details
 *     description: Retrieve details of a specific webhook including delivery history.
 *     operationId: getWebhook
 *     tags:
 *       - Webhooks
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     parameters:
 *       - name: webhookId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Webhook details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WebhookDetailResponse'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Webhook not found
 *
 *   put:
 *     summary: Update webhook
 *     description: Update webhook configuration (URL, events, enabled status).
 *     operationId: updateWebhook
 *     tags:
 *       - Webhooks
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     parameters:
 *       - name: webhookId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateWebhookRequest'
 *     responses:
 *       200:
 *         description: Webhook updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UpdateWebhookResponse'
 *       400:
 *         description: Invalid request body
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Webhook not found
 *
 *   delete:
 *     summary: Delete webhook
 *     description: Remove a webhook endpoint.
 *     operationId: deleteWebhook
 *     tags:
 *       - Webhooks
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     parameters:
 *       - name: webhookId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Webhook deleted
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ActionResponse'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Webhook not found
 */

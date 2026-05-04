export {};
/**
 * @swagger
 * /api/v1/events/subscriptions:
 *   get:
 *     summary: List event subscriptions
 *     operationId: listEventSubscriptions
 *     tags:
 *       - Events
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     responses:
 *       200:
 *         description: Event subscriptions
 *       401:
 *         description: User not authenticated
 *
 *   post:
 *     summary: Create an event subscription
 *     operationId: createEventSubscription
 *     tags:
 *       - Events
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     responses:
 *       201:
 *         description: Event subscription created
 *       400:
 *         description: Invalid request
 *       401:
 *         description: User not authenticated
 *
 * /api/v1/events/deliveries:
 *   get:
 *     summary: List event deliveries
 *     operationId: listEventDeliveries
 *     tags:
 *       - Events
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     responses:
 *       200:
 *         description: Event deliveries
 *       401:
 *         description: User not authenticated
 *
 * /api/v1/events/deliveries/{deliveryId}:
 *   get:
 *     summary: Get event delivery details
 *     operationId: getEventDelivery
 *     tags:
 *       - Events
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     parameters:
 *       - name: deliveryId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Event delivery details
 *       401:
 *         description: User not authenticated
 *       404:
 *         description: Event delivery not found
 *
 * /api/v1/events/deliveries/{deliveryId}/retry:
 *   post:
 *     summary: Retry an event delivery
 *     operationId: retryEventDelivery
 *     tags:
 *       - Events
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     parameters:
 *       - name: deliveryId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Event delivery retried
 *       401:
 *         description: User not authenticated
 *       404:
 *         description: Event delivery not found
 */
//# sourceMappingURL=swagger-docs.js.map
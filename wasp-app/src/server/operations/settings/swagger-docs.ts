/**
 * @swagger
 * /api/v1/settings/profile:
 *   get:
 *     summary: Get user profile settings
 *     description: |
 *       Retrieve the authenticated user's profile information including
 *       name, email, region, plan tier, and organization membership details.
 *     operationId: getProfileSettings
 *     tags:
 *       - Settings
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     responses:
 *       200:
 *         description: User profile settings retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProfileResponse'
 *       401:
 *         description: User not authenticated
 *       404:
 *         description: User not found
 *
 *   post:
 *     summary: Update user profile settings
 *     description: |
 *       Update the authenticated user's profile information.
 *       Supports updating name, region, and notification preferences.
 *     operationId: updateProfileSettings
 *     tags:
 *       - Settings
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateProfileSettingsRequest'
 *     responses:
 *       200:
 *         description: Profile settings updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProfileResponse'
 *       400:
 *         description: Invalid input or validation error
 *       401:
 *         description: User not authenticated
 *       404:
 *         description: User not found
 *
 * /api/v1/settings/notifications:
 *   get:
 *     summary: Get user notification settings
 *     description: |
 *       Retrieve the authenticated user's notification preferences
 *       including email notifications and digest settings.
 *     operationId: getNotificationSettings
 *     tags:
 *       - Settings
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     responses:
 *       200:
 *         description: Notification settings retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotificationSettingsResponse'
 *       401:
 *         description: User not authenticated
 *       404:
 *         description: User not found
 *
 *   post:
 *     summary: Update user notification settings
 *     description: |
 *       Update the authenticated user's notification preferences.
 *       Supports email notifications, vulnerability alerts, and digest options.
 *     operationId: updateNotificationSettings
 *     tags:
 *       - Settings
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateNotificationSettingsRequest'
 *     responses:
 *       200:
 *         description: Notification settings updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotificationSettingsResponse'
 *       400:
 *         description: Invalid input or validation error
 *       401:
 *         description: User not authenticated
 *       404:
 *         description: User not found
 */

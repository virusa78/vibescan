export {};
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
 *     parameters:
 *       - name: project_key
 *         in: query
 *         required: false
 *         schema:
 *           type: string
 *           default: default
 *         description: Project identifier for project-scoped notification preferences.
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
 *       Supports email notifications, vulnerability alerts, digest options,
 *       and project-scoped preferences via `project_key`.
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
 *
 * /api/v1/settings/scanner-access:
 *   get:
 *     summary: Get scanner access settings
 *     description: |
 *       Retrieve the authenticated user's scanner access state and latest
 *       health status for remote Johnny and Snyk runtimes.
 *     operationId: getScannerAccessSettings
 *     tags:
 *       - Settings
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     responses:
 *       200:
 *         description: Scanner access settings retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ScannerAccessResponse'
 *       401:
 *         description: User not authenticated
 *       404:
 *         description: User not found
 *
 *   post:
 *     summary: Update scanner access settings
 *     description: |
 *       Attach or clear the authenticated user's Snyk API key.
 *       Sending an empty value clears the stored key.
 *     operationId: updateScannerAccessSettings
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
 *             $ref: '#/components/schemas/UpdateScannerAccessRequest'
 *     responses:
 *       200:
 *         description: Scanner access settings updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ScannerAccessResponse'
 *       400:
 *         description: Invalid input or validation error
 *       401:
 *         description: User not authenticated
 *       404:
 *         description: User not found
 */
//# sourceMappingURL=swagger-docs.js.map
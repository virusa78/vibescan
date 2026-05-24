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
 *
 * /api/v1/settings/zoho:
 *   get:
 *     summary: Get Zoho CRM integration status
 *     description: Retrieve the active workspace Zoho CRM connection, sync health, and last sync metadata.
 *     operationId: getZohoIntegrationStatus
 *     tags:
 *       - Settings
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     responses:
 *       200:
 *         description: Zoho integration status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ZohoIntegrationStatusResponse'
 *       401:
 *         description: User not authenticated
 *       403:
 *         description: Workspace admin required
 *
 *   delete:
 *     summary: Disconnect Zoho CRM
 *     description: Revoke the stored Zoho refresh token and clear the workspace connection state.
 *     operationId: disconnectZoho
 *     tags:
 *       - Settings
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     responses:
 *       200:
 *         description: Zoho integration disconnected successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ZohoIntegrationStatusResponse'
 *       401:
 *         description: User not authenticated
 *       403:
 *         description: Workspace admin required
 *
 * /api/v1/settings/zoho/connect:
 *   post:
 *     summary: Connect Zoho CRM
 *     description: Exchange a Zoho authorization code or refresh token and store the encrypted CRM credentials for the active workspace.
 *     operationId: connectZoho
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
 *             $ref: '#/components/schemas/ConnectZohoRequest'
 *     responses:
 *       200:
 *         description: Zoho integration connected successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ZohoIntegrationStatusResponse'
 *       400:
 *         description: Invalid input or validation error
 *       401:
 *         description: User not authenticated
 *       403:
 *         description: Workspace admin required
 *       422:
 *         description: Zoho OAuth env is missing or invalid
 *
 * /api/v1/settings/zoho/test:
 *   post:
 *     summary: Test Zoho CRM connection
 *     description: Refresh the stored token if needed and validate the connection against Zoho CRM org metadata.
 *     operationId: testZohoConnection
 *     tags:
 *       - Settings
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     responses:
 *       200:
 *         description: Zoho connection validated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ZohoIntegrationStatusResponse'
 *       401:
 *         description: User not authenticated
 *       403:
 *         description: Workspace admin required
 *       422:
 *         description: Zoho integration is not connected
 *
 * /api/v1/settings/zoho/resync:
 *   post:
 *     summary: Queue a Zoho CRM resync
 *     description: Enqueue an asynchronous workspace sync job that upserts the Zoho Account and Contact summary records.
 *     operationId: resyncZohoWorkspace
 *     tags:
 *       - Settings
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     responses:
 *       202:
 *         description: Zoho workspace sync queued
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ZohoResyncResponse'
 *       401:
 *         description: User not authenticated
 *       403:
 *         description: Workspace admin required
 *       422:
 *         description: Zoho integration is not connected
 */

/**
 * @swagger
 * /api/v1/github/installations:
 *   get:
 *     summary: List GitHub installations for the active workspace
 *     description: Retrieve GitHub App installations linked to the authenticated user's active workspace.
 *     operationId: listGithubInstallations
 *     tags:
 *       - GitHub
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     responses:
 *       200:
 *         description: GitHub installations retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ListGithubInstallationsResponse'
 *       401:
 *         description: User not authenticated
 *
 * /api/v1/github/installations/link:
 *   post:
 *     summary: Link a GitHub installation to the active workspace
 *     description: Attach an existing GitHub App installation to the authenticated user's active workspace.
 *     operationId: linkGithubInstallation
 *     tags:
 *       - GitHub
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LinkGithubInstallationRequest'
 *     responses:
 *       200:
 *         description: GitHub installation linked successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/GithubInstallationSummary'
 *       400:
 *         description: Invalid input or validation error
 *       401:
 *         description: User not authenticated
 *
 * /api/v1/github/installations/{installationId}/settings:
 *   post:
 *     summary: Update GitHub installation settings
 *     description: Update repository scope and trigger settings for a linked GitHub installation.
 *     operationId: updateGithubInstallationSettings
 *     tags:
 *       - GitHub
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     parameters:
 *       - name: installationId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Linked GitHub installation record ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateGithubInstallationSettingsRequest'
 *     responses:
 *       200:
 *         description: GitHub installation settings updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/GithubInstallationSummary'
 *       400:
 *         description: Invalid input or validation error
 *       401:
 *         description: User not authenticated
 *       404:
 *         description: GitHub installation not found
 */

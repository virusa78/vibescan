export {};
/**
 * @swagger
 * /api/v1/workspaces:
 *   get:
 *     summary: List accessible workspaces
 *     description: Retrieve all workspaces available to the authenticated user.
 *     operationId: listWorkspaces
 *     tags:
 *       - Workspaces
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     responses:
 *       200:
 *         description: Workspace list retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ListWorkspacesResponse'
 *       401:
 *         description: User not authenticated
 *
 * /api/v1/workspaces/current:
 *   get:
 *     summary: Get active workspace context
 *     description: Retrieve the authenticated user's active workspace plus all accessible workspaces.
 *     operationId: getWorkspaceContext
 *     tags:
 *       - Workspaces
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     responses:
 *       200:
 *         description: Active workspace context retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WorkspaceContextResponse'
 *       401:
 *         description: User not authenticated
 *
 * /api/v1/workspaces/switch:
 *   post:
 *     summary: Switch active workspace
 *     description: Switch the authenticated user's active workspace and return refreshed workspace context.
 *     operationId: switchWorkspace
 *     tags:
 *       - Workspaces
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SwitchWorkspaceRequest'
 *     responses:
 *       200:
 *         description: Workspace switched successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WorkspaceContextResponse'
 *       400:
 *         description: Invalid input or validation error
 *       401:
 *         description: User not authenticated
 *       404:
 *         description: Workspace not found
 */
//# sourceMappingURL=swagger-docs.d.ts.map
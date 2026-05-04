export {};
/**
 * @swagger
 * /api/v1/dashboard/metrics:
 *   get:
 *     summary: Get dashboard metrics
 *     description: |
 *       Retrieve aggregated dashboard metrics for the authenticated user.
 *       Includes total scans, vulnerabilities, severity data, and quota usage.
 *     operationId: getDashboardMetrics
 *     tags:
 *       - Dashboard
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     parameters:
 *       - name: time_range
 *         in: query
 *         description: Time range for aggregation
 *         schema:
 *           type: string
 *           enum: ['7d', '30d', 'all']
 *           default: '30d'
 *     responses:
 *       200:
 *         description: Dashboard metrics
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MetricsResponse'
 *       401:
 *         description: User not authenticated
 *
 * /api/v1/dashboard/recent-scans:
 *   get:
 *     summary: Get recent scans
 *     description: |
 *       Retrieve the most recent scans for the authenticated user.
 *       Includes vulnerability count and status for each scan.
 *     operationId: getRecentScans
 *     tags:
 *       - Dashboard
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     parameters:
 *       - name: limit
 *         in: query
 *         description: Maximum number of recent scans to return (1-50)
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 10
 *       - name: status
 *         in: query
 *         description: Optional status filter (comma-separated values)
 *         schema:
 *           type: string
 *           example: pending,scanning,done
 *       - name: q
 *         in: query
 *         description: Optional fuzzy search by target, CVE, or scan ID
 *         schema:
 *           type: string
 *           example: CVE-2024-1234
 *       - name: sort
 *         in: query
 *         description: Optional sort descriptors as `field:direction`, comma-separated
 *         schema:
 *           type: string
 *           example: submitted:desc,findings:desc
 *     responses:
 *       200:
 *         description: List of recent scans
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RecentScansResponse'
 *       401:
 *         description: User not authenticated
 *
 * /api/v1/dashboard/severity-breakdown:
 *   get:
 *     summary: Get severity breakdown
 *     description: |
 *       Retrieve vulnerability count breakdown by severity level.
 *       Includes counts for critical, high, medium, low, and info severity.
 *     operationId: getSeverityBreakdown
 *     tags:
 *       - Dashboard
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     parameters:
 *       - name: time_range
 *         in: query
 *         description: Time range for aggregation
 *         schema:
 *           type: string
 *           enum: ['7d', '30d', 'all']
 *           default: '30d'
 *     responses:
 *       200:
 *         description: Severity breakdown statistics
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SeverityBreakdownResponse'
 *       401:
 *         description: User not authenticated
 *
 * /api/v1/dashboard/quota:
 *   get:
 *     summary: Get quota status
 *     description: |
 *       Retrieve current monthly quota usage and status.
 *       Includes used count, limit, percentage, reset date, and usage trend.
 *     operationId: getQuotaStatus
 *     tags:
 *       - Dashboard
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     responses:
 *       200:
 *         description: Quota status
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/QuotaStatusResponse'
 *       401:
 *         description: User not authenticated
 *
 * /api/v1/dashboard/trends:
 *   get:
 *     summary: Get dashboard trend series
 *     description: |
 *       Retrieve time-series trend buckets for scans, findings, and delta values.
 *       Supports configurable time range and optional granularity.
 *     operationId: getTrendSeries
 *     tags:
 *       - Dashboard
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     parameters:
 *       - name: time_range
 *         in: query
 *         description: Time range for aggregation
 *         schema:
 *           type: string
 *           enum: ['7d', '30d', 'all']
 *           default: '30d'
 *       - name: granularity
 *         in: query
 *         description: Optional bucket size override
 *         schema:
 *           type: string
 *           enum: ['day', 'week']
 *     responses:
 *       200:
 *         description: Trend series response
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TrendSeriesResponse'
 *       401:
 *         description: User not authenticated
 *
 * /api/v1/dashboard/saved-views:
 *   get:
 *     summary: List saved dashboard views
 *     operationId: listSavedViews
 *     tags:
 *       - Dashboard
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     responses:
 *       200:
 *         description: Saved view list
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SavedViewsResponse'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *   post:
 *     summary: Create saved dashboard view
 *     operationId: createSavedView
 *     tags:
 *       - Dashboard
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateSavedViewRequest'
 *     responses:
 *       201:
 *         description: Saved view created
 *       400:
 *         description: Invalid request body
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *
 * /api/v1/dashboard/saved-views/{viewId}:
 *   put:
 *     summary: Update saved dashboard view
 *     operationId: updateSavedView
 *     tags:
 *       - Dashboard
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     parameters:
 *       - name: viewId
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
 *             $ref: '#/components/schemas/CreateSavedViewRequest'
 *     responses:
 *       200:
 *         description: Saved view updated
 *       400:
 *         description: Invalid request body
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Saved view not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *   delete:
 *     summary: Delete saved dashboard view
 *     operationId: deleteSavedView
 *     tags:
 *       - Dashboard
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     parameters:
 *       - name: viewId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Saved view deleted
 *       404:
 *         description: Saved view not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *
 * /api/v1/dashboard/scans/bulk-cancel:
 *   post:
 *     summary: Bulk cancel scans
 *     operationId: bulkCancelScans
 *     tags:
 *       - Dashboard
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [scanIds]
 *             properties:
 *               scanIds:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: string
 *                   format: uuid
 *     responses:
 *       200:
 *         description: Bulk cancellation completed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ActionResponse'
 *       400:
 *         description: Invalid request body
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 * /api/v1/dashboard/scans/bulk-rerun:
 *   post:
 *     summary: Bulk rerun scans
 *     operationId: bulkRerunScans
 *     tags:
 *       - Dashboard
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [scanIds]
 *             properties:
 *               scanIds:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: string
 *                   format: uuid
 *     responses:
 *       200:
 *         description: Bulk rerun submitted
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ActionResponse'
 *       400:
 *         description: Invalid request body
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 * /api/v1/dashboard/scans/export:
 *   post:
 *     summary: Export selected scans
 *     operationId: exportScans
 *     tags:
 *       - Dashboard
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [scanIds]
 *             properties:
 *               scanIds:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: string
 *                   format: uuid
 *               format:
 *                 type: string
 *                 enum: [json, csv]
 *                 default: json
 *     responses:
 *       200:
 *         description: Export generated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               additionalProperties: true
 *       400:
 *         description: Invalid request body
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
//# sourceMappingURL=swagger-docs.js.map
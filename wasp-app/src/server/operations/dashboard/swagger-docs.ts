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
 *   post:
 *     summary: Create saved dashboard view
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
 *
 * /api/v1/dashboard/saved-views/{viewId}:
 *   put:
 *     summary: Update saved dashboard view
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
 *         description: Saved view updated
 *   delete:
 *     summary: Delete saved dashboard view
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
 *
 * /api/v1/dashboard/scans/bulk-cancel:
 *   post:
 *     summary: Bulk cancel scans
 *     tags:
 *       - Dashboard
 * /api/v1/dashboard/scans/bulk-rerun:
 *   post:
 *     summary: Bulk rerun scans
 *     tags:
 *       - Dashboard
 * /api/v1/dashboard/scans/export:
 *   post:
 *     summary: Export selected scans
 *     tags:
 *       - Dashboard
 */

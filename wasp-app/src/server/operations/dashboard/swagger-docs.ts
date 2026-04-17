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
 *         description: Maximum number of recent scans to return (1-20)
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 20
 *           default: 10
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
 */

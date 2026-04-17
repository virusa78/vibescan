/**
 * @swagger
 * /api/v1/scans:
 *   post:
 *     summary: Submit a new vulnerability scan
 *     description: |
 *       Create and submit a new scan for vulnerability detection.
 *       Quota is consumed at submission time (not completion).
 *       Enqueues both free (Grype) and enterprise (BlackDuck) scanner jobs.
 *     operationId: submitScan
 *     tags:
 *       - Scans
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SubmitScanRequest'
 *     responses:
 *       201:
 *         description: Scan successfully submitted
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ScanResponse'
 *       400:
 *         description: Invalid input or validation error
 *       401:
 *         description: User not authenticated
 *       429:
 *         description: Monthly scan quota exceeded
 *
 *   get:
 *     summary: List user's scans
 *     description: |
 *       Retrieve paginated list of scans for the authenticated user.
 *       Supports filtering by status and date range.
 *     operationId: listScans
 *     tags:
 *       - Scans
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     parameters:
 *       - name: limit
 *         in: query
 *         description: Maximum number of results per page (1-100)
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 25
 *       - name: offset
 *         in: query
 *         description: Number of results to skip (for pagination)
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *       - name: status
 *         in: query
 *         description: Filter by scan status
 *         schema:
 *           type: string
 *           enum: ['pending', 'scanning', 'done', 'error', 'cancelled']
 *       - name: created_from
 *         in: query
 *         description: Filter scans created from this date (ISO 8601 format)
 *         schema:
 *           type: string
 *           format: date-time
 *       - name: created_to
 *         in: query
 *         description: Filter scans created until this date (ISO 8601 format)
 *         schema:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: List of scans
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ListScansResponse'
 *       401:
 *         description: User not authenticated
 *
 * /api/v1/scans/{scanId}:
 *   get:
 *     summary: Get scan details
 *     description: |
 *       Retrieve full details of a specific scan including results and delta.
 *     operationId: getScan
 *     tags:
 *       - Scans
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     parameters:
 *       - name: scanId
 *         in: path
 *         required: true
 *         description: Scan ID (UUID)
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Scan details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ScanDetailResponse'
 *       401:
 *         description: User not authenticated
 *       404:
 *         description: Scan not found or unauthorized
 *
 *   delete:
 *     summary: Cancel a scan
 *     description: |
 *       Cancel an in-progress or pending scan.
 *       Quota consumed at submission is refunded.
 *     operationId: cancelScan
 *     tags:
 *       - Scans
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     parameters:
 *       - name: scanId
 *         in: path
 *         required: true
 *         description: Scan ID (UUID)
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Scan cancelled successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ActionResponse'
 *       400:
 *         description: Scan cannot be cancelled in current state
 *       401:
 *         description: User not authenticated
 *       404:
 *         description: Scan not found or unauthorized
 *
 * /api/v1/scans/stats:
 *   get:
 *     summary: Get scan statistics
 *     description: |
 *       Retrieve aggregated statistics for user's scans.
 *       Includes counts by status, severity breakdown, and scan rates.
 *     operationId: getScanStats
 *     tags:
 *       - Scans
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
 *         description: Scan statistics
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ScanStatsResponse'
 *       401:
 *         description: User not authenticated
 */

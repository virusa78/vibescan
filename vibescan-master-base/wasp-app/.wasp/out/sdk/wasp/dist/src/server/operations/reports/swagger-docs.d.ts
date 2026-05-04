export {};
/**
 * @swagger
 * /api/v1/reports/{scanId}:
 *   get:
 *     summary: Get full vulnerability report
 *     description: |
 *       Retrieve the report payload for a scan.
 *       Vulnerability details are always included.
 *     operationId: getReport
 *     tags:
 *       - Reports
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     parameters:
 *       - name: scanId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Report payload
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ReportResponse'
 *       401:
 *         description: Unauthorized - missing or invalid credentials
 *       403:
 *         description: Forbidden - no permission to view this scan
 *       404:
 *         description: Scan not found
 *
 * /api/v1/reports/{scanId}/summary:
 *   get:
 *     summary: Get report summary
 *     description: Retrieve vulnerability counts for a scan.
 *     operationId: getReportSummary
 *     tags:
 *       - Reports
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     parameters:
 *       - name: scanId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Report summary
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ReportSummaryResponse'
 *       401:
 *         description: Unauthorized - missing or invalid credentials
 *       403:
 *         description: Forbidden - no permission to view this scan
 *       404:
 *         description: Scan not found
 *
 * /api/v1/reports/{scanId}/pdf:
 *   post:
 *     summary: Queue PDF generation
 *     description: Enqueue a PDF generation job for the scan report.
 *     operationId: generateReportPDF
 *     tags:
 *       - Reports
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     parameters:
 *       - name: scanId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: PDF generation job enqueued
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PDFResponse'
 *       401:
 *         description: Unauthorized - missing or invalid credentials
 *       403:
 *         description: Forbidden - no permission to view this scan
 *       404:
 *         description: Scan not found
 *
 * /api/v1/reports/{scanId}/ci-decision:
 *   get:
 *     summary: Get CI pass/fail decision
 *     description: Evaluate the scan for CI gating based on critical findings.
 *     operationId: getCIDecision
 *     tags:
 *       - Reports
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     parameters:
 *       - name: scanId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: CI decision
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CIDecisionResponse'
 *       401:
 *         description: Unauthorized - missing or invalid credentials
 *       403:
 *         description: Forbidden - no permission to view this scan
 *       404:
 *         description: Scan not found
 *
 * /api/v1/reports/{scanId}/annotations:
 *   get:
 *     summary: List finding annotations for a report
 *     operationId: listFindingAnnotations
 *     tags:
 *       - Reports
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     parameters:
 *       - name: scanId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - name: state
 *         in: query
 *         required: false
 *         schema:
 *           type: string
 *           enum: [accepted, snoozed, rejected, expired]
 *     responses:
 *       200:
 *         description: Annotation list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               additionalProperties: true
 *       404:
 *         description: Scan not found
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
 * /api/v1/reports/{scanId}/findings/{findingId}/annotation:
 *   post:
 *     summary: Upsert finding annotation
 *     operationId: upsertFindingAnnotation
 *     tags:
 *       - Reports
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     parameters:
 *       - name: scanId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - name: findingId
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
 *             type: object
 *             additionalProperties: true
 *     responses:
 *       200:
 *         description: Annotation saved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               additionalProperties: true
 *       404:
 *         description: Scan or finding not found
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
//# sourceMappingURL=swagger-docs.d.ts.map
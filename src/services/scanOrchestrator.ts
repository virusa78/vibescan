/**
 * ScanOrchestrator
 *
 * Coordinates scan submission, dual-scanning pipeline, and result aggregation.
 */

import { v4 as uuidv4 } from 'uuid';
import { getPool } from '../database/client.js';
import { quotaService } from './quotaService.js';
import { addFreeScanJob, addEnterpriseScanJob, getFreeScanQueue, getEnterpriseScanQueue } from '../queues/config.js';
import { getRedisClient } from '../redis/client.js';
import { acquireLock, releaseLock } from '../redis/lock.js';
import { publishScanStatus } from '../redis/pubsub.js';

/**
 * ScanOrchestrator interface
 */
export class ScanOrchestrator {
    private pool: any;
    private lockName = 'scan-orchestrator';
    private lockTimeout = 5000; // 5 seconds

    constructor() {
        this.pool = getPool();
    }

    /**
     * Submit a new scan
     * @param userId - User ID
     * @param inputType - Input type (sbom_upload, source_zip, github_app, ci_plugin)
     * @param input - Scan input data
     * @returns Created scan
     */
    async submitScan(
        userId: string,
        inputType: string,
        input: any
    ): Promise<any> {
        const scanId = uuidv4();

        // Validate input type
        const validInputTypes = ['sbom_upload', 'source_zip', 'github_app', 'ci_plugin'];
        if (!validInputTypes.includes(inputType)) {
            throw {
                code: 'validation_error',
                message: `Invalid input_type. Valid types: ${validInputTypes.join(', ')}`
            };
        }

        // Check and consume quota
        const quotaResult = await quotaService.consumeQuota(scanId, userId);

        // Determine plan from user's current plan
        const userResult = await this.pool.query(
            'SELECT plan FROM users WHERE id = $1',
            [userId]
        );
        const planAtSubmission = userResult.rows[0]?.plan || 'free_trial';

        // Create scan record
        const result = await this.pool.query(
            `INSERT INTO scans (id, user_id, input_type, input_ref, sbom_raw, components, status, plan_at_submission)
             VALUES ($1, $2, $3, $4, $5, $6::jsonb, 'pending', $7)
             RETURNING id, user_id, org_id, input_type, input_ref, status, plan_at_submission, error_message,
                      created_at, completed_at`,
            [
                scanId,
                userId,
                inputType,
                input.inputRef || '',
                input.sbomRaw ? JSON.stringify(input.sbomRaw) : null,
                JSON.stringify(input.components || []),
                planAtSubmission
            ]
        );

        const scan = result.rows[0];

        // Queue parallel jobs for free and enterprise scanners
        try {
            const freeJobId = await addFreeScanJob(scanId, scan.components || []);
            const enterpriseJobId = await addEnterpriseScanJob(scanId, scan.components || []);

            // Update scan status to scanning
            await this.pool.query(
                `UPDATE scans SET status = 'scanning' WHERE id = $1`,
                [scanId]
            );

            // Publish status update
            await publishScanStatus(scanId, 'scanning', {
                freeJobId,
                enterpriseJobId
            });

            return {
                scanId: scan.id,
                userId: scan.user_id,
                orgId: scan.org_id,
                inputType: scan.input_type,
                inputRef: scan.input_ref,
                status: scan.status,
                planAtSubmission: scan.plan_at_submission,
                createdAt: scan.created_at,
                freeJobId,
                enterpriseJobId
            };
        } catch (error: any) {
            // Refund quota on failure
            await quotaService.refundQuota(scanId, userId);

            // Update scan status to error
            await this.pool.query(
                `UPDATE scans SET status = 'error', error_message = $1 WHERE id = $2`,
                [error.message, scanId]
            );

            throw error;
        }
    }

    /**
     * Handle worker result (free or enterprise scanner completed)
     * @param scanId - Scan ID
     * @param source - Source of result ('free' or 'enterprise')
     * @param result - Worker result data
     */
    async handleWorkerResult(scanId: string, source: 'free' | 'enterprise', result: any): Promise<void> {
        const pool = getPool();

        // Save scan result
        await pool.query(
            `INSERT INTO scan_results (scan_id, source, raw_output, vulnerabilities, scanner_version,
                                       cve_db_timestamp, duration_ms)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (scan_id, source) DO UPDATE SET
                 raw_output = EXCLUDED.raw_output,
                 vulnerabilities = EXCLUDED.vulnerabilities,
                 scanner_version = EXCLUDED.scanner_version,
                 cve_db_timestamp = EXCLUDED.cve_db_timestamp,
                 duration_ms = EXCLUDED.duration_ms`,
            [
                scanId,
                source,
                result.rawOutput,
                result.vulnerabilities,
                result.scannerVersion,
                result.cveDbTimestamp,
                result.durationMs
            ]
        );

        // Check if both scanners have completed
        const resultsResult = await pool.query(
            'SELECT COUNT(*) as count FROM scan_results WHERE scan_id = $1',
            [scanId]
        );

        if (parseInt(resultsResult.rows[0].count) >= 2) {
            // Both scanners completed - finalize the scan
            await this.finalizeScan(scanId);
        }
    }

    /**
     * Handle worker error
     * @param scanId - Scan ID
     * @param source - Source of error ('free' or 'enterprise')
     * @param error - Error details
     */
    async handleWorkerError(scanId: string, source: 'free' | 'enterprise', error: any): Promise<void> {
        const pool = getPool();

        // Check if other scanner has completed
        const otherSource = source === 'free' ? 'enterprise' : 'free';
        const otherResult = await pool.query(
            'SELECT id FROM scan_results WHERE scan_id = $1 AND source = $2',
            [scanId, otherSource]
        );

        if (otherResult.rows.length > 0) {
            // Other scanner succeeded - finalize with partial results
            await this.finalizeScan(scanId, source);
        } else {
            // Both scanners failed or only one failed
            const scanResult = await pool.query(
                'SELECT status FROM scans WHERE id = $1',
                [scanId]
            );

            if (scanResult.rows.length > 0) {
                const status = scanResult.rows[0].status;

                if (status === 'scanning') {
                    // Update to error
                    await pool.query(
                        `UPDATE scans SET status = 'error', error_message = $1, completed_at = NOW()
                         WHERE id = $2`,
                        [error.message || 'Scanner failed', scanId]
                    );
                }
            }
        }
    }

    /**
     * Finalize a scan (both results collected)
     * @param scanId - Scan ID
     * @param partialSource - Source that failed (if partial)
     */
    async finalizeScan(scanId: string, partialSource?: 'free' | 'enterprise'): Promise<void> {
        const pool = getPool();

        // Get both results
        const freeResult = await pool.query(
            'SELECT * FROM scan_results WHERE scan_id = $1 AND source = $2',
            [scanId, 'free']
        );

        const enterpriseResult = await pool.query(
            'SELECT * FROM scan_results WHERE scan_id = $1 AND source = $2',
            [scanId, 'enterprise']
        );

        // Get scan info
        const scanResult = await pool.query(
            'SELECT * FROM scans WHERE id = $1',
            [scanId]
        );

        const scan = scanResult.rows[0];

        // Calculate delta
        const delta = this.computeDelta(
            freeResult.rows[0]?.vulnerabilities || [],
            enterpriseResult.rows[0]?.vulnerabilities || []
        );

        // Save delta
        await pool.query(
            `INSERT INTO scan_deltas (scan_id, total_free_count, total_enterprise_count, delta_count,
                                      delta_by_severity, delta_vulnerabilities, is_locked)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (scan_id) DO UPDATE SET
                 total_free_count = EXCLUDED.total_free_count,
                 total_enterprise_count = EXCLUDED.total_enterprise_count,
                 delta_count = EXCLUDED.delta_count,
                 delta_by_severity = EXCLUDED.delta_by_severity,
                 delta_vulnerabilities = EXCLUDED.delta_vulnerabilities,
                 is_locked = EXCLUDED.is_locked`,
            [
                scanId,
                delta.totalFreeCount,
                delta.totalEnterpriseCount,
                delta.deltaCount,
                JSON.stringify(delta.deltaBySeverity),
                delta.deltaVulnerabilities ? JSON.stringify(delta.deltaVulnerabilities) : null,
                scan.plan_at_submission === 'starter'
            ]
        );

        // Update scan status to done
        await pool.query(
            `UPDATE scans SET status = 'done', completed_at = NOW() WHERE id = $1`,
            [scanId]
        );

        // Publish completion
        await pool.query('SELECT 1'); // Keep connection alive
    }

    /**
     * Compute delta between free and enterprise results
     * @param freeVulns - Free scanner vulnerabilities
     * @param enterpriseVulns - Enterprise scanner vulnerabilities
     * @returns Delta calculation
     */
    private computeDelta(freeVulns: any[], enterpriseVulns: any[]): any {
        // Create sets of CVE IDs
        const freeCves = new Set(freeVulns.map((v: any) => v.cve_id).filter(Boolean));
        const enterpriseCves = new Set(enterpriseVulns.map((v: any) => v.cve_id).filter(Boolean));

        // Find enterprise-only vulnerabilities
        const deltaVulns = enterpriseVulns.filter((v: any) => !freeCves.has(v.cve_id));

        // Calculate severity breakdown
        const deltaBySeverity: any = {
            CRITICAL: 0,
            HIGH: 0,
            MEDIUM: 0,
            LOW: 0
        };

        for (const vuln of deltaVulns) {
            if (vuln.severity in deltaBySeverity) {
                deltaBySeverity[vuln.severity]++;
            }
        }

        return {
            totalFreeCount: freeVulns.length,
            totalEnterpriseCount: enterpriseVulns.length,
            deltaCount: deltaVulns.length,
            deltaBySeverity,
            deltaVulnerabilities: deltaVulns
        };
    }

    /**
     * Get a scan by ID with ownership verification
     * @param scanId - Scan ID
     * @param userId - User ID (for ownership verification)
     * @returns Scan data
     */
    async getScan(scanId: string, userId: string): Promise<any | null> {
        const result = await this.pool.query(
            `SELECT s.*, u.plan as user_plan, o.name as org_name
             FROM scans s
             LEFT JOIN users u ON s.user_id = u.id
             LEFT JOIN organizations o ON s.org_id = o.id
             WHERE s.id = $1 AND (s.user_id = $2 OR s.org_id IN (
                 SELECT id FROM organizations WHERE owner_user_id = $2 OR $2 = ANY(members)
             ))`,
            [scanId, userId]
        );

        return result.rows[0] || null;
    }

    /**
     * List scans with filters
     * @param userId - User ID
     * @param filters - Filters (status, inputType, limit, cursor)
     * @returns Paginated scans
     */
    async listScans(userId: string, filters: any = {}): Promise<any> {
        const { status, inputType, limit = 20, cursor } = filters;

        let query = `
            SELECT id, user_id, org_id, input_type, input_ref, status,
                   plan_at_submission, error_message, created_at, completed_at
            FROM scans
            WHERE user_id = $1
        `;
        const params: any[] = [userId];
        let paramIndex = 2;

        if (status) {
            query += ` AND status = $${paramIndex}`;
            params.push(status);
            paramIndex++;
        }

        if (inputType) {
            query += ` AND input_type = $${paramIndex}`;
            params.push(inputType);
            paramIndex++;
        }

        query += ` ORDER BY created_at DESC LIMIT $${paramIndex}`;
        params.push(parseInt(limit));

        const result = await this.pool.query(query, params);

        return {
            items: result.rows,
            nextCursor: result.rows.length >= parseInt(limit)
                ? (parseInt(cursor || '0') + result.rows.length).toString()
                : undefined,
            total: result.rows.length
        };
    }

    /**
     * Cancel a scan
     * @param scanId - Scan ID
     * @param userId - User ID (for ownership verification)
     */
    async cancelScan(scanId: string, userId: string): Promise<void> {
        // Get scan and verify ownership
        const result = await this.pool.query(
            'SELECT id, user_id, status FROM scans WHERE id = $1',
            [scanId]
        );

        if (result.rows.length === 0) {
            throw { code: 'not_found', message: 'Scan not found' };
        }

        const scan = result.rows[0];

        if (scan.user_id !== userId) {
            throw { code: 'forbidden', message: 'Cannot cancel scans belonging to other users' };
        }

        // Only allow cancellation of pending or scanning scans
        if (!['pending', 'scanning'].includes(scan.status)) {
            throw {
                code: 'conflict',
                message: `Cannot cancel scan with status: ${scan.status}`
            };
        }

        // Update status
        await this.pool.query(
            `UPDATE scans SET status = 'cancelled', completed_at = NOW()
             WHERE id = $1`,
            [scanId]
        );

        // Refund quota
        await quotaService.refundQuota(scanId, userId);
    }
}

export const scanOrchestrator = new ScanOrchestrator();

export default scanOrchestrator;

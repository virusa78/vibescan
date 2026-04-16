/**
 * ScanOrchestrator
 *
 * Coordinates scan submission, dual-scanning pipeline, and result aggregation.
 */

import { v4 as uuidv4 } from 'uuid';
import { getPool } from '../database/client.js';
import { quotaService } from './quotaService.js';
import {
    addFreeScanJob,
    addEnterpriseScanJob,
    getFreeScanQueue,
    getEnterpriseScanQueue,
    getPriorityForPlan,
    getPriorityTierForPlan
} from '../queues/config.js';
import { getRedisClient } from '../redis/client.js';
import { acquireLock, releaseLock } from '../redis/lock.js';
import { publishScanStatus } from '../redis/pubsub.js';
import { computeDelta as computeScanDelta } from './diffEngine.js';
import { canonicalizeVulnerabilities } from './vulnerabilityCanonicalizer.js';
import { securityScoreService } from './securityScoreService.js';

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
            const priorityTier = getPriorityTierForPlan(planAtSubmission);
            const queuePriority = getPriorityForPlan(planAtSubmission);

            const freeJobId = await addFreeScanJob(scanId, scan.components || [], {
                priority: queuePriority,
                scenarioInput: input.scenarioInput,
            });
            const enterpriseJobId = await addEnterpriseScanJob(scanId, scan.components || [], {
                priority: queuePriority
            });

            console.log(`ScanOrchestrator: queued scan ${scanId} with tier=${priorityTier} priority=${queuePriority}`);

            // Update scan status to scanning
            await this.pool.query(
                `UPDATE scans SET status = 'scanning' WHERE id = $1`,
                [scanId]
            );

            // Publish status update
            await publishScanStatus(scanId, 'scanning', {
                freeJobId,
                enterpriseJobId,
                queuePriority,
                priorityTier
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
                enterpriseJobId,
                queuePriority,
                priorityTier
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
        const canonicalVulnerabilities = canonicalizeVulnerabilities(result?.vulnerabilities || [], source);

        // Save scan result
        await pool.query(
            `INSERT INTO scan_results (scan_id, source, raw_output, vulnerabilities, scanner_version,
                                       cve_db_timestamp, duration_ms)
             VALUES ($1, $2, $3::jsonb, $4::jsonb, $5, $6, $7)
             ON CONFLICT (scan_id, source) DO UPDATE SET
                 raw_output = EXCLUDED.raw_output,
                 vulnerabilities = EXCLUDED.vulnerabilities,
                 scanner_version = EXCLUDED.scanner_version,
                 cve_db_timestamp = EXCLUDED.cve_db_timestamp,
                 duration_ms = EXCLUDED.duration_ms`,
            [
                scanId,
                source,
                JSON.stringify(result.rawOutput || {}),
                JSON.stringify(canonicalVulnerabilities),
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

        const resultCount = parseInt(resultsResult.rows[0].count);

        if (resultCount >= 2) {
            // Both scanners completed - finalize the scan
            await this.finalizeScan(scanId);
            return;
        }

        // If scan was marked error by the other worker first, recover to partial done
        const scanStateResult = await pool.query(
            'SELECT status FROM scans WHERE id = $1',
            [scanId]
        );
        const scanStatus = scanStateResult.rows[0]?.status;
        if (scanStatus === 'error' && resultCount >= 1) {
            const failedSource = source === 'free' ? 'enterprise' : 'free';
            await this.finalizeScan(scanId, failedSource);
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
                    try {
                        const { githubIntegrationService } = await import('./githubIntegrationService.js');
                        await githubIntegrationService.handleScanFailed(scanId, error.message || 'Scanner failed');
                    } catch (publishError: any) {
                        console.error(`Failed to publish GitHub check-run failure for ${scanId}:`, publishError?.message || publishError);
                    }
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
        const delta = computeScanDelta(
            canonicalizeVulnerabilities(freeResult.rows[0]?.vulnerabilities || [], 'free'),
            canonicalizeVulnerabilities(enterpriseResult.rows[0]?.vulnerabilities || [], 'enterprise')
        );

        // Save delta (scan_deltas has no unique constraint on scan_id in current schema, so do update-then-insert)
        const deltaUpdateResult = await pool.query(
            `UPDATE scan_deltas
             SET total_free_count = $2,
                 total_enterprise_count = $3,
                 delta_count = $4,
                 delta_by_severity = $5::jsonb,
                 delta_vulnerabilities = $6::jsonb,
                 is_locked = $7
             WHERE scan_id = $1`,
            [
                scanId,
                delta.totalFreeCount,
                delta.totalEnterpriseCount,
                delta.deltaCount,
                JSON.stringify(delta.deltaBySeverity),
                delta.deltaVulnerabilities ? JSON.stringify(delta.deltaVulnerabilities) : null,
                false
            ]
        );

        if ((deltaUpdateResult.rowCount || 0) === 0) {
            await pool.query(
                `INSERT INTO scan_deltas (scan_id, total_free_count, total_enterprise_count, delta_count,
                                          delta_by_severity, delta_vulnerabilities, is_locked)
                 VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7)`,
                [
                    scanId,
                    delta.totalFreeCount,
                    delta.totalEnterpriseCount,
                    delta.deltaCount,
                    JSON.stringify(delta.deltaBySeverity),
                    delta.deltaVulnerabilities ? JSON.stringify(delta.deltaVulnerabilities) : null,
                    false
                ]
            );
        }

        try {
            await securityScoreService.upsertSnapshot(scanId, scan.user_id);
        } catch (error: any) {
            console.error(`Failed to persist security score snapshot for ${scanId}:`, error?.message || error);
        }

        // Update scan status to done
        await pool.query(
            `UPDATE scans SET status = 'done', error_message = NULL, completed_at = NOW() WHERE id = $1`,
            [scanId]
        );

        try {
            const { webhookService } = await import('./webhookService.js');
            await webhookService.scheduleDelivery(scanId);
        } catch (error: any) {
            console.error(`Failed to schedule webhook deliveries for ${scanId}:`, error?.message || error);
        }

        try {
            const { githubIntegrationService } = await import('./githubIntegrationService.js');
            await githubIntegrationService.handleScanCompleted(scanId);
        } catch (error: any) {
            console.error(`Failed to publish GitHub check-run completion for ${scanId}:`, error?.message || error);
        }
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
        const { status, inputType, fromDate, from_date: fromDateSnake, limit = 20, cursor } = filters;
        const fromDateFilter = fromDate ?? fromDateSnake;

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

        if (fromDateFilter) {
            const parsedDate = new Date(fromDateFilter);
            if (Number.isNaN(parsedDate.getTime())) {
                throw {
                    code: 'validation_error',
                    validation_errors: [{ field: 'fromDate', message: 'fromDate/from_date must be a valid ISO date' }]
                };
            }
            query += ` AND created_at >= $${paramIndex}`;
            params.push(parsedDate.toISOString());
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
            throw { code: 'not_found', message: 'Scan not found' };
        }

        // Only allow cancellation of pending or scanning scans
        if (!['pending', 'scanning'].includes(scan.status)) {
            throw {
                code: 'conflict',
                message: `Cannot cancel scan with status: ${scan.status}`,
                status: scan.status,
                cancellation_state: 'not_cancellable'
            };
        }

        const revokeResult = await this.revokeScanQueueJobs(scanId);
        const hasActiveProcessing = revokeResult.activeJobIds.length > 0;

        if (hasActiveProcessing || (scan.status === 'scanning' && revokeResult.removedJobIds.length === 0)) {
            throw {
                code: 'conflict',
                message: 'Scan cancellation conflict: scan is already processing and cannot be revoked',
                status: scan.status,
                cancellation_state: 'processing'
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

    private async revokeScanQueueJobs(scanId: string): Promise<{ removedJobIds: string[]; activeJobIds: string[] }> {
        const [freeQueue, enterpriseQueue] = await Promise.all([
            getFreeScanQueue(),
            getEnterpriseScanQueue(),
        ]);

        const [freeQueueResult, enterpriseQueueResult] = await Promise.all([
            this.revokeScanJobsFromQueue(freeQueue, scanId),
            this.revokeScanJobsFromQueue(enterpriseQueue, scanId),
        ]);

        return {
            removedJobIds: [...freeQueueResult.removedJobIds, ...enterpriseQueueResult.removedJobIds],
            activeJobIds: [...freeQueueResult.activeJobIds, ...enterpriseQueueResult.activeJobIds],
        };
    }

    private async revokeScanJobsFromQueue(queue: any, scanId: string): Promise<{ removedJobIds: string[]; activeJobIds: string[] }> {
        const jobs = await queue.getJobs(['active', 'waiting', 'delayed', 'prioritized', 'paused'], 0, 200);
        const removedJobIds: string[] = [];
        const activeJobIds: string[] = [];

        for (const job of jobs) {
            if (job?.data?.scanId !== scanId) {
                continue;
            }

            const isActive = await job.isActive();
            if (isActive) {
                activeJobIds.push(String(job.id));
                continue;
            }

            try {
                await job.remove();
                removedJobIds.push(String(job.id));
            } catch {
                const stillActive = await job.isActive();
                if (stillActive) {
                    activeJobIds.push(String(job.id));
                }
            }
        }

        return { removedJobIds, activeJobIds };
    }
}

export const scanOrchestrator = new ScanOrchestrator();

export default scanOrchestrator;

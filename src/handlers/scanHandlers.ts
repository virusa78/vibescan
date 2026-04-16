/**
 * Scan handlers
 *
 * Handles /scans/* endpoints
 */

import { scanOrchestrator } from '../services/scanOrchestrator.js';
import { inputAdapterService } from '../services/inputAdapterService.js';
import { githubOrchestratorAdapter } from '../services/githubOrchestratorAdapter.js';
import { getPool } from '../database/client.js';
import {
    getEnterpriseScanQueue,
    getFreeScanQueue,
    getPriorityTierForPlan
} from '../queues/config.js';

/**
 * Submit scan handler
 */
export async function submitScanHandler(request: any, reply: any): Promise<void> {
    const userId = request.apiKey?.user_id || request.user?.userId;

    // Require authentication
    if (!userId) {
        reply.code(401).send({
            error: 'unauthorized',
            message: 'Authentication required'
        });
        return;
    }

    const { inputType, inputRef, sbomRaw, sourceZipKey, githubRepo, githubRef, github } = request.body;

    // Validate input type
    const validInputTypes = ['sbom_upload', 'source_zip', 'github_app', 'ci_plugin'];
    if (!validInputTypes.includes(inputType)) {
        reply.code(400).send({
            error: 'validation_error',
            message: `Invalid input_type. Valid types: ${validInputTypes.join(', ')}`
        });
        return;
    }

    try {
        let components: any[] = [];
        let sbomRawData: any = sbomRaw;
        let scenarioInput: any = null;

        // Process input based on type
        if (inputType === 'source_zip' && sourceZipKey) {
            const result = await inputAdapterService.fromSourceZip(sourceZipKey);
            components = result.components;
            sbomRawData = result.sbomRaw;
            scenarioInput = {
                scenario: 'source_zip',
                s3Key: sourceZipKey,
                inputRef: inputRef || sourceZipKey,
            };
        } else if (inputType === 'github_app') {
            const githubScan = await githubOrchestratorAdapter.submitGithubAppScan(userId, {
                inputRef,
                githubRepo,
                githubRef,
                github,
            }, { resolveComponents: true, trigger: 'manual' });

            reply.code(202).send({
                success: true,
                data: githubScan
            });
            return;
        } else if (inputType === 'sbom_upload' && sbomRaw) {
            // Parse sbomRaw if it's a string
            const parsedSbom = typeof sbomRaw === 'string' ? JSON.parse(sbomRaw) : sbomRaw;
            // Validate SBOM first
            const validation = inputAdapterService.validateCycloneDX(parsedSbom);
            if (!validation.valid) {
                reply.code(400).send({
                    error: 'invalid_sbom',
                    message: 'SBOM validation failed',
                    validation_errors: validation.errors
                });
                return;
            }
            // sbomRawData is already set from sbomRaw at the start
            // Extract components from the validated SBOM
            try {
                components = parsedSbom.components || [];
            } catch (e) {
                reply.code(400).send({
                    error: 'invalid_sbom',
                    message: 'Failed to parse SBOM JSON'
                });
                return;
            }
            scenarioInput = {
                scenario: 'sbom_upload',
                sbomRaw: parsedSbom,
                inputRef: inputRef || 'inline-sbom',
            };
        }

        // Submit scan via orchestrator
        const scan = await scanOrchestrator.submitScan(userId, inputType, {
            inputRef: inputRef || (sourceZipKey || githubRepo || github?.repo || ''),
            sbomRaw: sbomRawData,
            components,
            scenarioInput,
        });

        reply.code(202).send({
            success: true,
            data: scan
        });
    } catch (error: any) {
        if (error.code === 'quota_exceeded') {
            reply.code(429).send({
                error: 'quota_exceeded',
                message: error.message,
                remaining: error.remaining,
                resetAt: error.resetAt.toISOString()
            });
        } else if (error.code === 'validation_error') {
            reply.code(400).send({
                error: 'validation_error',
                message: error.message,
                validation_errors: error.validation_errors,
            });
        } else if (error.code === 'invalid_sbom') {
            reply.code(400).send({
                error: 'invalid_sbom',
                message: error.message,
                validation_errors: error.validation_errors
            });
        } else if (error.code === 'payload_too_large') {
            reply.code(413).send({
                error: 'payload_too_large',
                message: error.message,
                maxSizeBytes: error.maxSizeBytes,
                actualSizeBytes: error.actualSizeBytes
            });
        } else {
            reply.code(500).send({
                error: 'internal_error',
                message: error.message || 'Failed to process scan'
            });
        }
    }
}

/**
 * Get scan status handler
 */
export async function getScanStatusHandler(request: any, reply: any): Promise<void> {
    const userId = request.apiKey?.user_id || request.user?.userId;
    const { id: scanId } = request.params;

    if (!userId) {
        reply.code(401).send({
            error: 'unauthorized',
            message: 'Authentication required'
        });
        return;
    }

    const pool = getPool();

    // Verify ownership
    const result = await pool.query(
        `SELECT s.id, s.user_id, s.org_id, s.input_type, s.input_ref, s.status,
                s.plan_at_submission, s.error_message, s.created_at, s.completed_at,
                u.plan as user_plan
         FROM scans s
         JOIN users u ON s.user_id = u.id
         WHERE s.id = $1 AND (s.user_id = $2 OR s.org_id IN (
             SELECT id FROM organizations WHERE owner_user_id = $2 OR $2 = ANY(members)
         ))`,
        [scanId, userId]
    );

    if (result.rows.length === 0) {
        reply.code(404).send({
            error: 'not_found',
            message: 'Scan not found'
        });
        return;
    }

    const scan = result.rows[0];

    // Get scan results
    const resultsResult = await pool.query(
        `SELECT id, source, raw_output, vulnerabilities, scanner_version,
                cve_db_timestamp, duration_ms, created_at
         FROM scan_results WHERE scan_id = $1`,
        [scanId]
    );

    // Get scan delta
    const deltaResult = await pool.query(
        `SELECT id, total_free_count, total_enterprise_count, delta_count,
                delta_by_severity, delta_vulnerabilities, is_locked, created_at
         FROM scan_deltas WHERE scan_id = $1`,
        [scanId]
    );

    reply.code(200).send({
        success: true,
        data: {
            scan: {
                id: scan.id,
                userId: scan.user_id,
                orgId: scan.org_id,
                inputType: scan.input_type,
                inputRef: scan.input_ref,
                status: scan.status,
                planAtSubmission: scan.plan_at_submission,
                errorMessage: scan.error_message,
                createdAt: scan.created_at,
                completedAt: scan.completed_at
            },
            results: resultsResult.rows,
            delta: deltaResult.rows[0] || null
        }
    });
}

/**
 * Cancel scan handler
 */
export async function cancelScanHandler(request: any, reply: any): Promise<void> {
    const userId = request.apiKey?.user_id || request.user?.userId;
    const { id: scanId } = request.params;

    if (!userId) {
        reply.code(401).send({
            error: 'unauthorized',
            message: 'Authentication required'
        });
        return;
    }

    try {
        await scanOrchestrator.cancelScan(scanId, userId);
        reply.code(204).send();
    } catch (error: any) {
        if (error.code === 'not_found') {
            reply.code(404).send({
                error: 'not_found',
                message: 'Scan not found'
            });
            return;
        }

        if (error.code === 'conflict') {
            reply.code(409).send({
                error: 'conflict',
                message: error.message || 'Scan cancellation conflict',
                status: error.status,
                cancellation_state: error.cancellation_state
            });
            return;
        }

        reply.code(500).send({
            error: 'internal_error',
            message: error.message || 'Failed to cancel scan'
        });
    }
}

/**
 * List scans handler
 */
export async function listScansHandler(request: any, reply: any): Promise<void> {
    const userId = request.apiKey?.user_id || request.user?.userId;

    // Require authentication
    if (!userId) {
        reply.code(401).send({
            error: 'unauthorized',
            message: 'Authentication required'
        });
        return;
    }

    const { limit = 20, cursor, status, inputType, fromDate, from_date: fromDateSnake } = request.query;
    const fromDateFilter = fromDate ?? fromDateSnake;

    const pool = getPool();

    // Build query with filters
    let query = `
        SELECT s.id, s.user_id, s.org_id, s.input_type, s.input_ref, s.status,
               s.plan_at_submission, s.error_message, s.created_at, s.completed_at,
               COALESCE(sd.total_free_count, 0) AS free_vulns,
               COALESCE(sd.total_enterprise_count, 0) AS enterprise_vulns,
               COALESCE(sd.delta_count, 0) AS delta_count,
               COALESCE((sd.delta_by_severity->>'CRITICAL')::int, 0) AS critical_count,
               COALESCE(sd.is_locked, false) AS locked
        FROM scans s
        LEFT JOIN scan_deltas sd ON sd.scan_id = s.id
        WHERE s.user_id = $1
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
            reply.code(400).send({
                error: 'validation_error',
                validation_errors: [{ field: 'fromDate', message: 'fromDate/from_date must be a valid ISO date' }]
            });
            return;
        }
        query += ` AND s.created_at >= $${paramIndex}`;
        params.push(parsedDate.toISOString());
        paramIndex++;
    }

    query += ` ORDER BY s.created_at DESC LIMIT $${paramIndex}`;
    params.push(parseInt(limit));

    const result = await pool.query(query, params);

    reply.code(200).send({
        success: true,
        data: {
            items: result.rows,
            nextCursor: result.rows.length >= parseInt(limit)
                ? (parseInt(cursor || '0') + result.rows.length).toString()
                : null,
            total: result.rows.length
        }
    });
}

function toRelativeTime(isoTimestamp: string): string {
    const now = Date.now();
    const then = new Date(isoTimestamp).getTime();
    const diffSeconds = Math.max(0, Math.floor((now - then) / 1000));
    if (diffSeconds < 60) return `${diffSeconds}s ago`;
    const minutes = Math.floor(diffSeconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

function emptySeverityCounts() {
    return {
        CRITICAL: 0,
        HIGH: 0,
        MEDIUM: 0,
        LOW: 0
    };
}

/**
 * Dashboard summary handler
 */
export async function getDashboardSummaryHandler(request: any, reply: any): Promise<void> {
    const userId = request.apiKey?.user_id || request.user?.userId;
    if (!userId) {
        reply.code(401).send({
            error: 'unauthorized',
            message: 'Authentication required'
        });
        return;
    }

    const pool = getPool();

    const [statusAgg, quotaAgg, recentScans, volumeRows, resultRows] = await Promise.all([
        pool.query(
            `SELECT
                COUNT(*)::int AS total_scans,
                COUNT(*) FILTER (WHERE status = 'done')::int AS completed_scans,
                COUNT(*) FILTER (WHERE status = 'pending')::int AS pending_scans,
                COUNT(*) FILTER (WHERE status = 'scanning')::int AS scanning_scans,
                COUNT(*) FILTER (WHERE status = 'error')::int AS failed_scans,
                COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled_scans,
                COUNT(*) FILTER (WHERE created_at >= date_trunc('day', NOW()))::int AS scans_today,
                COALESCE(SUM(CASE WHEN created_at >= date_trunc('day', NOW()) AND status = 'done' THEN 1 ELSE 0 END), 0)::int AS completed_today
            FROM scans
            WHERE user_id = $1`,
            [userId]
        ),
        pool.query(
            `SELECT scans_used, scans_limit
             FROM quota_ledger
             WHERE user_id = $1 AND month = TO_CHAR(NOW(), 'YYYY-MM')
             LIMIT 1`,
            [userId]
        ),
        pool.query(
            `SELECT s.id, s.input_type, s.input_ref, s.status, s.plan_at_submission, s.created_at, s.completed_at,
                    COALESCE(sd.total_free_count, 0) AS free_vulns,
                    COALESCE(sd.total_enterprise_count, 0) AS enterprise_vulns,
                    COALESCE(sd.delta_count, 0) AS delta_count,
                    COALESCE((sd.delta_by_severity->>'CRITICAL')::int, 0) AS critical_count,
                    COALESCE(sd.is_locked, false) AS locked
             FROM scans s
             LEFT JOIN scan_deltas sd ON sd.scan_id = s.id
             WHERE s.user_id = $1
             ORDER BY s.created_at DESC
             LIMIT 10`,
            [userId]
        ),
        pool.query(
            `SELECT DATE_TRUNC('day', s.created_at) AS bucket_day,
                    COUNT(*)::int AS scans,
                    COALESCE(SUM(sd.total_free_count), 0)::int AS free_vulns,
                    COALESCE(SUM(sd.total_enterprise_count), 0)::int AS enterprise_vulns
             FROM scans s
             LEFT JOIN scan_deltas sd ON sd.scan_id = s.id
             WHERE s.user_id = $1 AND s.created_at >= NOW() - INTERVAL '13 days'
             GROUP BY DATE_TRUNC('day', s.created_at)
             ORDER BY bucket_day ASC`,
            [userId]
        ),
        pool.query(
            `SELECT sr.source, sr.vulnerabilities, sr.duration_ms
             FROM scan_results sr
             JOIN scans s ON s.id = sr.scan_id
             WHERE s.user_id = $1
             ORDER BY sr.created_at DESC
             LIMIT 200`,
            [userId]
        ),
    ]);

    const status = statusAgg.rows[0] || {
        total_scans: 0,
        completed_scans: 0,
        pending_scans: 0,
        scanning_scans: 0,
        failed_scans: 0,
        cancelled_scans: 0,
        scans_today: 0,
        completed_today: 0
    };
    const quota = quotaAgg.rows[0] || { scans_used: 0, scans_limit: 0 };

    const severityFree = emptySeverityCounts();
    const severityEnterprise = emptySeverityCounts();
    let criticalVulns = 0;
    let exploitableVulns = 0;
    let durationSumMs = 0;
    let durationCount = 0;

    for (const row of resultRows.rows) {
        const vulns = Array.isArray(row.vulnerabilities) ? row.vulnerabilities : [];
        if (typeof row.duration_ms === 'number') {
            durationSumMs += row.duration_ms;
            durationCount++;
        }
        for (const vuln of vulns) {
            const severity = String(vuln?.severity || '').toUpperCase();
            if (!['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(severity)) continue;
            if (severity === 'CRITICAL') criticalVulns++;
            if (vuln?.is_exploitable === true) exploitableVulns++;

            if (row.source === 'free') {
                (severityFree as any)[severity] += 1;
            } else if (row.source === 'enterprise') {
                (severityEnterprise as any)[severity] += 1;
            }
        }
    }

    const volumeByDate = new Map<string, { scans: number; freeVulns: number; enterpriseVulns: number }>();
    for (const row of volumeRows.rows) {
        const key = new Date(row.bucket_day).toISOString().slice(0, 10);
        volumeByDate.set(key, {
            scans: Number(row.scans || 0),
            freeVulns: Number(row.free_vulns || 0),
            enterpriseVulns: Number(row.enterprise_vulns || 0)
        });
    }

    const scanVolume: Array<{ date: string; scans: number; freeVulns: number; enterpriseVulns: number }> = [];
    for (let i = 13; i >= 0; i--) {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        const bucket = volumeByDate.get(key) || { scans: 0, freeVulns: 0, enterpriseVulns: 0 };
        scanVolume.push({
            date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            scans: bucket.scans,
            freeVulns: bucket.freeVulns,
            enterpriseVulns: bucket.enterpriseVulns
        });
    }

    const severityBreakdown = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((severity) => ({
        severity,
        free: (severityFree as any)[severity] || 0,
        enterprise: (severityEnterprise as any)[severity] || 0,
        delta: ((severityEnterprise as any)[severity] || 0) - ((severityFree as any)[severity] || 0)
    }));

    const activity = recentScans.rows.slice(0, 8).map((scan: any, index: number) => ({
        id: `scan-${scan.id}-${index}`,
        type: scan.status,
        title: scan.status === 'done'
            ? 'Scan completed'
            : scan.status === 'error'
                ? 'Scan failed'
                : scan.status === 'scanning'
                    ? 'Scan running'
                    : scan.status === 'pending'
                        ? 'Scan queued'
                        : 'Scan updated',
        detail: `${scan.input_ref} · ${scan.plan_at_submission}`,
        severity: scan.status === 'done'
            ? 'success'
            : scan.status === 'error'
                ? 'error'
                : scan.status === 'scanning'
                    ? 'warning'
                    : 'info',
        time: toRelativeTime(scan.created_at)
    }));

    const recentScanItems = recentScans.rows.map((scan: any) => ({
        id: scan.id,
        label: scan.input_ref,
        input_type: scan.input_type,
        input_ref: scan.input_ref,
        status: scan.status,
        plan_at_submission: scan.plan_at_submission,
        free_vulns: Number(scan.free_vulns || 0),
        enterprise_vulns: Number(scan.enterprise_vulns || 0),
        delta_count: Number(scan.delta_count || 0),
        critical_count: Number(scan.critical_count || 0),
        duration: scan.completed_at
            ? `${Math.max(1, Math.round((new Date(scan.completed_at).getTime() - new Date(scan.created_at).getTime()) / 1000))}s`
            : '--',
        submitted_at: scan.created_at,
        locked: Boolean(scan.locked)
    }));

    reply.code(200).send({
        success: true,
        data: {
            lastUpdated: new Date().toISOString(),
            metrics: {
                totalScans: Number(status.total_scans || 0),
                completedScans: Number(status.completed_scans || 0),
                pendingScans: Number(status.pending_scans || 0),
                scanningScans: Number(status.scanning_scans || 0),
                failedScans: Number(status.failed_scans || 0),
                cancelledScans: Number(status.cancelled_scans || 0),
                scansToday: Number(status.scans_today || 0),
                criticalVulns,
                exploitableVulns,
                freeVulns: recentScanItems.reduce((acc: number, s: any) => acc + Number(s.free_vulns || 0), 0),
                enterpriseVulns: recentScanItems.reduce((acc: number, s: any) => acc + Number(s.enterprise_vulns || 0), 0),
                deltaVulns: recentScanItems.reduce((acc: number, s: any) => acc + Number(s.delta_count || 0), 0),
                avgScanDurationSeconds: durationCount > 0 ? Math.round((durationSumMs / durationCount) / 1000) : 0,
                quotaUsed: Number(quota.scans_used || 0),
                quotaLimit: Number(quota.scans_limit || 0)
            },
            scanVolume,
            severityBreakdown,
            recentScans: recentScanItems,
            activity
        }
    });
}

/**
 * Queue priority visibility handler
 */
export async function getQueuePriorityHandler(request: any, reply: any): Promise<void> {
    const userId = request.apiKey?.user_id || request.user?.userId;
    if (!userId) {
        reply.code(401).send({
            error: 'unauthorized',
            message: 'Authentication required'
        });
        return;
    }

    const pool = getPool();
    const freeQueue = await getFreeScanQueue();
    const enterpriseQueue = await getEnterpriseScanQueue();

    const [freeWaiting, enterpriseWaiting] = await Promise.all([
        freeQueue.getJobs(['waiting'], 0, 99, true),
        enterpriseQueue.getJobs(['waiting'], 0, 99, true)
    ]);

    const scanIds = [...new Set([
        ...freeWaiting.map((job: any) => job.data?.scanId).filter(Boolean),
        ...enterpriseWaiting.map((job: any) => job.data?.scanId).filter(Boolean),
    ])];

    const scanPlanMap = new Map<string, string>();
    if (scanIds.length > 0) {
        const plans = await pool.query(
            'SELECT id, plan_at_submission FROM scans WHERE id = ANY($1::uuid[])',
            [scanIds]
        );
        for (const row of plans.rows) {
            scanPlanMap.set(row.id, row.plan_at_submission);
        }
    }

    const mapJobs = (jobs: any[]) => jobs.map((job: any) => {
        const scanId = job.data?.scanId;
        const plan = scanPlanMap.get(scanId) || 'free_trial';
        return {
            jobId: job.id,
            scanId,
            planAtSubmission: plan,
            tier: getPriorityTierForPlan(plan),
            priority: job.opts?.priority ?? null,
            enqueuedAt: new Date(job.timestamp).toISOString()
        };
    });

    const freeItems = mapJobs(freeWaiting);
    const enterpriseItems = mapJobs(enterpriseWaiting);

    const bucketCounts = (items: any[]) => items.reduce((acc: Record<string, number>, item: any) => {
        acc[item.tier] = (acc[item.tier] || 0) + 1;
        return acc;
    }, { high: 0, medium: 0, low: 0 });

    reply.code(200).send({
        success: true,
        data: {
            freeQueue: {
                waiting: freeItems.length,
                bucketCounts: bucketCounts(freeItems),
                items: freeItems
            },
            enterpriseQueue: {
                waiting: enterpriseItems.length,
                bucketCounts: bucketCounts(enterpriseItems),
                items: enterpriseItems
            },
            priorityPolicy: {
                high: ['enterprise'],
                medium: ['pro'],
                low: ['starter', 'free_trial'],
                fifoWithinTier: true
            }
        }
    });
}

export default {
    submitScanHandler,
    getScanStatusHandler,
    cancelScanHandler,
    listScansHandler,
    getDashboardSummaryHandler,
    getQueuePriorityHandler
};

/**
 * Scan handlers
 *
 * Handles /scans/* endpoints
 */

import { scanOrchestrator } from '../services/scanOrchestrator.js';
import { inputAdapterService } from '../services/inputAdapterService.js';
import { QuotaCheckResult } from '../services/quotaService.js';
import { getPool } from '../database/client.js';
import { refundQuota } from '../redis/quota.js';

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

    const { inputType, inputRef, sbomRaw, sourceZipKey, githubRepo, githubRef } = request.body;

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

        // Process input based on type
        if (inputType === 'source_zip' && sourceZipKey) {
            const result = await inputAdapterService.fromSourceZip(sourceZipKey);
            components = result.components;
            sbomRawData = result.sbomRaw;
        } else if (inputType === 'github_app' && githubRepo) {
            const result = await inputAdapterService.fromGithubUrl(githubRepo, githubRef || 'HEAD');
            components = result.components;
            sbomRawData = result.sbomRaw;
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
        }

        // Submit scan via orchestrator
        const scan = await scanOrchestrator.submitScan(userId, inputType, {
            inputRef: inputRef || (sourceZipKey || githubRepo || ''),
            sbomRaw: sbomRawData,
            components
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
        } else if (error.code === 'invalid_sbom') {
            reply.code(400).send({
                error: 'invalid_sbom',
                message: error.message,
                validation_errors: error.validation_errors
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

    const pool = getPool();

    // Get scan and verify ownership
    const result = await pool.query(
        `SELECT id, user_id, status FROM scans WHERE id = $1`,
        [scanId]
    );

    if (result.rows.length === 0) {
        reply.code(404).send({
            error: 'not_found',
            message: 'Scan not found'
        });
        return;
    }

    const scan = result.rows[0];

    if (scan.user_id !== userId) {
        reply.code(403).send({
            error: 'forbidden',
            message: 'Cannot cancel scans belonging to other users'
        });
        return;
    }

    // Only allow cancellation of pending or scanning scans
    if (!['pending', 'scanning'].includes(scan.status)) {
        reply.code(409).send({
            error: 'conflict',
            message: `Cannot cancel scan with status: ${scan.status}`
        });
        return;
    }

    // Update status
    await pool.query(
        `UPDATE scans SET status = 'cancelled', completed_at = NOW()
         WHERE id = $1`,
        [scanId]
    );

    // Refund quota
    await refundQuota(userId);

    reply.code(204).send();
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

    const { limit = 20, cursor, status, inputType } = request.query;

    const pool = getPool();

    // Build query with filters
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

export default {
    submitScanHandler,
    getScanStatusHandler,
    cancelScanHandler,
    listScansHandler
};

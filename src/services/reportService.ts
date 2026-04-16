/**
 * ReportService
 *
 * Generates report views with starter-plan delta lock enforcement.
 */

import { merge as diffMerge, rankVulnerabilities } from './diffEngine.js';
import { getPool } from '../database/client.js';
import { v4 as uuidv4 } from 'uuid';
import { getReportAccessPolicy } from './reportAccessPolicy.js';
import { addReportGenerationJob, getPriorityForPlan } from '../queues/config.js';
import { BUCKET_PDFS, generatePresignedUrl, uploadFile } from '../s3/client.js';

/**
 * ReportService
 */
export class ReportService {
    private pool: any;

    constructor() {
        this.pool = getPool();
    }

    /**
     * Build report view based on user plan
     * @param scanId - Scan ID
     * @param userId - User ID
     * @param format - Report format (json, summary, pdf, ci)
     * @returns Report view
     */
    async buildReportView(
        scanId: string,
        userId: string,
        format: 'json' | 'summary' | 'pdf' | 'ci' = 'json'
    ): Promise<any> {
        // Get scan and verify ownership
        const scan = await this.getScanWithOwnership(scanId, userId);
        if (!scan) {
            throw { code: 'not_found', message: 'Scan not found' };
        }

        // Get scan delta
        const delta = await this.getScanDelta(scanId);
        if (!delta) {
            throw { code: 'not_found', message: 'Scan delta not found' };
        }

        // Get scan results
        const results = await this.getScanResults(scanId);

        if (getReportAccessPolicy(scan.plan_at_submission).locked) {
            return this.buildLockedView(scan, delta, results, format);
        }

        return this.buildFullView(scan, delta, results, format);
    }

    /**
     * Build locked view for starter plan.
     * Free vulnerabilities are visible, enterprise/delta details are hidden.
     */
    buildLockedView(
        scan: any,
        delta: any,
        results: any,
        format: 'json' | 'summary' | 'pdf' | 'ci'
    ): any {
        const freeResult = results.find((r: any) => r.source === 'free');
        const freeVulns = freeResult?.vulnerabilities || [];

        const report: any = {
            scanId: scan.id,
            status: scan.status,
            plan: scan.plan_at_submission,
            freeVulnerabilities: freeVulns,
            enterpriseVulnerabilities: null,
            mergedVulnerabilities: null,
            deltaCount: delta.delta_count,
            deltaBySeverity: delta.delta_by_severity,
            deltaVulnerabilities: null,
            totalFreeCount: delta.total_free_count,
            totalEnterpriseCount: delta.total_enterprise_count,
            createdAt: scan.created_at,
            locked: true
        };

        if (format === 'summary') {
            return {
                ...report,
                freeVulnerabilities: null
            };
        }

        if (format === 'pdf') {
            return {
                ...report,
                hasDeltaDetails: false
            };
        }

        if (format === 'ci') {
            return this.buildCiDecision(freeVulns);
        }

        return report;
    }

    /**
     * Build full view for pro/enterprise plan
     * Full delta details exposed
     * @param scan - Scan record
     * @param delta - Scan delta
     * @param results - Scan results
     * @param format - Report format
     * @returns Full report view
     */
    buildFullView(
        scan: any,
        delta: any,
        results: any,
        format: 'json' | 'summary' | 'pdf' | 'ci'
    ): any {
        // Get both results
        const freeResult = results.find((r: any) => r.source === 'free');
        const enterpriseResult = results.find((r: any) => r.source === 'enterprise');

        const freeVulns = freeResult?.vulnerabilities || [];
        const enterpriseVulns = enterpriseResult?.vulnerabilities || [];

        // Merge vulnerabilities
        const mergedVulns = diffMerge(freeVulns, enterpriseVulns);
        const rankedVulns = rankVulnerabilities(mergedVulns);

        const report: any = {
            scanId: scan.id,
            status: scan.status,
            plan: scan.plan_at_submission,
            freeVulnerabilities: freeVulns,
            enterpriseVulnerabilities: enterpriseVulns,
            mergedVulnerabilities: rankedVulns,
            deltaCount: delta.delta_count,
            deltaBySeverity: delta.delta_by_severity,
            deltaVulnerabilities: delta.delta_vulnerabilities || [],
            totalFreeCount: delta.total_free_count,
            totalEnterpriseCount: delta.total_enterprise_count,
            createdAt: scan.created_at,
            locked: false
        };

        // Handle format-specific responses
        if (format === 'summary') {
            return {
                ...report,
                freeVulnerabilities: null,
                enterpriseVulnerabilities: null,
                mergedVulnerabilities: null,
                deltaVulnerabilities: null
            };
        }

        if (format === 'pdf') {
            return {
                ...report,
                hasDeltaDetails: true
            };
        }

        if (format === 'ci') {
            return this.buildCiDecision(mergedVulns);
        }

        return report;
    }

    /**
     * Generate PDF report (async)
     * @param scanId - Scan ID
     * @param userId - User ID
     * @returns Job ID for async PDF generation
     */
    async generatePdf(scanId: string, userId: string): Promise<{ jobId: string; job_id: string }> {
        // Verify access
        const scan = await this.getScanWithOwnership(scanId, userId);
        if (!scan) {
            throw { code: 'not_found', message: 'Scan not found' };
        }

        if (scan.status !== 'done') {
            throw { code: 'conflict', message: 'Scan must be completed before requesting PDF' };
        }

        // Generate job ID
        const jobId = uuidv4();
        const queuePriority = getPriorityForPlan(scan.plan_at_submission || 'starter');

        await this.pool.query(
            `INSERT INTO report_generation_jobs (job_id, scan_id, user_id, format, status)
             VALUES ($1, $2, $3, 'pdf', 'queued')`,
            [jobId, scanId, userId]
        );

        await addReportGenerationJob(jobId, scanId, userId, 'pdf', { priority: queuePriority });
        await this.publishReportStatusSafe(jobId, 'queued', { scanId, format: 'pdf' });

        return { jobId, job_id: jobId };
    }

    /**
     * Process report generation job from queue.
     */
    async processReportGenerationJob(jobData: {
        reportId?: string;
        scanId?: string;
        userId?: string;
        format?: 'pdf' | 'json' | 'summary';
    }): Promise<void> {
        const reportId = jobData?.reportId;
        const scanId = jobData?.scanId;
        const userId = jobData?.userId;
        const format = jobData?.format;

        if (!reportId || !scanId || !userId || format !== 'pdf') {
            throw {
                code: 'validation_error',
                message: 'Invalid report generation job payload'
            };
        }

        await this.pool.query(
            `UPDATE report_generation_jobs
             SET status = 'processing', error_message = NULL, updated_at = NOW()
             WHERE job_id = $1`,
            [reportId]
        );
        await this.publishReportStatusSafe(reportId, 'processing', { scanId, format });

        try {
            const report = await this.buildReportView(scanId, userId, 'pdf');
            const pdfBuffer = this.renderPdfBuffer(report);
            const s3Key = `reports/${scanId}/${reportId}.pdf`;
            await uploadFile(BUCKET_PDFS, s3Key, pdfBuffer, 'application/pdf');
            const artifactUrl = await generatePresignedUrl(BUCKET_PDFS, s3Key, 86400);

            await this.pool.query(
                `UPDATE report_generation_jobs
                 SET status = 'completed',
                     s3_key = $2,
                     artifact_url = $3,
                     completed_at = NOW(),
                     updated_at = NOW()
                 WHERE job_id = $1`,
                [reportId, s3Key, artifactUrl]
            );

            await this.publishReportStatusSafe(reportId, 'completed', {
                scanId,
                format,
                artifactUrl,
                s3Key
            });
        } catch (error: any) {
            const message = error?.message || 'Report generation failed';
            await this.pool.query(
                `UPDATE report_generation_jobs
                 SET status = 'failed',
                     error_message = $2,
                     completed_at = NOW(),
                     updated_at = NOW()
                 WHERE job_id = $1`,
                [reportId, message]
            );
            await this.publishReportStatusSafe(reportId, 'failed', { scanId, format, error: message });
            throw error;
        }
    }

    /**
     * Get report generation status.
     */
    async getPdfGenerationStatus(jobId: string, userId: string): Promise<any> {
        const result = await this.pool.query(
            `SELECT job_id, scan_id, user_id, status, format, s3_key, artifact_url, error_message,
                    created_at, completed_at, updated_at
             FROM report_generation_jobs
             WHERE job_id = $1 AND user_id = $2`,
            [jobId, userId]
        );

        if (result.rows.length === 0) {
            throw { code: 'not_found', message: 'Report job not found' };
        }

        const row = result.rows[0];
        const response: any = {
            jobId: row.job_id,
            job_id: row.job_id,
            scanId: row.scan_id,
            status: row.status,
            format: row.format,
            createdAt: row.created_at,
            completedAt: row.completed_at,
            updatedAt: row.updated_at,
            artifact: row.s3_key ? {
                s3Key: row.s3_key,
                url: row.artifact_url
            } : null
        };

        if (row.error_message) {
            response.error = row.error_message;
        }

        return response;
    }

    /**
     * Get CI decision based on scan results
     * @param scanId - Scan ID
     * @param userId - User ID
     * @param thresholdSeverity - Severity threshold (CRITICAL, HIGH, MEDIUM, LOW)
     * @returns CI decision
     */
    async getCiDecision(
        scanId: string,
        userId: string,
        thresholdSeverity: string = 'HIGH'
    ): Promise<any> {
        const normalizedThreshold = this.normalizeThresholdSeverity(thresholdSeverity);
        const scan = await this.getScanWithOwnership(scanId, userId);
        if (!scan) {
            throw { code: 'not_found', message: 'Scan not found' };
        }

        const results = await this.getScanResults(scanId);
        const freeVulns = results.find((r: any) => r.source === 'free')?.vulnerabilities || [];
        const enterpriseVulns = results.find((r: any) => r.source === 'enterprise')?.vulnerabilities || [];
        const mergedVulns = diffMerge(freeVulns, enterpriseVulns);
        const policy = getReportAccessPolicy(scan.plan_at_submission);

        const ciVulnerabilities = policy.ciVisibilityScope === 'free' ? freeVulns : mergedVulns;
        return this.buildCiDecision(ciVulnerabilities, normalizedThreshold);
    }

    /**
     * Build CI decision from vulnerabilities
     */
    private buildCiDecision(vulnerabilities: any[], thresholdSeverity: string = 'HIGH'): any {
        const severityOrder: Record<string, number> = {
            CRITICAL: 0,
            HIGH: 1,
            MEDIUM: 2,
            LOW: 3,
            INFO: 4
        };

        const normalizedThreshold = this.normalizeThresholdSeverity(thresholdSeverity);
        const thresholdOrder = severityOrder[normalizedThreshold];

        let maxSeverity: string = 'NONE';
        let maxSeverityOrder = Number.POSITIVE_INFINITY;
        const blockingVulns: any[] = [];

        for (const vuln of vulnerabilities) {
            const severity = this.normalizeSeverity(vuln?.severity);
            const severityOrderVal = severityOrder[severity] ?? 3;

            if (severityOrderVal < maxSeverityOrder) {
                maxSeverity = severity;
                maxSeverityOrder = severityOrderVal;
            }

            if (severityOrderVal <= thresholdOrder) {
                blockingVulns.push(vuln);
            }
        }

        const pass = blockingVulns.length === 0;

        return {
            pass,
            thresholdSeverity: normalizedThreshold,
            maxSeverity,
            blockingCount: blockingVulns.length,
            exitCode: pass ? 0 : 1,
            blockingVulns
        };
    }

    /**
     * Get scan with ownership verification
     */
    private async getScanWithOwnership(scanId: string, userId: string): Promise<any | null> {
        const result = await this.pool.query(
            `SELECT s.*, u.plan as user_plan
             FROM scans s
             JOIN users u ON s.user_id = u.id
             WHERE s.id = $1 AND (s.user_id = $2 OR s.org_id IN (
                 SELECT id FROM organizations WHERE owner_user_id = $2 OR $2 = ANY(members)
             ))`,
            [scanId, userId]
        );

        return result.rows[0] || null;
    }

    /**
     * Get scan delta
     */
    private async getScanDelta(scanId: string): Promise<any | null> {
        const result = await this.pool.query(
            'SELECT * FROM scan_deltas WHERE scan_id = $1',
            [scanId]
        );

        return result.rows[0] || null;
    }

    /**
     * Get scan results
     */
    private async getScanResults(scanId: string): Promise<any[]> {
        const result = await this.pool.query(
            'SELECT * FROM scan_results WHERE scan_id = $1',
            [scanId]
        );

        return result.rows;
    }

    /**
     * Get quota status for user
     */
    async getQuotaStatus(userId: string): Promise<any> {
        const result = await this.pool.query(
            `SELECT scans_used, scans_limit, reset_at
             FROM quota_ledger
             WHERE user_id = $1
             ORDER BY created_at DESC
             LIMIT 1`,
            [userId]
        );

        if (result.rows.length === 0) {
            return { used: 0, limit: 0, remaining: 0, resetAt: new Date() };
        }

        const row = result.rows[0];
        return {
            used: row.scans_used,
            limit: row.scans_limit,
            remaining: row.scans_limit - row.scans_used,
            resetAt: row.reset_at
        };
    }

    private normalizeThresholdSeverity(thresholdSeverity: string): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO' {
        const normalized = String(thresholdSeverity || 'HIGH').toUpperCase();
        if (!['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'].includes(normalized)) {
            throw {
                code: 'validation_error',
                message: 'Invalid thresholdSeverity. Valid values: CRITICAL, HIGH, MEDIUM, LOW, INFO',
                validation_errors: [
                    {
                        field: 'thresholdSeverity',
                        message: 'thresholdSeverity must be one of: CRITICAL, HIGH, MEDIUM, LOW, INFO'
                    }
                ]
            };
        }
        return normalized as 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
    }

    private normalizeSeverity(severity: string | undefined | null): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO' {
        const normalized = String(severity || 'LOW').toUpperCase();
        if (['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'].includes(normalized)) {
            return normalized as 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
        }
        return 'LOW';
    }

    private renderPdfBuffer(report: any): Buffer {
        const lines = [
            'VibeScan Report',
            `Scan ID: ${report.scanId}`,
            `Plan: ${report.plan}`,
            `Status: ${report.status}`,
            `Delta Count: ${report.deltaCount}`,
            `Locked: ${report.locked ? 'yes' : 'no'}`,
            `Generated At: ${new Date().toISOString()}`
        ];
        const text = lines.join('\n');
        return this.createMinimalPdf(text);
    }

    private createMinimalPdf(text: string): Buffer {
        const safeText = text
            .replace(/\\/g, '\\\\')
            .replace(/\(/g, '\\(')
            .replace(/\)/g, '\\)');

        const objects: string[] = [];
        objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
        objects[2] = '<< /Type /Pages /Kids [3 0 R] /Count 1 >>';
        objects[3] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>';

        const textLines = safeText.split('\n');
        const content = [
            'BT',
            '/F1 12 Tf',
            '50 740 Td',
            `(${textLines[0] || ''}) Tj`,
            ...textLines.slice(1).map((line) => `0 -16 Td (${line}) Tj`),
            'ET'
        ].join('\n');

        objects[4] = `<< /Length ${Buffer.byteLength(content, 'utf8')} >>\nstream\n${content}\nendstream`;
        objects[5] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';

        const header = '%PDF-1.4\n';
        let body = '';
        const offsets: number[] = [0];
        let cursor = Buffer.byteLength(header, 'utf8');

        for (let i = 1; i < objects.length; i++) {
            offsets[i] = cursor;
            const chunk = `${i} 0 obj\n${objects[i]}\nendobj\n`;
            body += chunk;
            cursor += Buffer.byteLength(chunk, 'utf8');
        }

        const xrefStart = cursor;
        let xref = `xref\n0 ${objects.length}\n`;
        xref += '0000000000 65535 f \n';
        for (let i = 1; i < objects.length; i++) {
            xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
        }

        const trailer = `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
        return Buffer.from(`${header}${body}${xref}${trailer}`, 'utf8');
    }

    private async publishReportStatusSafe(
        jobId: string,
        status: string,
        details?: Record<string, unknown>
    ): Promise<void> {
        try {
            const { publishReportStatus } = await import('../redis/pubsub.js');
            await publishReportStatus(jobId, status, details);
        } catch (error) {
            console.warn(`ReportService: failed to publish status for ${jobId}:`, (error as Error)?.message || error);
        }
    }
}

export const reportService = new ReportService();

export default reportService;

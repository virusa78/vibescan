/**
 * ReportService
 *
 * Generates reports with paywall enforcement based on user plan.
 * Supports full view for pro/enterprise and locked view for starter.
 */

import { merge as diffMerge, computeDelta, computeSeverityBreakdown, rankVulnerabilities } from './diffEngine.js';
import { getPool } from '../database/client.js';

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

        // Route based on plan
        if (scan.plan_at_submission === 'starter') {
            return this.buildLockedView(scan, delta, results, format);
        } else {
            return this.buildFullView(scan, delta, results, format);
        }
    }

    /**
     * Build locked view for starter plan
     * No delta details exposed - only counts
     * @param scan - Scan record
     * @param delta - Scan delta
     * @param results - Scan results
     * @param format - Report format
     * @returns Locked report view
     */
    buildLockedView(
        scan: any,
        delta: any,
        results: any,
        format: 'json' | 'summary' | 'pdf' | 'ci'
    ): any {
        // Get free vulnerabilities
        const freeResult = results.find((r: any) => r.source === 'free');
        const freeVulns = freeResult?.vulnerabilities || [];

        const report: any = {
            scanId: scan.id,
            status: scan.status,
            plan: scan.plan_at_submission,
            freeVulnerabilities: freeVulns,
            deltaCount: delta.delta_count,
            deltaBySeverity: delta.delta_by_severity,
            totalFreeCount: delta.total_free_count,
            totalEnterpriseCount: delta.total_enterprise_count,
            createdAt: scan.created_at,
            locked: true
        };

        // Handle format-specific responses
        if (format === 'summary') {
            return {
                ...report,
                vulnerabilities: null,
                deltaVulnerabilities: null
            };
        }

        if (format === 'pdf') {
            return {
                ...report,
                vulnerabilities: freeVulns,
                deltaVulnerabilities: null,
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
    async generatePdf(scanId: string, userId: string): Promise<{ jobId: string }> {
        // Verify access
        const scan = await this.getScanWithOwnership(scanId, userId);
        if (!scan) {
            throw { code: 'not_found', message: 'Scan not found' };
        }

        // Check plan
        if (scan.plan_at_submission === 'starter') {
            throw { code: 'forbidden', message: 'PDF generation not available for starter plan' };
        }

        // Generate job ID
        const jobId = require('uuid').v4();

        // In production, this would queue a PDF generation job
        // For now, just return the job ID
        return { jobId };
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
        // Get full report view
        const report = await this.buildReportView(scanId, userId, 'ci');

        // Build CI decision from vulnerabilities
        return this.buildCiDecision(report.free_vulnerabilities || [], thresholdSeverity);
    }

    /**
     * Build CI decision from vulnerabilities
     */
    private buildCiDecision(vulnerabilities: any[], thresholdSeverity: string = 'HIGH'): any {
        // Find max severity
        const severityOrder: Record<string, number> = {
            CRITICAL: 0,
            HIGH: 1,
            MEDIUM: 2,
            LOW: 3,
            INFO: 4
        };

        let maxSeverity: string = 'LOW';
        let maxSeverityOrder = 3;
        const blockingVulns: any[] = [];

        for (const vuln of vulnerabilities) {
            const severity = vuln.severity || 'LOW';
            const severityOrderVal = severityOrder[severity] ?? 3;

            if (severityOrderVal < maxSeverityOrder) {
                maxSeverity = severity;
                maxSeverityOrder = severityOrderVal;
            }

            if (severityOrderVal <= maxSeverityOrder) {
                blockingVulns.push(vuln);
            }
        }

        // Determine pass/fail
        const thresholdOrder = severityOrder[thresholdSeverity] ?? 1;
        const pass = maxSeverityOrder >= thresholdOrder;

        return {
            pass,
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
}

export const reportService = new ReportService();

export default reportService;

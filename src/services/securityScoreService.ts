import { getPool } from '../database/client.js';
import { merge as mergeVulnerabilities } from './diffEngine.js';
import { buildVulnerabilityIdentity } from './vulnerabilityIdentity.js';

const DEFAULT_SLA_TARGET_DAYS: Record<string, number> = {
    CRITICAL: 7,
    HIGH: 14,
    MEDIUM: 30,
    LOW: 60,
};

const SEVERITY_PENALTY: Record<string, number> = {
    CRITICAL: 20,
    HIGH: 10,
    MEDIUM: 4,
    LOW: 1,
    INFO: 0,
};

type ScoreBreakdown = {
    counts: Record<string, number>;
    exploitableCount: number;
    acceptedCount: number;
    severityPenalty: number;
    exploitablePenalty: number;
    totalPenalty: number;
};

export class SecurityScoreService {
    private pool: any;

    constructor() {
        this.pool = getPool();
    }

    private async verifyScanOwnership(scanId: string, userId: string): Promise<any> {
        const result = await this.pool.query(
            `SELECT id, user_id, created_at
             FROM scans
             WHERE id = $1 AND (user_id = $2 OR org_id IN (
                SELECT id FROM organizations WHERE owner_user_id = $2 OR $2 = ANY(members)
             ))`,
            [scanId, userId],
        );
        if (result.rows.length === 0) {
            throw { code: 'not_found', message: 'Scan not found' };
        }
        return result.rows[0];
    }

    private async getMergedVulnerabilities(scanId: string): Promise<any[]> {
        const results = await this.pool.query(
            `SELECT source, vulnerabilities
             FROM scan_results
             WHERE scan_id = $1`,
            [scanId],
        );
        const freeVulns = results.rows.find((row: any) => row.source === 'free')?.vulnerabilities || [];
        const enterpriseVulns = results.rows.find((row: any) => row.source === 'enterprise')?.vulnerabilities || [];
        return mergeVulnerabilities(freeVulns, enterpriseVulns);
    }

    private gradeForScore(score: number): string {
        if (score >= 90) return 'A';
        if (score >= 80) return 'B';
        if (score >= 70) return 'C';
        if (score >= 60) return 'D';
        return 'F';
    }

    private async getUserSlaPolicy(userId: string): Promise<Record<string, number>> {
        const result = await this.pool.query(
            `SELECT severity, target_days
             FROM vulnerability_sla_policies
             WHERE user_id = $1`,
            [userId],
        );
        if (result.rows.length === 0) {
            return { ...DEFAULT_SLA_TARGET_DAYS };
        }

        const merged = { ...DEFAULT_SLA_TARGET_DAYS };
        for (const row of result.rows) {
            merged[String(row.severity).toUpperCase()] = Number(row.target_days);
        }
        return merged;
    }

    private async getActiveRiskAcceptanceIds(scanId: string, userId: string): Promise<Set<string>> {
        const result = await this.pool.query(
            `SELECT vulnerability_id
             FROM vuln_acceptances
             WHERE scan_id = $1
               AND user_id = $2
               AND status = 'accepted'
               AND (expires_at IS NULL OR expires_at > NOW())`,
            [scanId, userId],
        );
        return new Set(result.rows.map((row: any) => row.vulnerability_id));
    }

    calculateSecurityScore(vulnerabilities: any[], acceptedIds: Set<string> = new Set()): {
        score: number;
        grade: string;
        breakdown: ScoreBreakdown;
    } {
        const counts: Record<string, number> = {
            CRITICAL: 0,
            HIGH: 0,
            MEDIUM: 0,
            LOW: 0,
            INFO: 0,
        };
        let exploitableCount = 0;
        let acceptedCount = 0;
        let severityPenalty = 0;
        let exploitablePenalty = 0;

        for (const vuln of vulnerabilities || []) {
            const severity = String(vuln?.severity || 'LOW').toUpperCase();
            const normalizedSeverity = SEVERITY_PENALTY[severity] !== undefined ? severity : 'LOW';
            const vulnerabilityId = buildVulnerabilityIdentity(
                vuln?.cve_id,
                vuln?.package_name,
                vuln?.installed_version,
            );

            if (acceptedIds.has(vulnerabilityId)) {
                acceptedCount += 1;
                continue;
            }

            counts[normalizedSeverity] = (counts[normalizedSeverity] || 0) + 1;
            severityPenalty += SEVERITY_PENALTY[normalizedSeverity] || 0;
            if (vuln?.is_exploitable === true) {
                exploitableCount += 1;
                exploitablePenalty += 5;
            }
        }

        const totalPenalty = severityPenalty + exploitablePenalty;
        const score = Math.max(0, Math.min(100, Number((100 - totalPenalty).toFixed(2))));

        return {
            score,
            grade: this.gradeForScore(score),
            breakdown: {
                counts,
                exploitableCount,
                acceptedCount,
                severityPenalty,
                exploitablePenalty,
                totalPenalty,
            },
        };
    }

    async upsertSnapshot(scanId: string, userId: string): Promise<any> {
        await this.verifyScanOwnership(scanId, userId);
        const vulnerabilities = await this.getMergedVulnerabilities(scanId);
        const acceptedIds = await this.getActiveRiskAcceptanceIds(scanId, userId);
        const calculated = this.calculateSecurityScore(vulnerabilities, acceptedIds);

        const result = await this.pool.query(
            `INSERT INTO security_scores (scan_id, score, grade, breakdown, calculated_at)
             VALUES ($1, $2, $3, $4::jsonb, NOW())
             ON CONFLICT (scan_id) DO UPDATE SET
                score = EXCLUDED.score,
                grade = EXCLUDED.grade,
                breakdown = EXCLUDED.breakdown,
                calculated_at = NOW()
             RETURNING id, scan_id, score, grade, breakdown, calculated_at, created_at`,
            [scanId, calculated.score, calculated.grade, JSON.stringify(calculated.breakdown)],
        );

        return result.rows[0];
    }

    async getSnapshot(scanId: string, userId: string): Promise<any> {
        await this.verifyScanOwnership(scanId, userId);
        const result = await this.pool.query(
            `SELECT id, scan_id, score, grade, breakdown, calculated_at, created_at
             FROM security_scores
             WHERE scan_id = $1`,
            [scanId],
        );

        if (result.rows.length > 0) {
            return result.rows[0];
        }

        return this.upsertSnapshot(scanId, userId);
    }

    async getTrend(userId: string, limit: number = 20): Promise<any[]> {
        const safeLimit = Math.min(Math.max(1, limit), 100);
        const result = await this.pool.query(
            `SELECT ss.scan_id, ss.score, ss.grade, ss.breakdown, ss.calculated_at, ss.created_at,
                    s.created_at AS scan_created_at
             FROM security_scores ss
             JOIN scans s ON s.id = ss.scan_id
             WHERE s.user_id = $1
             ORDER BY s.created_at DESC
             LIMIT $2`,
            [userId, safeLimit],
        );

        const rows = result.rows;
        return rows.map((row: any, index: number) => {
            const previous = rows[index + 1];
            const delta = previous ? Number((Number(row.score) - Number(previous.score)).toFixed(2)) : null;
            return {
                scanId: row.scan_id,
                score: Number(row.score),
                grade: row.grade,
                breakdown: row.breakdown || {},
                calculatedAt: row.calculated_at,
                scanCreatedAt: row.scan_created_at,
                deltaFromPrevious: delta,
            };
        });
    }

    async acceptRisk(
        scanId: string,
        userId: string,
        vulnerabilityId: string,
        reason?: string,
        expiresAt?: string,
    ): Promise<any> {
        await this.verifyScanOwnership(scanId, userId);
        const result = await this.pool.query(
            `INSERT INTO vuln_acceptances
                (scan_id, user_id, vulnerability_id, reason, status, accepted_at, expires_at, updated_at)
             VALUES ($1, $2, $3, $4, 'accepted', NOW(), $5, NOW())
             ON CONFLICT (scan_id, user_id, vulnerability_id) DO UPDATE SET
                reason = EXCLUDED.reason,
                status = 'accepted',
                accepted_at = NOW(),
                expires_at = EXCLUDED.expires_at,
                updated_at = NOW()
             RETURNING id, scan_id, user_id, vulnerability_id, reason, status,
                       accepted_at, expires_at, updated_at`,
            [scanId, userId, vulnerabilityId, reason || null, expiresAt || null],
        );

        await this.upsertSnapshot(scanId, userId);
        return result.rows[0];
    }

    async revokeRisk(scanId: string, userId: string, vulnerabilityId: string): Promise<void> {
        await this.verifyScanOwnership(scanId, userId);
        await this.pool.query(
            `UPDATE vuln_acceptances
             SET status = 'revoked', updated_at = NOW()
             WHERE scan_id = $1 AND user_id = $2 AND vulnerability_id = $3`,
            [scanId, userId, vulnerabilityId],
        );
        await this.upsertSnapshot(scanId, userId);
    }

    async listRiskAcceptances(scanId: string, userId: string): Promise<any[]> {
        await this.verifyScanOwnership(scanId, userId);
        const result = await this.pool.query(
            `SELECT id, scan_id, user_id, vulnerability_id, reason, status,
                    accepted_at, expires_at, updated_at
             FROM vuln_acceptances
             WHERE scan_id = $1 AND user_id = $2
             ORDER BY accepted_at DESC`,
            [scanId, userId],
        );
        return result.rows;
    }

    async getSlaSummary(scanId: string, userId: string): Promise<any> {
        const scan = await this.verifyScanOwnership(scanId, userId);
        const vulnerabilities = await this.getMergedVulnerabilities(scanId);
        const acceptedIds = await this.getActiveRiskAcceptanceIds(scanId, userId);
        const policy = await this.getUserSlaPolicy(userId);
        const scanCreatedAt = new Date(scan.created_at);
        const now = new Date();

        const bySeverity: Record<string, { total: number; breached: number; accepted: number; targetDays: number }> = {
            CRITICAL: { total: 0, breached: 0, accepted: 0, targetDays: policy.CRITICAL },
            HIGH: { total: 0, breached: 0, accepted: 0, targetDays: policy.HIGH },
            MEDIUM: { total: 0, breached: 0, accepted: 0, targetDays: policy.MEDIUM },
            LOW: { total: 0, breached: 0, accepted: 0, targetDays: policy.LOW },
        };

        const items = [];
        for (const vuln of vulnerabilities) {
            const severity = String(vuln?.severity || 'LOW').toUpperCase();
            if (!(severity in bySeverity)) {
                continue;
            }
            const targetDays = policy[severity];
            const vulnerabilityId = buildVulnerabilityIdentity(
                vuln?.cve_id,
                vuln?.package_name,
                vuln?.installed_version,
            );
            const dueAt = new Date(scanCreatedAt.getTime() + targetDays * 24 * 60 * 60 * 1000);
            const accepted = acceptedIds.has(vulnerabilityId);
            const breached = !accepted && dueAt.getTime() < now.getTime();

            bySeverity[severity].total += 1;
            if (accepted) bySeverity[severity].accepted += 1;
            if (breached) bySeverity[severity].breached += 1;

            items.push({
                vulnerabilityId,
                cveId: vuln?.cve_id || null,
                packageName: vuln?.package_name || null,
                installedVersion: vuln?.installed_version || null,
                severity,
                dueAt: dueAt.toISOString(),
                accepted,
                breached,
            });
        }

        const breachedCount = Object.values(bySeverity).reduce((sum, row) => sum + row.breached, 0);
        const acceptedCount = Object.values(bySeverity).reduce((sum, row) => sum + row.accepted, 0);

        return {
            scanId,
            snapshotAt: now.toISOString(),
            targetDays: policy,
            totalTracked: items.length,
            acceptedCount,
            breachedCount,
            bySeverity,
            items,
        };
    }
}

export const securityScoreService = new SecurityScoreService();

export default securityScoreService;

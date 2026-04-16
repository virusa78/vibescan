import { getPool } from '../database/client.js';

export type CveRemediationStatus = 'open' | 'in_progress' | 'resolved' | 'accepted_risk' | 'false_positive';

const ALLOWED_STATUSES: CveRemediationStatus[] = [
    'open',
    'in_progress',
    'resolved',
    'accepted_risk',
    'false_positive',
];

export class CveRemediationService {
    private pool: any;

    constructor() {
        this.pool = getPool();
    }

    private async verifyScanOwnership(scanId: string, userId: string): Promise<void> {
        const result = await this.pool.query(
            `SELECT id
             FROM scans
             WHERE id = $1 AND user_id = $2`,
            [scanId, userId],
        );

        if (result.rows.length === 0) {
            throw { code: 'not_found', message: 'Scan not found' };
        }
    }

    async upsertItem(
        scanId: string,
        userId: string,
        cveId: string,
        status: CveRemediationStatus,
        notes?: string,
    ): Promise<any> {
        await this.verifyScanOwnership(scanId, userId);

        if (!cveId || !/^CVE-\d{4}-\d+$/i.test(cveId)) {
            throw { code: 'validation_error', message: 'Invalid cve_id format' };
        }

        if (!ALLOWED_STATUSES.includes(status)) {
            throw {
                code: 'validation_error',
                message: `Invalid status. Allowed: ${ALLOWED_STATUSES.join(', ')}`,
            };
        }

        const result = await this.pool.query(
            `INSERT INTO cve_remediation_items (scan_id, user_id, cve_id, status, notes, updated_at)
             VALUES ($1, $2, UPPER($3), $4, $5, NOW())
             ON CONFLICT (scan_id, cve_id) DO UPDATE SET
               status = EXCLUDED.status,
               notes = EXCLUDED.notes,
               updated_at = NOW()
             RETURNING id, scan_id, user_id, cve_id, status, notes, created_at, updated_at`,
            [scanId, userId, cveId, status, notes || null],
        );

        return result.rows[0];
    }

    async listItems(scanId: string, userId: string): Promise<any[]> {
        await this.verifyScanOwnership(scanId, userId);

        const result = await this.pool.query(
            `SELECT id, scan_id, user_id, cve_id, status, notes, created_at, updated_at
             FROM cve_remediation_items
             WHERE scan_id = $1 AND user_id = $2
             ORDER BY updated_at DESC`,
            [scanId, userId],
        );

        return result.rows;
    }

    async getProgress(scanId: string, userId: string): Promise<any> {
        await this.verifyScanOwnership(scanId, userId);

        const discoveredResult = await this.pool.query(
            `SELECT DISTINCT UPPER(vuln->>'cve_id') AS cve_id
             FROM scan_results sr,
                  jsonb_array_elements(sr.vulnerabilities) AS vuln
             WHERE sr.scan_id = $1
               AND COALESCE(vuln->>'cve_id', '') <> ''`,
            [scanId],
        );

        const items = await this.listItems(scanId, userId);
        const itemByCve = new Map(items.map((item) => [item.cve_id, item]));

        const discoveredCves = discoveredResult.rows.map((row: any) => row.cve_id);
        const totalDiscovered = discoveredCves.length || items.length;

        const counters: Record<CveRemediationStatus, number> = {
            open: 0,
            in_progress: 0,
            resolved: 0,
            accepted_risk: 0,
            false_positive: 0,
        };

        for (const cve of discoveredCves) {
            const item = itemByCve.get(cve);
            const status = (item?.status || 'open') as CveRemediationStatus;
            counters[status] += 1;
        }

        if (discoveredCves.length === 0) {
            for (const item of items) {
                const status = item.status as CveRemediationStatus;
                counters[status] += 1;
            }
        }

        const completed = counters.resolved + counters.accepted_risk + counters.false_positive;
        const completionPercent = totalDiscovered > 0 ? Math.round((completed / totalDiscovered) * 100) : 0;

        return {
            scanId,
            totalDiscovered,
            completed,
            completionPercent,
            byStatus: counters,
            items,
        };
    }
}

export const cveRemediationService = new CveRemediationService();

export default cveRemediationService;

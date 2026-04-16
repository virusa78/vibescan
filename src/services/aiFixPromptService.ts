import { getPool } from '../database/client.js';
import { buildVulnerabilityIdentity } from './vulnerabilityIdentity.js';

export type GenerateAiFixPromptInput = {
    scanId: string;
    userId: string;
    cveId?: string;
    packageName: string;
    installedVersion: string;
    modelName?: string;
};

export class AiFixPromptService {
    private pool: any;

    constructor() {
        this.pool = getPool();
    }

    private async verifyScanOwnership(scanId: string, userId: string): Promise<void> {
        const result = await this.pool.query(
            `SELECT id
             FROM scans
             WHERE id = $1 AND (user_id = $2 OR org_id IN (
                SELECT id FROM organizations WHERE owner_user_id = $2 OR $2 = ANY(members)
             ))`,
            [scanId, userId],
        );
        if (result.rows.length === 0) {
            throw { code: 'not_found', message: 'Scan not found' };
        }
    }

    private async resolveVulnerabilityContext(scanId: string, cacheKey: string): Promise<any | null> {
        const result = await this.pool.query(
            `SELECT vuln
             FROM scan_results sr,
                  jsonb_array_elements(sr.vulnerabilities) AS vuln
             WHERE sr.scan_id = $1
               AND (
                    UPPER(COALESCE(vuln->>'cve_id', 'NO-CVE')) || '|' ||
                    LOWER(COALESCE(vuln->>'package_name', 'unknown-package')) || '|' ||
                    COALESCE(vuln->>'installed_version', 'unknown-version')
               ) = $2
             LIMIT 1`,
            [scanId, cacheKey],
        );

        return result.rows[0]?.vuln || null;
    }

    private buildPromptText(vulnerability: any): string {
        const cveId = vulnerability?.cve_id || 'NO-CVE';
        const packageName = vulnerability?.package_name || 'unknown-package';
        const installedVersion = vulnerability?.installed_version || 'unknown-version';
        const fixedVersion = vulnerability?.fixed_version || 'not provided';
        const severity = vulnerability?.severity || 'UNKNOWN';
        const description = vulnerability?.description || 'No description provided by scanner.';

        return [
            'You are a secure code remediation assistant.',
            'Create an actionable fix plan for the vulnerability below.',
            '',
            `Vulnerability: ${cveId}`,
            `Package: ${packageName}`,
            `Installed Version: ${installedVersion}`,
            `Fixed Version: ${fixedVersion}`,
            `Severity: ${severity}`,
            `Description: ${description}`,
            '',
            'Return:',
            '1) Root cause summary',
            '2) Minimal patch/diff guidance',
            '3) Validation steps (tests/commands)',
            '4) Rollback plan',
        ].join('\n');
    }

    async generatePrompt(input: GenerateAiFixPromptInput): Promise<{ cacheHit: boolean; prompt: any }> {
        const { scanId, userId, cveId, packageName, installedVersion, modelName } = input;

        if (!packageName || !installedVersion) {
            throw { code: 'validation_error', message: 'packageName and installedVersion are required' };
        }

        await this.verifyScanOwnership(scanId, userId);

        const cacheKey = buildVulnerabilityIdentity(cveId, packageName, installedVersion);

        const cached = await this.pool.query(
            `SELECT id, scan_id, user_id, vulnerability_id, cache_key, prompt_text, model_name,
                    response_payload, status, created_at, updated_at
             FROM ai_fix_prompts
             WHERE user_id = $1
               AND COALESCE(cache_key, vulnerability_id) = $2
               AND status = 'generated'
             ORDER BY created_at DESC
             LIMIT 1`,
            [userId, cacheKey],
        );

        if (cached.rows.length > 0) {
            return { cacheHit: true, prompt: cached.rows[0] };
        }

        const vulnerability = await this.resolveVulnerabilityContext(scanId, cacheKey);
        if (!vulnerability) {
            throw {
                code: 'validation_error',
                message: 'Vulnerability context not found in scan results for cve/package/version',
            };
        }

        const promptText = this.buildPromptText(vulnerability);
        const insertResult = await this.pool.query(
            `INSERT INTO ai_fix_prompts (
                scan_id, user_id, vulnerability_id, cache_key, prompt_text, model_name, response_payload, status
             )
             VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, 'generated')
             RETURNING id, scan_id, user_id, vulnerability_id, cache_key, prompt_text, model_name,
                       response_payload, status, created_at, updated_at`,
            [
                scanId,
                userId,
                cacheKey,
                cacheKey,
                promptText,
                modelName || 'gpt-4o-mini',
                JSON.stringify({
                    cve_id: vulnerability?.cve_id || null,
                    package_name: vulnerability?.package_name || null,
                    installed_version: vulnerability?.installed_version || null,
                    severity: vulnerability?.severity || null,
                }),
            ],
        );

        return { cacheHit: false, prompt: insertResult.rows[0] };
    }

    async listScanPrompts(scanId: string, userId: string): Promise<any[]> {
        await this.verifyScanOwnership(scanId, userId);
        const result = await this.pool.query(
            `SELECT id, scan_id, user_id, vulnerability_id, cache_key, prompt_text, model_name,
                    response_payload, status, created_at, updated_at
             FROM ai_fix_prompts
             WHERE scan_id = $1 AND user_id = $2
             ORDER BY created_at DESC`,
            [scanId, userId],
        );
        return result.rows;
    }
}

export const aiFixPromptService = new AiFixPromptService();

export default aiFixPromptService;

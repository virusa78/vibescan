import crypto from 'crypto';
import { getPool } from '../database/client.js';
import config from '../config/index.js';
import { githubOrchestratorAdapter, GithubOrchestratorAdapter } from './githubOrchestratorAdapter.js';
import { githubCheckRunService, GithubCheckRunService } from './githubCheckRunService.js';
import { getReportAccessPolicy } from './reportAccessPolicy.js';
import { merge as diffMerge } from './diffEngine.js';

type GithubEventType = 'installation' | 'push' | 'pull_request';

export interface GithubWebhookResult {
    accepted: boolean;
    eventType: string;
    action: 'installation_updated' | 'scan_triggered' | 'ignored';
    reason?: string;
    scanId?: string;
    duplicate?: boolean;
}

type IntegrationDependencies = {
    pool?: ReturnType<typeof getPool>;
    adapter?: GithubOrchestratorAdapter;
    checkRunService?: GithubCheckRunService;
    webhookSecret?: string | null;
};

export class GithubIntegrationService {
    private readonly pool: ReturnType<typeof getPool>;
    private readonly adapter: GithubOrchestratorAdapter;
    private readonly checkRunService: GithubCheckRunService;
    private readonly webhookSecret: string | null;

    constructor(deps: IntegrationDependencies = {}) {
        this.pool = deps.pool || getPool();
        this.adapter = deps.adapter || githubOrchestratorAdapter;
        this.checkRunService = deps.checkRunService || githubCheckRunService;
        this.webhookSecret = deps.webhookSecret ?? config.GITHUB_WEBHOOK_SECRET ?? null;
    }

    verifyWebhookSignature(rawBody: Buffer, signatureHeader?: string): { valid: boolean; reason?: string } {
        if (!this.webhookSecret) {
            return { valid: false, reason: 'github_webhook_secret_not_configured' };
        }
        if (!signatureHeader) {
            return { valid: false, reason: 'missing_signature' };
        }

        const expected = `sha256=${crypto.createHmac('sha256', this.webhookSecret).update(rawBody).digest('hex')}`;
        const provided = signatureHeader.trim();

        if (expected.length !== provided.length) {
            return { valid: false, reason: 'invalid_signature' };
        }

        const valid = crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
        return valid ? { valid: true } : { valid: false, reason: 'invalid_signature' };
    }

    async handleWebhookEvent(eventType: string, payload: any, deliveryId?: string): Promise<GithubWebhookResult> {
        const supported = new Set<GithubEventType>(['installation', 'push', 'pull_request']);
        if (!supported.has(eventType as GithubEventType)) {
            return { accepted: true, eventType, action: 'ignored', reason: 'unsupported_event' };
        }

        switch (eventType as GithubEventType) {
            case 'installation':
                return this.handleInstallationEvent(payload);
            case 'push':
                return this.handlePushEvent(payload, deliveryId);
            case 'pull_request':
                return this.handlePullRequestEvent(payload, deliveryId);
            default:
                return { accepted: true, eventType, action: 'ignored', reason: 'unsupported_event' };
        }
    }

    private async handleInstallationEvent(payload: any): Promise<GithubWebhookResult> {
        const installationId = Number(payload?.installation?.id);
        if (!Number.isFinite(installationId)) {
            return { accepted: true, eventType: 'installation', action: 'ignored', reason: 'missing_installation_id' };
        }

        const action = String(payload?.action || '');
        if (action === 'deleted') {
            await this.pool.query(
                'DELETE FROM github_installations WHERE github_installation_id = $1',
                [installationId]
            );
            return { accepted: true, eventType: 'installation', action: 'installation_updated' };
        }

        const orgLookup = await this.pool.query(
            `SELECT id
             FROM organizations
             WHERE github_installation_id = $1
             LIMIT 1`,
            [String(installationId)]
        );

        if (orgLookup.rows.length === 0) {
            return { accepted: true, eventType: 'installation', action: 'ignored', reason: 'unmapped_installation' };
        }

        const orgId = orgLookup.rows[0].id;
        const repositories = Array.isArray(payload?.repositories)
            ? payload.repositories.map((repo: any) => String(repo?.full_name || '')).filter(Boolean)
            : [];
        const appId = String(payload?.installation?.app_id || payload?.installation?.app_slug || 'github-app');

        const updateResult = await this.pool.query(
            `UPDATE github_installations
             SET github_app_id = $3,
                 repos_scope = $4::text[]
             WHERE org_id = $1 AND github_installation_id = $2`,
            [orgId, installationId, appId, repositories]
        );

        if ((updateResult.rowCount || 0) === 0) {
            await this.pool.query(
                `INSERT INTO github_installations (
                    org_id, github_installation_id, github_app_id, repos_scope
                 ) VALUES ($1, $2, $3, $4::text[])`,
                [orgId, installationId, appId, repositories]
            );
        }

        return { accepted: true, eventType: 'installation', action: 'installation_updated' };
    }

    private async handlePushEvent(payload: any, deliveryId?: string): Promise<GithubWebhookResult> {
        const installationId = Number(payload?.installation?.id);
        const repo = String(payload?.repository?.full_name || '');
        const branch = String(payload?.ref || '').replace('refs/heads/', '');
        const sha = String(payload?.after || branch || 'HEAD');

        if (!Number.isFinite(installationId) || !repo || !branch) {
            return { accepted: true, eventType: 'push', action: 'ignored', reason: 'invalid_payload' };
        }

        const installation = await this.loadInstallationContext(installationId);
        if (!installation) {
            return { accepted: true, eventType: 'push', action: 'ignored', reason: 'installation_not_configured' };
        }
        if (!installation.trigger_on_push) {
            return { accepted: true, eventType: 'push', action: 'ignored', reason: 'push_trigger_disabled' };
        }
        if (!this.isRepoAuthorized(installation.repos_scope, repo)) {
            return { accepted: true, eventType: 'push', action: 'ignored', reason: 'repo_not_authorized' };
        }
        if (!this.isBranchTargeted(installation.target_branches, branch)) {
            return { accepted: true, eventType: 'push', action: 'ignored', reason: 'branch_not_targeted' };
        }

        const triggered = await this.adapter.triggerWebhookGithubScan({
            userId: installation.owner_user_id,
            repo,
            ref: sha || 'HEAD',
            installationId,
            trigger: 'push',
            deliveryId,
        });

        await this.ensureScanCheckRunContext({
            scanId: triggered.scanId,
            userId: installation.owner_user_id,
            installationId,
            repo,
            headSha: sha || 'HEAD',
            trigger: 'push',
            deliveryId,
            failOnSeverity: installation.fail_pr_on_severity || 'CRITICAL',
        });

        return {
            accepted: true,
            eventType: 'push',
            action: 'scan_triggered',
            scanId: triggered.scanId,
            duplicate: triggered.duplicate,
        };
    }

    private async handlePullRequestEvent(payload: any, deliveryId?: string): Promise<GithubWebhookResult> {
        const action = String(payload?.action || '');
        if (!['opened', 'reopened', 'synchronize'].includes(action)) {
            return { accepted: true, eventType: 'pull_request', action: 'ignored', reason: 'action_not_supported' };
        }

        const installationId = Number(payload?.installation?.id);
        const repo = String(payload?.repository?.full_name || '');
        const baseBranch = String(payload?.pull_request?.base?.ref || '');
        const headRef = String(payload?.pull_request?.head?.sha || payload?.pull_request?.head?.ref || 'HEAD');

        if (!Number.isFinite(installationId) || !repo || !baseBranch) {
            return { accepted: true, eventType: 'pull_request', action: 'ignored', reason: 'invalid_payload' };
        }

        const installation = await this.loadInstallationContext(installationId);
        if (!installation) {
            return { accepted: true, eventType: 'pull_request', action: 'ignored', reason: 'installation_not_configured' };
        }
        if (!installation.trigger_on_pr) {
            return { accepted: true, eventType: 'pull_request', action: 'ignored', reason: 'pr_trigger_disabled' };
        }
        if (!this.isRepoAuthorized(installation.repos_scope, repo)) {
            return { accepted: true, eventType: 'pull_request', action: 'ignored', reason: 'repo_not_authorized' };
        }
        if (!this.isBranchTargeted(installation.target_branches, baseBranch)) {
            return { accepted: true, eventType: 'pull_request', action: 'ignored', reason: 'branch_not_targeted' };
        }

        const triggered = await this.adapter.triggerWebhookGithubScan({
            userId: installation.owner_user_id,
            repo,
            ref: headRef || 'HEAD',
            installationId,
            trigger: 'pull_request',
            deliveryId,
        });

        await this.ensureScanCheckRunContext({
            scanId: triggered.scanId,
            userId: installation.owner_user_id,
            installationId,
            repo,
            headSha: headRef || 'HEAD',
            trigger: 'pull_request',
            deliveryId,
            failOnSeverity: installation.fail_pr_on_severity || 'CRITICAL',
        });

        return {
            accepted: true,
            eventType: 'pull_request',
            action: 'scan_triggered',
            scanId: triggered.scanId,
            duplicate: triggered.duplicate,
        };
    }

    private async loadInstallationContext(installationId: number): Promise<any | null> {
        const result = await this.pool.query(
            `SELECT gi.github_installation_id, gi.repos_scope, gi.trigger_on_push, gi.trigger_on_pr, gi.target_branches, gi.fail_pr_on_severity,
                    org.owner_user_id
             FROM github_installations gi
             JOIN organizations org ON org.id = gi.org_id
             WHERE gi.github_installation_id = $1
             ORDER BY gi.created_at DESC
             LIMIT 1`,
            [installationId]
        );

        return result.rows[0] || null;
    }

    private isRepoAuthorized(authorizedRepos: string[], repo: string): boolean {
        if (!Array.isArray(authorizedRepos) || authorizedRepos.length === 0) {
            return false;
        }
        return authorizedRepos.includes(repo);
    }

    private isBranchTargeted(targetBranches: string[], branch: string): boolean {
        if (!Array.isArray(targetBranches) || targetBranches.length === 0) {
            return true;
        }
        return targetBranches.includes(branch);
    }

    async handleScanCompleted(scanId: string): Promise<void> {
        const contextResult = await this.pool.query(
            `SELECT *
             FROM github_scan_checks
             WHERE scan_id = $1
             LIMIT 1`,
            [scanId]
        );
        const context = contextResult.rows[0];
        if (!context) {
            return;
        }

        const scanResult = await this.pool.query(
            'SELECT id, status, plan_at_submission FROM scans WHERE id = $1 LIMIT 1',
            [scanId]
        );
        const scan = scanResult.rows[0];
        if (!scan) {
            throw { code: 'not_found', message: `Scan ${scanId} not found for check-run completion` };
        }

        const resultsResult = await this.pool.query(
            'SELECT source, vulnerabilities FROM scan_results WHERE scan_id = $1',
            [scanId]
        );
        const freeVulnerabilities = resultsResult.rows.find((r: any) => r.source === 'free')?.vulnerabilities || [];
        const enterpriseVulnerabilities = resultsResult.rows.find((r: any) => r.source === 'enterprise')?.vulnerabilities || [];

        const policy = getReportAccessPolicy(scan.plan_at_submission);
        const visibleVulnerabilities = policy.includeEnterpriseDetails
            ? diffMerge(freeVulnerabilities, enterpriseVulnerabilities)
            : freeVulnerabilities;

        const threshold = String(context.fail_on_severity || 'CRITICAL').toUpperCase();
        const blockingCount = this.countBlockingVulnerabilities(visibleVulnerabilities, threshold);
        const detailsUrl = `${config.FRONTEND_URL.replace(/\/$/, '')}/scans/${scanId}`;

        const summary = policy.includeEnterpriseDetails
            ? this.buildFullSummary(freeVulnerabilities, enterpriseVulnerabilities, threshold, blockingCount)
            : this.buildStarterSummary(freeVulnerabilities, threshold, blockingCount);

        if (!context.check_run_id) {
            throw {
                code: 'github_check_run_missing',
                message: `Scan ${scanId} has no check_run_id for completion update`
            };
        }

        await this.checkRunService.updateCheckRun({
            installationId: Number(context.github_installation_id),
            repoFullName: context.repository_full_name,
            checkRunId: Number(context.check_run_id),
            payload: this.adapter.buildCheckRunContract({
                headSha: context.head_sha,
                summary,
                title: blockingCount > 0 ? 'VibeScan found blocking vulnerabilities' : 'VibeScan found no blocking vulnerabilities',
                detailsUrl,
                failingCount: blockingCount,
                status: 'completed',
            })
        });

        await this.pool.query(
            `UPDATE github_scan_checks
             SET status = 'completed',
                 last_error = NULL,
                 updated_at = NOW()
             WHERE scan_id = $1`,
            [scanId]
        );
    }

    async handleScanFailed(scanId: string, reason: string): Promise<void> {
        const contextResult = await this.pool.query(
            `SELECT *
             FROM github_scan_checks
             WHERE scan_id = $1
             LIMIT 1`,
            [scanId]
        );
        const context = contextResult.rows[0];
        if (!context) {
            return;
        }

        if (!context.check_run_id) {
            await this.pool.query(
                `UPDATE github_scan_checks
                 SET status = 'failed',
                     last_error = $2,
                     updated_at = NOW()
                 WHERE scan_id = $1`,
                [scanId, reason]
            );
            return;
        }

        const detailsUrl = `${config.FRONTEND_URL.replace(/\/$/, '')}/scans/${scanId}`;
        await this.checkRunService.updateCheckRun({
            installationId: Number(context.github_installation_id),
            repoFullName: context.repository_full_name,
            checkRunId: Number(context.check_run_id),
            payload: this.adapter.buildCheckRunContract({
                headSha: context.head_sha,
                summary: `Scan failed before completion. reason=${reason}`,
                title: 'VibeScan scan failed',
                detailsUrl,
                failingCount: 1,
                status: 'completed',
            })
        });

        await this.pool.query(
            `UPDATE github_scan_checks
             SET status = 'failed',
                 last_error = $2,
                 updated_at = NOW()
             WHERE scan_id = $1`,
            [scanId, reason]
        );
    }

    private async ensureScanCheckRunContext(params: {
        scanId: string;
        userId: string;
        installationId: number;
        repo: string;
        headSha: string;
        trigger: 'push' | 'pull_request';
        deliveryId?: string;
        failOnSeverity: string;
    }): Promise<void> {
        const existingResult = await this.pool.query(
            'SELECT scan_id, check_run_id FROM github_scan_checks WHERE scan_id = $1 LIMIT 1',
            [params.scanId]
        );

        if (existingResult.rows.length > 0 && existingResult.rows[0].check_run_id) {
            return;
        }

        const detailsUrl = `${config.FRONTEND_URL.replace(/\/$/, '')}/scans/${params.scanId}`;
        const created = await this.checkRunService.createCheckRun({
            installationId: params.installationId,
            repoFullName: params.repo,
            payload: this.adapter.buildCheckRunContract({
                headSha: params.headSha,
                summary: 'Scan queued. VibeScan is analyzing dependencies and vulnerabilities.',
                title: 'VibeScan scan in progress',
                detailsUrl,
                failingCount: 0,
                status: 'in_progress',
            })
        });

        await this.pool.query(
            `INSERT INTO github_scan_checks (
                scan_id,
                user_id,
                github_installation_id,
                repository_full_name,
                head_sha,
                trigger_event,
                delivery_id,
                check_run_id,
                fail_on_severity,
                status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'posted')
            ON CONFLICT (scan_id) DO UPDATE SET
                github_installation_id = EXCLUDED.github_installation_id,
                repository_full_name = EXCLUDED.repository_full_name,
                head_sha = EXCLUDED.head_sha,
                trigger_event = EXCLUDED.trigger_event,
                delivery_id = EXCLUDED.delivery_id,
                check_run_id = EXCLUDED.check_run_id,
                fail_on_severity = EXCLUDED.fail_on_severity,
                status = 'posted',
                last_error = NULL,
                updated_at = NOW()`,
            [
                params.scanId,
                params.userId,
                params.installationId,
                params.repo,
                params.headSha,
                params.trigger,
                params.deliveryId || null,
                created.id,
                String(params.failOnSeverity || 'CRITICAL').toUpperCase()
            ]
        );
    }

    private countBlockingVulnerabilities(vulnerabilities: any[], threshold: string): number {
        if (threshold === 'NONE') {
            return 0;
        }
        const order: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 4 };
        const thresholdOrder = order[threshold] ?? order.CRITICAL;
        return vulnerabilities.filter((v: any) => {
            const severity = String(v?.severity || 'LOW').toUpperCase();
            const severityOrder = order[severity] ?? order.LOW;
            return severityOrder <= thresholdOrder;
        }).length;
    }

    private buildStarterSummary(freeVulnerabilities: any[], threshold: string, blockingCount: number): string {
        const counts = this.countBySeverity(freeVulnerabilities);
        return [
            `Visibility scope: free vulnerabilities only`,
            `Policy threshold: ${threshold}`,
            `Blocking vulnerabilities: ${blockingCount}`,
            `Free totals: CRITICAL=${counts.CRITICAL}, HIGH=${counts.HIGH}, MEDIUM=${counts.MEDIUM}, LOW=${counts.LOW}`
        ].join('\n');
    }

    private buildFullSummary(
        freeVulnerabilities: any[],
        enterpriseVulnerabilities: any[],
        threshold: string,
        blockingCount: number
    ): string {
        const freeCounts = this.countBySeverity(freeVulnerabilities);
        const enterpriseCounts = this.countBySeverity(enterpriseVulnerabilities);
        return [
            `Visibility scope: full (free + enterprise)`,
            `Policy threshold: ${threshold}`,
            `Blocking vulnerabilities: ${blockingCount}`,
            `Free totals: CRITICAL=${freeCounts.CRITICAL}, HIGH=${freeCounts.HIGH}, MEDIUM=${freeCounts.MEDIUM}, LOW=${freeCounts.LOW}`,
            `Enterprise totals: CRITICAL=${enterpriseCounts.CRITICAL}, HIGH=${enterpriseCounts.HIGH}, MEDIUM=${enterpriseCounts.MEDIUM}, LOW=${enterpriseCounts.LOW}`
        ].join('\n');
    }

    private countBySeverity(vulnerabilities: any[]): Record<'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW', number> {
        const counts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 } as Record<'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW', number>;
        for (const vuln of vulnerabilities || []) {
            const severity = String(vuln?.severity || 'LOW').toUpperCase();
            if (severity in counts) {
                counts[severity as keyof typeof counts] += 1;
            } else {
                counts.LOW += 1;
            }
        }
        return counts;
    }
}

export const githubIntegrationService = new GithubIntegrationService();

export default githubIntegrationService;

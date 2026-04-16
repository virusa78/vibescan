import { getPool } from '../database/client.js';
import { inputAdapterService, normalizeGithubRepository, validateGithubRef } from './inputAdapterService.js';
import { scanOrchestrator } from './scanOrchestrator.js';

export interface GithubScanPayload {
    inputRef?: string;
    githubRepo?: string;
    githubRef?: string;
    github?: {
        repo?: string;
        ref?: string;
        installationId?: string | number;
    };
}

export interface CanonicalGithubTarget {
    repo: string;
    ref: string;
    cloneUrl: string;
    installationId?: number;
}

export interface GithubCheckRunContract {
    name: string;
    head_sha: string;
    status: 'queued' | 'in_progress' | 'completed';
    conclusion?: 'success' | 'failure' | 'neutral' | 'cancelled';
    output: {
        title: string;
        summary: string;
        text?: string;
    };
    details_url?: string;
}

type AdapterDependencies = {
    pool?: ReturnType<typeof getPool>;
    orchestrator?: typeof scanOrchestrator;
    inputAdapter?: typeof inputAdapterService;
};

export class GithubOrchestratorAdapter {
    private readonly pool: ReturnType<typeof getPool>;
    private readonly orchestrator: typeof scanOrchestrator;
    private readonly inputAdapter: typeof inputAdapterService;

    constructor(deps: AdapterDependencies = {}) {
        this.pool = deps.pool || getPool();
        this.orchestrator = deps.orchestrator || scanOrchestrator;
        this.inputAdapter = deps.inputAdapter || inputAdapterService;
    }

    normalizeGithubScanPayload(payload: GithubScanPayload): CanonicalGithubTarget {
        const repoInput = payload.github?.repo || payload.githubRepo;
        if (!repoInput || typeof repoInput !== 'string') {
            throw {
                code: 'validation_error',
                message: 'github_app requires github.repo (or legacy githubRepo)',
                validation_errors: [{ field: 'github.repo', message: 'Repository is required for github_app scans' }]
            };
        }

        let normalized: ReturnType<typeof normalizeGithubRepository>;
        try {
            normalized = normalizeGithubRepository(repoInput);
        } catch (error: any) {
            if (error?.code === 'invalid_input') {
                throw {
                    code: 'validation_error',
                    message: 'github.repo must match owner/repo format',
                    validation_errors: [{ field: 'github.repo', message: error.message }]
                };
            }
            throw error;
        }
        const refInput = payload.github?.ref || payload.githubRef || 'HEAD';
        const ref = typeof refInput === 'string' && refInput.trim() ? refInput.trim() : 'HEAD';
        const refValidation = validateGithubRef(ref);
        if (!refValidation.valid) {
            throw {
                code: 'validation_error',
                message: 'github.ref must be a valid git reference',
                validation_errors: [{ field: 'github.ref', message: refValidation.error }]
            };
        }
        const installationIdRaw = payload.github?.installationId;
        const installationId = installationIdRaw !== undefined ? Number(installationIdRaw) : undefined;

        if (installationIdRaw !== undefined && !Number.isInteger(installationId)) {
            throw {
                code: 'validation_error',
                message: 'github.installationId must be an integer when provided',
                validation_errors: [{ field: 'github.installationId', message: 'Must be an integer' }]
            };
        }

        return {
            repo: `${normalized.owner}/${normalized.repo}`,
            ref,
            cloneUrl: normalized.cloneUrl,
            installationId,
        };
    }

    buildGithubScenarioInput(
        target: CanonicalGithubTarget,
        options: { inputRef?: string; trigger?: 'manual' | 'push' | 'pull_request'; deliveryId?: string } = {}
    ): Record<string, unknown> {
        return {
            scenario: 'github_app',
            repo: target.repo,
            ref: target.ref,
            installationId: target.installationId,
            trigger: options.trigger || 'manual',
            deliveryId: options.deliveryId,
            inputRef: options.inputRef || `${target.repo}@${target.ref}`,
        };
    }

    async submitGithubAppScan(
        userId: string,
        payload: GithubScanPayload,
        options: { resolveComponents?: boolean; trigger?: 'manual' | 'push' | 'pull_request'; deliveryId?: string } = {}
    ): Promise<any> {
        const target = this.normalizeGithubScanPayload(payload);
        const resolveComponents = options.resolveComponents ?? true;
        const scenarioInput = this.buildGithubScenarioInput(target, {
            inputRef: payload.inputRef,
            trigger: options.trigger,
            deliveryId: options.deliveryId,
        });

        let components: any[] = [];
        let sbomRaw: any = null;

        if (resolveComponents) {
            const adapted = await this.inputAdapter.fromGithubUrl(target.repo, target.ref);
            components = adapted.components;
            sbomRaw = adapted.sbomRaw;
        }

        return this.orchestrator.submitScan(userId, 'github_app', {
            inputRef: payload.inputRef || `${target.repo}@${target.ref}`,
            sbomRaw,
            components,
            scenarioInput,
        });
    }

    async triggerWebhookGithubScan(params: {
        userId: string;
        repo: string;
        ref: string;
        installationId?: number;
        trigger: 'push' | 'pull_request';
        deliveryId?: string;
    }): Promise<{ triggered: boolean; duplicate: boolean; scanId: string }> {
        const canonicalPayload: GithubScanPayload = {
            inputRef: params.deliveryId ? `github-webhook:${params.deliveryId}` : `${params.repo}@${params.ref}`,
            github: {
                repo: params.repo,
                ref: params.ref,
                installationId: params.installationId,
            },
        };

        const existing = await this.pool.query(
            `SELECT id FROM scans
             WHERE user_id = $1 AND input_type = 'github_app' AND input_ref = $2
             ORDER BY created_at DESC
             LIMIT 1`,
            [params.userId, canonicalPayload.inputRef]
        );

        if (existing.rows.length > 0) {
            return {
                triggered: false,
                duplicate: true,
                scanId: existing.rows[0].id,
            };
        }

        const submitted = await this.submitGithubAppScan(params.userId, canonicalPayload, {
            resolveComponents: false,
            trigger: params.trigger,
            deliveryId: params.deliveryId,
        });

        return {
            triggered: true,
            duplicate: false,
            scanId: submitted.scanId,
        };
    }

    buildCheckRunContract(input: {
        headSha: string;
        summary: string;
        title?: string;
        detailsUrl?: string;
        failingCount?: number;
        status?: 'queued' | 'in_progress' | 'completed';
    }): GithubCheckRunContract {
        const status = input.status || 'completed';
        const failingCount = input.failingCount ?? 0;
        const conclusion = status === 'completed'
            ? (failingCount > 0 ? 'failure' : 'success')
            : undefined;

        return {
            name: 'VibeScan Security',
            head_sha: input.headSha,
            status,
            conclusion,
            details_url: input.detailsUrl,
            output: {
                title: input.title || 'VibeScan scan result',
                summary: input.summary,
                text: `failing_findings=${failingCount}`,
            }
        };
    }
}

export const githubOrchestratorAdapter = new GithubOrchestratorAdapter();

export default githubOrchestratorAdapter;

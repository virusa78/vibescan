import crypto from 'crypto';
import config from '../config/index.js';

type CheckRunStatus = 'queued' | 'in_progress' | 'completed';
type CheckRunConclusion = 'success' | 'failure' | 'neutral' | 'cancelled';

type GithubCheckRunOutput = {
    title: string;
    summary: string;
    text?: string;
};

type CheckRunRequest = {
    name: string;
    head_sha: string;
    status: CheckRunStatus;
    conclusion?: CheckRunConclusion;
    details_url?: string;
    external_id?: string;
    output: GithubCheckRunOutput;
    completed_at?: string;
};

export class GithubCheckRunService {
    private readonly appId: string | null;
    private readonly privateKey: string | null;
    private readonly apiBaseUrl: string;

    constructor(deps: { appId?: string | null; privateKey?: string | null; apiBaseUrl?: string } = {}) {
        this.appId = deps.appId ?? config.GITHUB_APP_ID;
        this.privateKey = deps.privateKey ?? config.GITHUB_APP_PRIVATE_KEY;
        this.apiBaseUrl = deps.apiBaseUrl || config.GITHUB_API_BASE_URL;
    }

    async createCheckRun(params: {
        installationId: number;
        repoFullName: string;
        payload: CheckRunRequest;
    }): Promise<{ id: number }> {
        const token = await this.createInstallationAccessToken(params.installationId);
        const [owner, repo] = this.parseRepo(params.repoFullName);
        const response = await this.githubRequest(
            `${this.apiBaseUrl}/repos/${owner}/${repo}/check-runs`,
            token,
            'POST',
            params.payload
        );
        return { id: Number(response.id) };
    }

    async updateCheckRun(params: {
        installationId: number;
        repoFullName: string;
        checkRunId: number;
        payload: CheckRunRequest;
    }): Promise<void> {
        const token = await this.createInstallationAccessToken(params.installationId);
        const [owner, repo] = this.parseRepo(params.repoFullName);
        await this.githubRequest(
            `${this.apiBaseUrl}/repos/${owner}/${repo}/check-runs/${params.checkRunId}`,
            token,
            'PATCH',
            params.payload
        );
    }

    private assertCredentials(): { appId: string; privateKey: string } {
        if (!this.appId) {
            throw { code: 'github_app_not_configured', message: 'GITHUB_APP_ID is required for GitHub Check Run publishing' };
        }
        if (!this.privateKey) {
            throw { code: 'github_app_not_configured', message: 'GITHUB_APP_PRIVATE_KEY is required for GitHub Check Run publishing' };
        }
        return { appId: this.appId, privateKey: this.privateKey.replace(/\\n/g, '\n') };
    }

    private parseRepo(repoFullName: string): [string, string] {
        const match = String(repoFullName || '').match(/^([^/]+)\/([^/]+)$/);
        if (!match) {
            throw { code: 'validation_error', message: 'Invalid repository format. Expected owner/repo' };
        }
        return [match[1], match[2]];
    }

    private createAppJwt(): string {
        const { appId, privateKey } = this.assertCredentials();
        const now = Math.floor(Date.now() / 1000);
        const header = this.base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
        const payload = this.base64Url(JSON.stringify({
            iat: now - 60,
            exp: now + 9 * 60,
            iss: appId
        }));
        const unsignedToken = `${header}.${payload}`;
        const signature = crypto.createSign('RSA-SHA256').update(unsignedToken).end().sign(privateKey);
        return `${unsignedToken}.${this.base64Url(signature)}`;
    }

    private async createInstallationAccessToken(installationId: number): Promise<string> {
        const appJwt = this.createAppJwt();
        const response = await fetch(`${this.apiBaseUrl}/app/installations/${installationId}/access_tokens`, {
            method: 'POST',
            headers: {
                Accept: 'application/vnd.github+json',
                Authorization: `Bearer ${appJwt}`,
                'User-Agent': 'vibescan-github-app',
                'X-GitHub-Api-Version': '2022-11-28'
            }
        });

        if (!response.ok) {
            const body = await response.text();
            throw {
                code: 'github_installation_token_failed',
                message: `Failed to create installation token: ${response.status} ${body}`
            };
        }

        const data = await response.json() as { token?: string };
        if (!data.token) {
            throw { code: 'github_installation_token_failed', message: 'GitHub installation token response missing token' };
        }
        return data.token;
    }

    private async githubRequest(url: string, token: string, method: 'POST' | 'PATCH', body: any): Promise<any> {
        const response = await fetch(url, {
            method,
            headers: {
                Accept: 'application/vnd.github+json',
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
                'User-Agent': 'vibescan-github-app',
                'X-GitHub-Api-Version': '2022-11-28'
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const text = await response.text();
            throw {
                code: 'github_check_run_request_failed',
                message: `GitHub Check Run request failed (${response.status}): ${text}`
            };
        }

        return response.json();
    }

    private base64Url(value: string | Buffer): string {
        return Buffer.from(value).toString('base64url');
    }
}

export const githubCheckRunService = new GithubCheckRunService();

export default githubCheckRunService;

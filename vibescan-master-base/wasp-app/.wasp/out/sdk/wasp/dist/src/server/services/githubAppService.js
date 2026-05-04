import * as crypto from 'crypto';
import { getGitHubApiBaseUrl, getGitHubAppId, getGitHubAppPrivateKey, getGitHubAppWebhookSecret, } from './githubAppEnv';
function base64UrlEncode(input) {
    return Buffer.from(input)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
}
function buildGitHubAppJwt() {
    const now = Math.floor(Date.now() / 1000);
    const header = base64UrlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const payload = base64UrlEncode(JSON.stringify({
        iat: now - 60,
        exp: now + 9 * 60,
        iss: getGitHubAppId(),
    }));
    const data = `${header}.${payload}`;
    const signature = crypto
        .createSign('RSA-SHA256')
        .update(data)
        .sign(getGitHubAppPrivateKey());
    return `${data}.${base64UrlEncode(signature)}`;
}
async function githubApiRequest(path, options) {
    const response = await fetch(`${getGitHubApiBaseUrl()}${path}`, {
        method: options.method ?? 'GET',
        headers: {
            Accept: 'application/vnd.github+json',
            Authorization: `${options.useBearer === false ? 'token' : 'Bearer'} ${options.token}`,
            'Content-Type': 'application/json',
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': 'VibeScan-GitHub-App',
        },
        ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    });
    if (!response.ok) {
        const bodyText = await response.text();
        throw new Error(`GitHub API request failed (${response.status}): ${bodyText}`);
    }
    return response.json();
}
export function verifyGitHubWebhookSignature(payload, signatureHeader) {
    if (!signatureHeader?.startsWith('sha256=')) {
        return false;
    }
    const expectedDigest = signatureHeader.slice('sha256='.length);
    const actualDigest = crypto
        .createHmac('sha256', getGitHubAppWebhookSecret())
        .update(payload)
        .digest('hex');
    const expected = Buffer.from(expectedDigest, 'hex');
    const actual = Buffer.from(actualDigest, 'hex');
    if (expected.length !== actual.length) {
        return false;
    }
    return crypto.timingSafeEqual(expected, actual);
}
export async function createGitHubInstallationAccessToken(installationId) {
    const appJwt = buildGitHubAppJwt();
    const result = await githubApiRequest(`/app/installations/${installationId}/access_tokens`, {
        method: 'POST',
        token: appJwt,
    });
    return result.token;
}
export async function getGitHubInstallationMetadata(installationId) {
    const appJwt = buildGitHubAppJwt();
    const result = await githubApiRequest(`/app/installations/${installationId}`, {
        token: appJwt,
    });
    return {
        installationId: String(result.id),
        accountLogin: result.account?.login ?? null,
        accountType: result.account?.type ?? null,
        repositorySelection: result.repository_selection ?? 'all',
    };
}
export async function listGitHubInstallationRepositories(installationId) {
    const token = await createGitHubInstallationAccessToken(installationId);
    const response = await githubApiRequest(`/installation/repositories?per_page=100`, {
        token,
        useBearer: false,
    });
    return (response.repositories ?? []).map((repo) => ({
        id: repo.id,
        fullName: repo.full_name,
        htmlUrl: repo.html_url,
        defaultBranch: repo.default_branch ?? null,
        isPrivate: Boolean(repo.private),
    }));
}
export async function createGitHubCheckRun(installationId, repositoryFullName, body) {
    const [owner, repo] = repositoryFullName.split('/');
    if (!owner || !repo) {
        throw new Error(`Invalid repository full name: ${repositoryFullName}`);
    }
    const token = await createGitHubInstallationAccessToken(installationId);
    return githubApiRequest(`/repos/${owner}/${repo}/check-runs`, {
        method: 'POST',
        token,
        useBearer: false,
        body,
    });
}
export async function updateGitHubCheckRun(installationId, repositoryFullName, checkRunId, body) {
    const [owner, repo] = repositoryFullName.split('/');
    if (!owner || !repo) {
        throw new Error(`Invalid repository full name: ${repositoryFullName}`);
    }
    const token = await createGitHubInstallationAccessToken(installationId);
    return githubApiRequest(`/repos/${owner}/${repo}/check-runs/${checkRunId}`, {
        method: 'PATCH',
        token,
        useBearer: false,
        body,
    });
}
//# sourceMappingURL=githubAppService.js.map
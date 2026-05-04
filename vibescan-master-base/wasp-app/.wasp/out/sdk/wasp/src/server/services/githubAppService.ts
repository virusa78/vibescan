import * as crypto from 'crypto';
import {
  getGitHubApiBaseUrl,
  getGitHubAppId,
  getGitHubAppPrivateKey,
  getGitHubAppWebhookSecret,
} from './githubAppEnv';

export type PersistedGitHubScanContext = {
  source: 'github_app_webhook' | 'github_manual';
  installationId?: string;
  deliveryId?: string;
  checkRunId?: number | null;
  checkRunUrl?: string | null;
  repositoryId?: number;
  repositoryFullName?: string;
  repositoryPrivate?: boolean;
  defaultBranch?: string | null;
  eventType?: 'push' | 'pull_request';
  ref?: string | null;
  branch?: string | null;
  commitSha?: string | null;
  pullRequestNumber?: number | null;
};

export type GitHubInstallationMetadata = {
  installationId: string;
  accountLogin: string | null;
  accountType: string | null;
  repositorySelection: string;
};

export type GitHubInstallationRepository = {
  id: number;
  fullName: string;
  htmlUrl: string;
  defaultBranch: string | null;
  isPrivate: boolean;
};

export type GitHubCheckRunPayload = {
  name: string;
  head_sha: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion?: 'success' | 'failure' | 'neutral' | 'cancelled' | 'skipped' | 'timed_out' | 'action_required';
  details_url?: string;
  output?: {
    title: string;
    summary: string;
  };
};

function base64UrlEncode(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function buildGitHubAppJwt(): string {
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64UrlEncode(
    JSON.stringify({
      iat: now - 60,
      exp: now + 9 * 60,
      iss: getGitHubAppId(),
    }),
  );
  const data = `${header}.${payload}`;
  const signature = crypto
    .createSign('RSA-SHA256')
    .update(data)
    .sign(getGitHubAppPrivateKey());

  return `${data}.${base64UrlEncode(signature)}`;
}

async function githubApiRequest<T>(
  path: string,
  options: {
    method?: string;
    token: string;
    body?: unknown;
    useBearer?: boolean;
  },
): Promise<T> {
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

  return response.json() as Promise<T>;
}

export function verifyGitHubWebhookSignature(
  payload: Buffer | string,
  signatureHeader: string | undefined,
): boolean {
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

export async function createGitHubInstallationAccessToken(
  installationId: number | bigint | string,
): Promise<string> {
  const appJwt = buildGitHubAppJwt();
  const result = await githubApiRequest<{ token: string }>(
    `/app/installations/${installationId}/access_tokens`,
    {
      method: 'POST',
      token: appJwt,
    },
  );

  return result.token;
}

export async function getGitHubInstallationMetadata(
  installationId: number | bigint | string,
): Promise<GitHubInstallationMetadata> {
  const appJwt = buildGitHubAppJwt();
  const result = await githubApiRequest<{
    id: number;
    account?: {
      login?: string;
      type?: string;
    } | null;
    repository_selection?: string;
  }>(`/app/installations/${installationId}`, {
    token: appJwt,
  });

  return {
    installationId: String(result.id),
    accountLogin: result.account?.login ?? null,
    accountType: result.account?.type ?? null,
    repositorySelection: result.repository_selection ?? 'all',
  };
}

export async function listGitHubInstallationRepositories(
  installationId: number | bigint | string,
): Promise<GitHubInstallationRepository[]> {
  const token = await createGitHubInstallationAccessToken(installationId);
  const response = await githubApiRequest<{
    repositories?: Array<{
      id: number;
      full_name: string;
      html_url: string;
      default_branch?: string | null;
      private?: boolean;
    }>;
  }>(`/installation/repositories?per_page=100`, {
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

export async function createGitHubCheckRun(
  installationId: number | bigint | string,
  repositoryFullName: string,
  body: GitHubCheckRunPayload,
): Promise<{ id: number; html_url?: string | null }> {
  const [owner, repo] = repositoryFullName.split('/');
  if (!owner || !repo) {
    throw new Error(`Invalid repository full name: ${repositoryFullName}`);
  }

  const token = await createGitHubInstallationAccessToken(installationId);
  return githubApiRequest<{ id: number; html_url?: string | null }>(`/repos/${owner}/${repo}/check-runs`, {
    method: 'POST',
    token,
    useBearer: false,
    body,
  });
}

export async function updateGitHubCheckRun(
  installationId: number | bigint | string,
  repositoryFullName: string,
  checkRunId: number | string,
  body: Omit<GitHubCheckRunPayload, 'name' | 'head_sha'> & { details_url?: string },
): Promise<{ id: number; html_url?: string | null }> {
  const [owner, repo] = repositoryFullName.split('/');
  if (!owner || !repo) {
    throw new Error(`Invalid repository full name: ${repositoryFullName}`);
  }

  const token = await createGitHubInstallationAccessToken(installationId);
  return githubApiRequest<{ id: number; html_url?: string | null }>(
    `/repos/${owner}/${repo}/check-runs/${checkRunId}`,
    {
      method: 'PATCH',
      token,
      useBearer: false,
      body,
    },
  );
}

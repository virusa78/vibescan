import { getRedisHost, getRedisPort, shouldEmbedWorkersFromEnv } from './env.js';

export const DEFAULT_BACKEND_URL = 'http://127.0.0.1:3555';
export const DEFAULT_FRONTEND_URL = 'http://127.0.0.1:3000';

function normalizeBaseUrl(value: string | undefined, fallback: string): string {
  return (value ?? fallback).replace(/\/$/, '');
}

export function getBackendBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  return normalizeBaseUrl(
    env.WASP_SERVER_URL ||
      env.API_URL ||
      env.VITE_API_PROXY_TARGET ||
      env.REACT_APP_API_URL ||
      env.NEXT_PUBLIC_API_URL,
    DEFAULT_BACKEND_URL,
  );
}

export function getFrontendBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  return normalizeBaseUrl(
    env.WASP_WEB_CLIENT_URL ||
      env.FRONTEND_URL ||
      env.REACT_APP_API_URL ||
      env.NEXT_PUBLIC_API_URL,
    DEFAULT_FRONTEND_URL,
  );
}

export function getRedisConnectionConfig(env: NodeJS.ProcessEnv = process.env): { host: string; port: number } {
  const redisUrl = env.REDIS_URL?.trim();
  if (redisUrl) {
    try {
      const parsedUrl = new URL(redisUrl);
      const parsedPortFromUrl = Number.parseInt(parsedUrl.port || '6379', 10);

      return {
        host: parsedUrl.hostname || '127.0.0.1',
        port: Number.isNaN(parsedPortFromUrl) ? 6379 : parsedPortFromUrl,
      };
    } catch {
      // Fall through to host/port parsing below if REDIS_URL is malformed.
    }
  }

  return {
    host: getRedisHost(env),
    port: getRedisPort(env),
  };
}

export function shouldUseEmbeddedWorkers(env: NodeJS.ProcessEnv = process.env): boolean {
  return shouldEmbedWorkersFromEnv(env);
}

export function isSnykScanningEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = env.VIBESCAN_ENABLE_SNYK_SCANNER?.trim().toLowerCase();
  return raw === 'true' || raw === '1' || raw === 'yes';
}

export function getSnykCredentialMode(
  env: NodeJS.ProcessEnv = process.env,
): 'auto' | 'environment' | 'user-secret' {
  const raw = env.VIBESCAN_SNYK_CREDENTIAL_MODE?.trim().toLowerCase();
  if (raw === 'environment' || raw === 'user-secret') {
    return raw;
  }

  return 'auto';
}

export function getSnykOrgId(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const orgId = env.SNYK_ORG_ID?.trim();
  return orgId || undefined;
}

export function getSnykTimeoutMs(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.SNYK_TIMEOUT_MS?.trim();
  const parsed = raw ? Number.parseInt(raw, 10) : 120000;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 120000;
}

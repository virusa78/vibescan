import { getRedisHost, getRedisPort, shouldEmbedWorkersFromEnv } from './env.js';
export const DEFAULT_BACKEND_URL = 'http://127.0.0.1:3555';
export const DEFAULT_FRONTEND_URL = 'http://127.0.0.1:3000';
function normalizeBaseUrl(value, fallback) {
    return (value ?? fallback).replace(/\/$/, '');
}
export function getBackendBaseUrl(env = process.env) {
    return normalizeBaseUrl(env.WASP_SERVER_URL ||
        env.API_URL ||
        env.VITE_API_PROXY_TARGET ||
        env.REACT_APP_API_URL ||
        env.NEXT_PUBLIC_API_URL, DEFAULT_BACKEND_URL);
}
export function getFrontendBaseUrl(env = process.env) {
    return normalizeBaseUrl(env.WASP_WEB_CLIENT_URL ||
        env.FRONTEND_URL ||
        env.REACT_APP_API_URL ||
        env.NEXT_PUBLIC_API_URL, DEFAULT_FRONTEND_URL);
}
export function getRedisConnectionConfig(env = process.env) {
    const redisUrl = env.REDIS_URL?.trim();
    if (redisUrl) {
        try {
            const parsedUrl = new URL(redisUrl);
            const parsedPortFromUrl = Number.parseInt(parsedUrl.port || '6379', 10);
            return {
                host: parsedUrl.hostname || '127.0.0.1',
                port: Number.isNaN(parsedPortFromUrl) ? 6379 : parsedPortFromUrl,
            };
        }
        catch {
            // Fall through to host/port parsing below if REDIS_URL is malformed.
        }
    }
    return {
        host: getRedisHost(env),
        port: getRedisPort(env),
    };
}
export function shouldUseEmbeddedWorkers(env = process.env) {
    return shouldEmbedWorkersFromEnv(env);
}
export function isSnykScanningEnabled(env = process.env) {
    const raw = env.VIBESCAN_ENABLE_SNYK_SCANNER?.trim().toLowerCase();
    return raw === 'true' || raw === '1' || raw === 'yes';
}
export function getSnykCredentialMode(env = process.env) {
    const raw = env.VIBESCAN_SNYK_CREDENTIAL_MODE?.trim().toLowerCase();
    if (raw === 'environment' || raw === 'user-secret') {
        return raw;
    }
    return 'auto';
}
export function getSnykOrgId(env = process.env) {
    const orgId = env.SNYK_ORG_ID?.trim();
    return orgId || undefined;
}
export function getSnykTimeoutMs(env = process.env) {
    const raw = env.SNYK_TIMEOUT_MS?.trim();
    const parsed = raw ? Number.parseInt(raw, 10) : 120000;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 120000;
}
//# sourceMappingURL=runtime.js.map
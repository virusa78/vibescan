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
  const host = env.REDIS_HOST || '127.0.0.1';
  const parsedPort = Number.parseInt(env.REDIS_PORT || '6379', 10);

  return {
    host,
    port: Number.isNaN(parsedPort) ? 6379 : parsedPort,
  };
}

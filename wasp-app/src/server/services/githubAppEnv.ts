import * as z from 'zod';

const emptyStringToUndefined = (value: unknown) => {
  if (typeof value === 'string' && value.trim() === '') {
    return undefined;
  }

  return value;
};

const optionalStringSchema = z.preprocess(emptyStringToUndefined, z.string().trim().optional());
const optionalUrlSchema = z.preprocess(emptyStringToUndefined, z.string().url().optional());

export const githubAppEnvSchema = z.object({
  GITHUB_APP_ID: optionalStringSchema,
  GITHUB_APP_SLUG: optionalStringSchema,
  GITHUB_APP_PRIVATE_KEY: optionalStringSchema,
  GITHUB_APP_WEBHOOK_SECRET: optionalStringSchema,
  GITHUB_APP_API_BASE_URL: optionalUrlSchema,
});

export function getMissingGitHubAppEnvVars(env: NodeJS.ProcessEnv = process.env): string[] {
  const missing: string[] = [];

  if (!env.GITHUB_APP_ID?.trim()) missing.push('GITHUB_APP_ID');
  if (!env.GITHUB_APP_PRIVATE_KEY?.trim()) missing.push('GITHUB_APP_PRIVATE_KEY');
  if (!env.GITHUB_APP_WEBHOOK_SECRET?.trim()) missing.push('GITHUB_APP_WEBHOOK_SECRET');

  return missing;
}

export function isGitHubAppConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return getMissingGitHubAppEnvVars(env).length === 0;
}

export function getGitHubAppId(env: NodeJS.ProcessEnv = process.env): string {
  const appId = env.GITHUB_APP_ID?.trim();
  if (!appId) {
    throw new Error('GITHUB_APP_ID is required');
  }

  return appId;
}

export function getGitHubAppSlug(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const appSlug = env.GITHUB_APP_SLUG?.trim();
  return appSlug || undefined;
}

export function getGitHubAppPrivateKey(env: NodeJS.ProcessEnv = process.env): string {
  const rawPrivateKey = env.GITHUB_APP_PRIVATE_KEY?.trim();
  if (!rawPrivateKey) {
    throw new Error('GITHUB_APP_PRIVATE_KEY is required');
  }

  return rawPrivateKey.replace(/\\n/g, '\n');
}

export function getGitHubAppWebhookSecret(env: NodeJS.ProcessEnv = process.env): string {
  const webhookSecret = env.GITHUB_APP_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) {
    throw new Error('GITHUB_APP_WEBHOOK_SECRET is required');
  }

  return webhookSecret;
}

export function getGitHubApiBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  return env.GITHUB_APP_API_BASE_URL?.trim() || 'https://api.github.com';
}

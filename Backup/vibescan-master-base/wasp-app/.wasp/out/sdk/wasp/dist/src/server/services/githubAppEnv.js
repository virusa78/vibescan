import * as z from 'zod';
const emptyStringToUndefined = (value) => {
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
export function isGitHubAppConfigured(env = process.env) {
    return Boolean(env.GITHUB_APP_ID?.trim()
        && env.GITHUB_APP_PRIVATE_KEY?.trim()
        && env.GITHUB_APP_WEBHOOK_SECRET?.trim());
}
export function getGitHubAppId(env = process.env) {
    const appId = env.GITHUB_APP_ID?.trim();
    if (!appId) {
        throw new Error('GITHUB_APP_ID is required');
    }
    return appId;
}
export function getGitHubAppSlug(env = process.env) {
    const appSlug = env.GITHUB_APP_SLUG?.trim();
    return appSlug || undefined;
}
export function getGitHubAppPrivateKey(env = process.env) {
    const rawPrivateKey = env.GITHUB_APP_PRIVATE_KEY?.trim();
    if (!rawPrivateKey) {
        throw new Error('GITHUB_APP_PRIVATE_KEY is required');
    }
    return rawPrivateKey.replace(/\\n/g, '\n');
}
export function getGitHubAppWebhookSecret(env = process.env) {
    const webhookSecret = env.GITHUB_APP_WEBHOOK_SECRET?.trim();
    if (!webhookSecret) {
        throw new Error('GITHUB_APP_WEBHOOK_SECRET is required');
    }
    return webhookSecret;
}
export function getGitHubApiBaseUrl(env = process.env) {
    return env.GITHUB_APP_API_BASE_URL?.trim() || 'https://api.github.com';
}
//# sourceMappingURL=githubAppEnv.js.map
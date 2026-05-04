import * as z from 'zod';
export declare const githubAppEnvSchema: z.ZodObject<{
    GITHUB_APP_ID: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodOptional<z.ZodString>>;
    GITHUB_APP_SLUG: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodOptional<z.ZodString>>;
    GITHUB_APP_PRIVATE_KEY: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodOptional<z.ZodString>>;
    GITHUB_APP_WEBHOOK_SECRET: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodOptional<z.ZodString>>;
    GITHUB_APP_API_BASE_URL: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodOptional<z.ZodString>>;
}, z.core.$strip>;
export declare function isGitHubAppConfigured(env?: NodeJS.ProcessEnv): boolean;
export declare function getGitHubAppId(env?: NodeJS.ProcessEnv): string;
export declare function getGitHubAppSlug(env?: NodeJS.ProcessEnv): string | undefined;
export declare function getGitHubAppPrivateKey(env?: NodeJS.ProcessEnv): string;
export declare function getGitHubAppWebhookSecret(env?: NodeJS.ProcessEnv): string;
export declare function getGitHubApiBaseUrl(env?: NodeJS.ProcessEnv): string;
//# sourceMappingURL=githubAppEnv.d.ts.map
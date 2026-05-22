export declare const DEFAULT_BACKEND_URL = "http://127.0.0.1:3555";
export declare const DEFAULT_FRONTEND_URL = "http://127.0.0.1:3000";
export declare function getBackendBaseUrl(env?: NodeJS.ProcessEnv): string;
export declare function getFrontendBaseUrl(env?: NodeJS.ProcessEnv): string;
export declare function getRedisConnectionConfig(env?: NodeJS.ProcessEnv): {
    host: string;
    port: number;
};
export declare function shouldUseEmbeddedWorkers(env?: NodeJS.ProcessEnv): boolean;
export declare function isSnykScanningEnabled(env?: NodeJS.ProcessEnv): boolean;
export declare function getSnykCredentialMode(env?: NodeJS.ProcessEnv): 'auto' | 'environment' | 'user-secret';
export declare function getSnykOrgId(env?: NodeJS.ProcessEnv): string | undefined;
export declare function getSnykTimeoutMs(env?: NodeJS.ProcessEnv): number;
//# sourceMappingURL=runtime.d.ts.map
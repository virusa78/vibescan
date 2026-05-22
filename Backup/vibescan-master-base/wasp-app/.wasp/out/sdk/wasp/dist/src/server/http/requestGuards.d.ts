export declare const DEFAULT_JSON_BODY_LIMIT_BYTES: number;
export declare function parseJsonBodyWithLimit<T extends Record<string, unknown>>(body: unknown, limitBytes?: number): T;
export declare function enforceRateLimit(options: {
    key: string;
    limit: number;
    windowSeconds: number;
}): Promise<void>;
export declare function getRateLimitKey(scope: string, identity: string): string;
//# sourceMappingURL=requestGuards.d.ts.map
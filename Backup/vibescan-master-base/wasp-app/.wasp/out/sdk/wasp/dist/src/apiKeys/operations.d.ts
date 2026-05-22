import type { ApiKey } from 'wasp/entities';
/**
 * Generate a new API key for the authenticated user
 */
export declare function generateApiKey(args: {
    name: string;
}, context: any): Promise<{
    id: string;
    key: string;
    name: string;
    createdAt: Date;
}>;
/**
 * List all API keys for the authenticated user
 */
export declare function listApiKeys(_args: void, context: any): Promise<Array<Omit<ApiKey, 'keyHash'>>>;
/**
 * Revoke an API key (disable or delete)
 */
export declare function revokeApiKey(args: {
    id: string;
}, context: any): Promise<{
    success: boolean;
}>;
//# sourceMappingURL=operations.d.ts.map
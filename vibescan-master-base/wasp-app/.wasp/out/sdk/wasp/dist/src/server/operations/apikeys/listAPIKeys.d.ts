export type APIKeyInfo = {
    id: string;
    name: string;
    masked_key: string;
    created_at: string;
    expires_at: string | null;
    last_used_at: string | null;
    status: 'active' | 'revoked' | 'expired';
};
export type APIKeyListResponse = {
    keys: APIKeyInfo[];
};
export declare function listAPIKeys(_args: unknown, context: any): Promise<any>;
//# sourceMappingURL=listAPIKeys.d.ts.map
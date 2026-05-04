type RequestLike = {
    headers: Record<string, string | string[] | undefined>;
    user?: {
        id: string;
        workspaceId?: string | null;
    } | null;
};
type ContextLike = {
    user?: {
        id: string;
        workspaceId?: string | null;
    } | null;
    entities?: Record<string, unknown>;
};
type AuthenticatedUser = {
    id: string;
    workspaceId: string;
};
export declare function authenticateBearerApiKey(authorization: string | undefined): Promise<AuthenticatedUser | null>;
export declare function resolveRequestUser(request: RequestLike, context: ContextLike): Promise<AuthenticatedUser | null>;
export {};
//# sourceMappingURL=requestAuth.d.ts.map
import * as z from 'zod';
declare const getAPIKeyDetailsSchema: z.ZodObject<{
    keyId: z.ZodString;
}, z.core.$strip>;
export type GetAPIKeyDetailsInput = z.infer<typeof getAPIKeyDetailsSchema>;
export type APIKeyDetailsResponse = {
    id: string;
    name: string;
    created_at: string;
    expires_at: string | null;
    last_used_at: string | null;
    request_count: number;
    usage_by_day: Array<{
        date: string;
        count: number;
    }>;
    status: 'active' | 'revoked' | 'expired';
};
export declare function getAPIKeyDetails(rawArgs: unknown, context: any): Promise<any>;
export {};
//# sourceMappingURL=getAPIKeyDetails.d.ts.map
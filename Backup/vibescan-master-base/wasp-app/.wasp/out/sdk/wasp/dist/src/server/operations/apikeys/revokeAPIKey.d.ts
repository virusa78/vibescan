import * as z from 'zod';
declare const revokeAPIKeySchema: z.ZodObject<{
    keyId: z.ZodString;
}, z.core.$strip>;
export type RevokeAPIKeyInput = z.infer<typeof revokeAPIKeySchema>;
export type ActionResponse = {
    success: boolean;
    message: string;
};
export declare function revokeAPIKey(rawArgs: unknown, context: any): Promise<any>;
export {};
//# sourceMappingURL=revokeAPIKey.d.ts.map
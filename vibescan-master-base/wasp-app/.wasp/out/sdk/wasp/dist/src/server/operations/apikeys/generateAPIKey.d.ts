import * as z from 'zod';
declare const generateAPIKeySchema: z.ZodObject<{
    name: z.ZodString;
    expiresIn: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        never: "never";
        30: "30";
        90: "90";
        365: "365";
    }>>>;
}, z.core.$strip>;
export type GenerateAPIKeyInput = z.infer<typeof generateAPIKeySchema>;
export type APIKeyResponse = {
    id: string;
    name: string;
    key: string;
    created_at: string;
    expires_at: string | null;
};
export declare function generateAPIKey(rawArgs: unknown, context: any): Promise<any>;
export {};
//# sourceMappingURL=generateAPIKey.d.ts.map
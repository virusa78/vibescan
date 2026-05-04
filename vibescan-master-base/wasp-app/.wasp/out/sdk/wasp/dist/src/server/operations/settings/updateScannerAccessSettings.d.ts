import * as z from 'zod';
declare const updateScannerAccessSettingsSchema: z.ZodObject<{
    snyk_api_key: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, z.core.$strip>;
export type UpdateScannerAccessSettingsInput = z.infer<typeof updateScannerAccessSettingsSchema>;
export declare function updateScannerAccessSettings(rawArgs: unknown, context: any): Promise<any>;
export {};
//# sourceMappingURL=updateScannerAccessSettings.d.ts.map
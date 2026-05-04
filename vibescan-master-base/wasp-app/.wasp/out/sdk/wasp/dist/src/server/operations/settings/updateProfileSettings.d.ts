import * as z from 'zod';
declare const updateProfileSettingsSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    region: z.ZodOptional<z.ZodEnum<{
        IN: "IN";
        PK: "PK";
        OTHER: "OTHER";
    }>>;
    notifications_enabled: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export type UpdateProfileSettingsInput = z.infer<typeof updateProfileSettingsSchema>;
export declare function updateProfileSettings(rawArgs: unknown, context: any): Promise<any>;
export {};
//# sourceMappingURL=updateProfileSettings.d.ts.map
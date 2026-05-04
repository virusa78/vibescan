import * as z from 'zod';
declare const updateNotificationSettingsSchema: z.ZodObject<{
    email_on_scan_complete: z.ZodOptional<z.ZodBoolean>;
    email_on_vulnerability: z.ZodOptional<z.ZodBoolean>;
    weekly_digest: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export type UpdateNotificationSettingsInput = z.infer<typeof updateNotificationSettingsSchema>;
export declare function updateNotificationSettings(rawArgs: unknown, context: any): Promise<any>;
export {};
//# sourceMappingURL=updateNotificationSettings.d.ts.map
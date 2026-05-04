import * as z from 'zod';
declare const updateWebhookInputSchema: z.ZodObject<{
    webhookId: z.ZodString;
    url: z.ZodOptional<z.ZodString>;
    events: z.ZodOptional<z.ZodArray<z.ZodEnum<{
        scan_complete: "scan_complete";
        scan_failed: "scan_failed";
        report_ready: "report_ready";
    }>>>;
    enabled: z.ZodOptional<z.ZodBoolean>;
    rotateSecret: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, z.core.$strip>;
export type UpdateWebhookInput = z.infer<typeof updateWebhookInputSchema>;
export interface WebhookResponse {
    id: string;
    url: string;
    events: string[];
    enabled: boolean;
    updated_at: Date;
}
/**
 * Update an existing webhook configuration
 * Enforces strict ownership boundary and consistent data model
 */
export declare function updateWebhook(rawArgs: unknown, context: any): Promise<any>;
export {};
//# sourceMappingURL=updateWebhook.d.ts.map
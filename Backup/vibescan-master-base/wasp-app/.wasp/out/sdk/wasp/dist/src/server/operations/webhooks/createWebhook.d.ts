import * as z from 'zod';
declare const createWebhookInputSchema: z.ZodObject<{
    url: z.ZodString;
    events: z.ZodArray<z.ZodEnum<{
        scan_complete: "scan_complete";
        scan_failed: "scan_failed";
        report_ready: "report_ready";
    }>>;
}, z.core.$strip>;
export type CreateWebhookInput = z.infer<typeof createWebhookInputSchema>;
export interface WebhookResponse {
    id: string;
    url: string;
    created_at: Date;
    events: string[];
    secret_preview: string;
}
/**
 * Create a new webhook for the authenticated user
 * Generates HMAC-SHA256 signing secret for webhook verification
 * Encrypts the secret using AES-256-GCM before storing in database
 */
export declare function createWebhook(rawArgs: unknown, context: any): Promise<any>;
export {};
//# sourceMappingURL=createWebhook.d.ts.map
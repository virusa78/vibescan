import * as z from 'zod';
declare const getWebhookInputSchema: z.ZodObject<{
    webhookId: z.ZodString;
}, z.core.$strip>;
export type GetWebhookInput = z.infer<typeof getWebhookInputSchema>;
/**
 * Get detailed webhook information including delivery stats
 */
export declare function getWebhook(rawArgs: unknown, context: any): Promise<any>;
export {};
//# sourceMappingURL=getWebhook.d.ts.map
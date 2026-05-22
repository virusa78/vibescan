import * as z from 'zod';
declare const deleteWebhookInputSchema: z.ZodObject<{
    webhookId: z.ZodString;
}, z.core.$strip>;
export type DeleteWebhookInput = z.infer<typeof deleteWebhookInputSchema>;
/**
 * Delete a webhook and mark its deliveries as cancelled
 */
export declare function deleteWebhook(rawArgs: unknown, context: any): Promise<any>;
export {};
//# sourceMappingURL=deleteWebhook.d.ts.map
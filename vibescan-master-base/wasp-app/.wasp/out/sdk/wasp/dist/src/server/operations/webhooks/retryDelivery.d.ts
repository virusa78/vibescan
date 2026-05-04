import * as z from 'zod';
declare const retryDeliveryInputSchema: z.ZodObject<{
    webhookId: z.ZodString;
    deliveryId: z.ZodString;
}, z.core.$strip>;
export type RetryWebhookDeliveryInput = z.infer<typeof retryDeliveryInputSchema>;
export declare function retryWebhookDelivery(rawArgs: unknown, context: any): Promise<any>;
export {};
//# sourceMappingURL=retryDelivery.d.ts.map
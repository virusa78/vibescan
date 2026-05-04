import * as z from 'zod';
declare const testDeliveryInputSchema: z.ZodObject<{
    webhookId: z.ZodString;
}, z.core.$strip>;
export type TestWebhookDeliveryInput = z.infer<typeof testDeliveryInputSchema>;
export declare function testWebhookDelivery(rawArgs: unknown, context: any): Promise<any>;
export {};
//# sourceMappingURL=testDelivery.d.ts.map
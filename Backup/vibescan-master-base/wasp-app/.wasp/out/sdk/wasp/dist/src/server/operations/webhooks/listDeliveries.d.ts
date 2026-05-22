import * as z from 'zod';
declare const listDeliveriesInputSchema: z.ZodObject<{
    webhookId: z.ZodString;
    limit: z.ZodDefault<z.ZodNumber>;
    cursor: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type ListWebhookDeliveriesInput = z.infer<typeof listDeliveriesInputSchema>;
export declare function listWebhookDeliveries(rawArgs: unknown, context: any): Promise<any>;
export {};
//# sourceMappingURL=listDeliveries.d.ts.map
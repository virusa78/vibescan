import * as z from 'zod';
declare const createEventSubscriptionInputSchema: z.ZodObject<{
    name: z.ZodString;
    destination_type: z.ZodEnum<{
        zoho_crm: "zoho_crm";
        generic_webhook: "generic_webhook";
        observability_sink: "observability_sink";
    }>;
    event_types: z.ZodArray<z.ZodString>;
    categories: z.ZodArray<z.ZodEnum<{
        scan: "scan";
        scanner_comparison: "scanner_comparison";
        customer: "customer";
        billing: "billing";
        quota: "quota";
        report: "report";
        remediation: "remediation";
        vulnerability: "vulnerability";
        integration: "integration";
        system: "system";
    }>>;
    destination_config: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    enabled: z.ZodOptional<z.ZodBoolean>;
    signing_secret: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type CreateEventSubscriptionInput = z.infer<typeof createEventSubscriptionInputSchema>;
export declare function createEventSubscription(rawArgs: unknown, context: any): Promise<any>;
export {};
//# sourceMappingURL=createSubscription.d.ts.map
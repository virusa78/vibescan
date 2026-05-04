import * as z from 'zod';
declare const generateCveRemediationInputSchema: z.ZodObject<{
    scanId: z.ZodString;
    findingId: z.ZodString;
    requestKey: z.ZodString;
    promptType: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type GenerateCveRemediationInput = z.infer<typeof generateCveRemediationInputSchema>;
export declare function generateCveRemediation(rawArgs: unknown, context: any): Promise<any>;
export {};
//# sourceMappingURL=generateCveRemediation.d.ts.map
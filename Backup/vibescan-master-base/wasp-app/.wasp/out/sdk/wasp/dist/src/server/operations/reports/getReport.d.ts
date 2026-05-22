import * as z from "zod";
declare const getReportInputSchema: z.ZodObject<{
    scanId: z.ZodString;
}, z.core.$strip>;
export type GetReportInput = z.infer<typeof getReportInputSchema>;
export declare const getReport: (rawArgs: unknown, context: any) => Promise<any>;
export {};
//# sourceMappingURL=getReport.d.ts.map
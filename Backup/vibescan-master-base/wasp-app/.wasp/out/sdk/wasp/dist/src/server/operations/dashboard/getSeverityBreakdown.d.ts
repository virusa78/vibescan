import * as z from 'zod';
declare const getSeverityBreakdownInputSchema: z.ZodObject<{
    time_range: z.ZodDefault<z.ZodEnum<{
        "7d": "7d";
        "30d": "30d";
        all: "all";
    }>>;
}, z.core.$strip>;
export type GetSeverityBreakdownInput = z.infer<typeof getSeverityBreakdownInputSchema>;
export interface SeverityBreakdownResponse {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
    total: number;
    time_range: string;
}
export declare function getSeverityBreakdown(rawArgs: unknown, context: any): Promise<any>;
export {};
//# sourceMappingURL=getSeverityBreakdown.d.ts.map
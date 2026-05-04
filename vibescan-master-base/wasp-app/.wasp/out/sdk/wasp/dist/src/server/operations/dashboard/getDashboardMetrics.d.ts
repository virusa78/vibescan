import * as z from 'zod';
declare const getDashboardMetricsInputSchema: z.ZodObject<{
    time_range: z.ZodDefault<z.ZodEnum<{
        "7d": "7d";
        "30d": "30d";
        all: "all";
    }>>;
}, z.core.$strip>;
export type GetDashboardMetricsInput = z.infer<typeof getDashboardMetricsInputSchema>;
export interface MetricsResponse {
    total_scans: number;
    scans_this_month: number;
    total_vulnerabilities: number;
    avg_severity: string | null;
    quota_used: number;
    quota_limit: number;
    plan_tier: string;
    vulnerabilities_by_source: Record<string, number>;
    time_range: string;
}
export declare function getDashboardMetrics(rawArgs: unknown, context: any): Promise<any>;
export {};
//# sourceMappingURL=getDashboardMetrics.d.ts.map
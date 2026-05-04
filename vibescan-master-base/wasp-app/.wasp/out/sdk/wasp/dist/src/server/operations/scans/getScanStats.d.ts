import * as z from 'zod';
declare const getScanStatsInputSchema: z.ZodObject<{
    time_range: z.ZodDefault<z.ZodString>;
}, z.core.$strip>;
export type GetScanStatsInput = z.infer<typeof getScanStatsInputSchema>;
export interface ScanStatsResponse {
    total_scans: number;
    by_status: {
        pending: number;
        scanning: number;
        done: number;
        error: number;
        cancelled: number;
    };
    by_severity: {
        critical: number;
        high: number;
        medium: number;
        low: number;
        info: number;
    };
    scan_rate: {
        per_day: number;
        per_week: number;
    };
    by_source: Record<string, number>;
    time_range: string;
}
export declare function getScanStats(rawArgs: unknown, context: any): Promise<any>;
export {};
//# sourceMappingURL=getScanStats.d.ts.map
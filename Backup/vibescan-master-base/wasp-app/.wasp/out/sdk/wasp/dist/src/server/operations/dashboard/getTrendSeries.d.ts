import * as z from 'zod';
declare const getTrendSeriesInputSchema: z.ZodObject<{
    time_range: z.ZodDefault<z.ZodEnum<{
        "7d": "7d";
        "30d": "30d";
        all: "all";
    }>>;
    granularity: z.ZodOptional<z.ZodEnum<{
        day: "day";
        week: "week";
    }>>;
}, z.core.$strip>;
export type GetTrendSeriesInput = z.infer<typeof getTrendSeriesInputSchema>;
export type TrendGranularity = 'day' | 'week';
export interface TrendBucket {
    bucket_start: string;
    scans: number;
    findings: number;
    delta: number;
    findings_by_source: Record<string, number>;
}
export interface TrendSeriesResponse {
    time_range: '7d' | '30d' | 'all';
    granularity: TrendGranularity;
    buckets: TrendBucket[];
    totals: {
        scans: number;
        findings: number;
        delta: number;
        findings_by_source: Record<string, number>;
    };
}
export declare function getTrendSeries(rawArgs: unknown, context: any): Promise<any>;
export {};
//# sourceMappingURL=getTrendSeries.d.ts.map
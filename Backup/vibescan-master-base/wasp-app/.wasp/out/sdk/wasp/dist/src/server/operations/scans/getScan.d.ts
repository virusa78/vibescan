import * as z from 'zod';
declare const getScanInputSchema: z.ZodObject<{
    scan_id: z.ZodString;
}, z.core.$strip>;
export type GetScanInput = z.infer<typeof getScanInputSchema>;
export interface ScanDetailResponse {
    scan: {
        id: string;
        status: string;
        inputType: string;
        inputRef: string;
        planAtSubmission: string;
        planned_sources: string[];
        created_at: Date;
        completed_at: Date | null;
        error_message: string | null;
    };
    results_summary: {
        free_count: number;
        enterprise_count: number;
        total_count: number;
        counts_by_source: Record<string, number>;
    };
    delta_summary: {
        delta_count: number;
        delta_by_severity: Record<string, number>;
        is_locked: boolean;
    };
    status: string;
}
export declare function getScan(rawArgs: unknown, context: any): Promise<any>;
export {};
//# sourceMappingURL=getScan.d.ts.map
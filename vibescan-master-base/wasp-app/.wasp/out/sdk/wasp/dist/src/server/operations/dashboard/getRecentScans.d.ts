import * as z from 'zod';
import { mapRecentScans } from './recentScanMapper';
declare const scanStatusSchema: z.ZodEnum<{
    error: "error";
    pending: "pending";
    scanning: "scanning";
    done: "done";
    cancelled: "cancelled";
}>;
declare const sortFieldSchema: z.ZodEnum<{
    type: "type";
    target: "target";
    status: "status";
    findings: "findings";
    submitted: "submitted";
}>;
declare const sortDirectionSchema: z.ZodEnum<{
    asc: "asc";
    desc: "desc";
}>;
export type ScanStatusValue = z.infer<typeof scanStatusSchema>;
export type ScanSortField = z.infer<typeof sortFieldSchema>;
export type ScanSortDirection = z.infer<typeof sortDirectionSchema>;
export interface SortDescriptor {
    field: ScanSortField;
    direction: ScanSortDirection;
}
declare const getRecentScansInputSchema: z.ZodObject<{
    limit: z.ZodDefault<z.ZodNumber>;
    status: z.ZodDefault<z.ZodArray<z.ZodEnum<{
        error: "error";
        pending: "pending";
        scanning: "scanning";
        done: "done";
        cancelled: "cancelled";
    }>>>;
    q: z.ZodOptional<z.ZodString>;
    sort: z.ZodDefault<z.ZodArray<z.ZodObject<{
        field: z.ZodEnum<{
            type: "type";
            target: "target";
            status: "status";
            findings: "findings";
            submitted: "submitted";
        }>;
        direction: z.ZodEnum<{
            asc: "asc";
            desc: "desc";
        }>;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export type GetRecentScansInput = z.infer<typeof getRecentScansInputSchema>;
export interface RecentScansResponse {
    scans: ReturnType<typeof mapRecentScans>;
    status_counts: Record<ScanStatusValue, number>;
    total_count: number;
    filtered_count: number;
}
export declare function getRecentScans(rawArgs: unknown, context: any): Promise<any>;
export {};
//# sourceMappingURL=getRecentScans.d.ts.map
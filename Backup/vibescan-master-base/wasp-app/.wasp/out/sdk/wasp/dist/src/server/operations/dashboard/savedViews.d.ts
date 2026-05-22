import * as z from 'zod';
declare const savedViewConfigSchema: z.ZodObject<{
    sortField: z.ZodEnum<{
        type: "type";
        target: "target";
        status: "status";
        findings: "findings";
        submitted: "submitted";
    }>;
    sortDirection: z.ZodEnum<{
        asc: "asc";
        desc: "desc";
    }>;
    statuses: z.ZodArray<z.ZodEnum<{
        error: "error";
        pending: "pending";
        scanning: "scanning";
        done: "done";
        cancelled: "cancelled";
    }>>;
    query: z.ZodDefault<z.ZodString>;
}, z.core.$strip>;
export type SavedViewConfig = z.infer<typeof savedViewConfigSchema>;
export interface ScanSavedView extends SavedViewConfig {
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
}
export declare function listScanSavedViews(_rawArgs: unknown, context: any): Promise<any>;
export declare function createScanSavedView(rawArgs: unknown, context: any): Promise<any>;
export declare function updateScanSavedView(rawArgs: unknown, context: any): Promise<any>;
export declare function deleteScanSavedView(rawArgs: unknown, context: any): Promise<any>;
export {};
//# sourceMappingURL=savedViews.d.ts.map
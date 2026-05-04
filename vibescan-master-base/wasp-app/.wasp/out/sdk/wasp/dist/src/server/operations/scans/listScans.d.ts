import * as z from 'zod';
import { mapScanSummary } from './shared.js';
declare const listScansInputSchema: z.ZodObject<{
    limit: z.ZodDefault<z.ZodNumber>;
    offset: z.ZodDefault<z.ZodNumber>;
    status: z.ZodOptional<z.ZodString>;
    created_from: z.ZodOptional<z.ZodString>;
    created_to: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type ListScansInput = z.infer<typeof listScansInputSchema>;
export interface ScanListResponse {
    scans: ReturnType<typeof mapScanSummary>[];
    total: number;
    has_more: boolean;
}
export declare function listScans(rawArgs: unknown, context: any): Promise<any>;
export {};
//# sourceMappingURL=listScans.d.ts.map
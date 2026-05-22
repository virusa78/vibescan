import * as z from 'zod';
declare const cancelScanInputSchema: z.ZodObject<{
    scan_id: z.ZodString;
}, z.core.$strip>;
export type CancelScanInput = z.infer<typeof cancelScanInputSchema>;
export interface ActionResponse {
    success: boolean;
    message: string;
    quota_refunded?: number;
}
export declare function cancelScan(rawArgs: unknown, context: any): Promise<any>;
export {};
//# sourceMappingURL=cancelScan.d.ts.map
import * as z from 'zod';
declare const submitScanInputSchema: z.ZodObject<{
    inputRef: z.ZodString;
    inputType: z.ZodEnum<{
        github: "github";
        sbom: "sbom";
        source_zip: "source_zip";
    }>;
}, z.core.$strip>;
export type SubmitScanInput = z.infer<typeof submitScanInputSchema>;
export interface ScanResponse {
    id: string;
    status: string;
    created_at: Date;
    quota_remaining: number;
}
export declare function submitScan(rawArgs: unknown, context: any): Promise<any>;
export {};
//# sourceMappingURL=submitScan.d.ts.map
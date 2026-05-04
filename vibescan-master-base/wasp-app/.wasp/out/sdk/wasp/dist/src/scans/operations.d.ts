import type { Scan, ScanDelta, ScanResult } from "wasp/entities";
import type { GetScanById, GetScans, SubmitScan } from "wasp/server/operations";
import * as z from "zod";
declare const submitScanInputSchema: z.ZodObject<{
    inputRef: z.ZodString;
    inputType: z.ZodDefault<z.ZodEnum<{
        github: "github";
        sbom: "sbom";
        source_zip: "source_zip";
    }>>;
}, z.core.$strip>;
type SubmitScanInput = z.infer<typeof submitScanInputSchema>;
type GetScanByIdInput = {
    scanId: string;
};
export type ScanWithDetails = Scan & {
    scanResults: ScanResult[];
    scanDeltas: ScanDelta[];
};
export declare const submitScan: SubmitScan<SubmitScanInput, Scan>;
export declare const getScans: GetScans<void, Scan[]>;
export declare const getScanById: GetScanById<GetScanByIdInput, ScanWithDetails>;
export {};
//# sourceMappingURL=operations.d.ts.map
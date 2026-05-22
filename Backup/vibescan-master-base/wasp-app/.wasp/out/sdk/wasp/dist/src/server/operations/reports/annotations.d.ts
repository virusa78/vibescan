import * as z from 'zod';
type AnnotationUiState = 'accepted' | 'snoozed' | 'rejected' | 'expired';
declare const upsertAnnotationInputSchema: z.ZodObject<{
    scanId: z.ZodString;
    findingId: z.ZodString;
    state: z.ZodEnum<{
        accepted: "accepted";
        rejected: "rejected";
        snoozed: "snoozed";
    }>;
    reason: z.ZodOptional<z.ZodString>;
    expiresAt: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
declare const listAnnotationsInputSchema: z.ZodObject<{
    scanId: z.ZodString;
    state: z.ZodOptional<z.ZodEnum<{
        accepted: "accepted";
        expired: "expired";
        rejected: "rejected";
        snoozed: "snoozed";
    }>>;
}, z.core.$strip>;
export type UpsertAnnotationInput = z.infer<typeof upsertAnnotationInputSchema>;
export type ListAnnotationsInput = z.infer<typeof listAnnotationsInputSchema>;
export interface FindingAnnotationSummary {
    finding_id: string;
    state: AnnotationUiState;
    reason: string | null;
    expires_at: string | null;
}
export declare function mapAcceptanceToAnnotationState(input: {
    status: 'accepted' | 'revoked' | 'expired';
    expiresAt: Date | null;
    now?: Date;
}): AnnotationUiState;
export declare function upsertFindingAnnotation(rawArgs: unknown, context: any): Promise<any>;
export declare function listFindingAnnotations(rawArgs: unknown, context: any): Promise<any>;
export {};
//# sourceMappingURL=annotations.d.ts.map
export type ScanStatusValue = 'pending' | 'scanning' | 'done' | 'error' | 'cancelled';
export type ScanListItem = {
    id: string;
    status: string;
    inputType: string;
    inputRef: string;
    planAtSubmission: string;
    created_at: Date;
    completed_at: Date | null;
};
export type ScanSummaryRecord = {
    id: string;
    status: string;
    inputType: string;
    inputRef: string;
    planAtSubmission: string;
    createdAt: Date;
    completedAt: Date | null;
};
export type AuthenticatedScanUser = {
    id: string;
    workspaceId: string;
};
export declare function countJsonArrayItems(value: unknown): number;
export declare function mapScanSummary(scan: ScanSummaryRecord): ScanListItem;
//# sourceMappingURL=shared.d.ts.map
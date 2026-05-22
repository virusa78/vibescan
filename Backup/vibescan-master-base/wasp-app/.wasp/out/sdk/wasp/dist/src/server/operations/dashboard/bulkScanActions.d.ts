type BulkItemResult = {
    scanId: string;
    success: boolean;
    error?: string;
    message?: string;
};
export declare function bulkCancelScans(rawArgs: unknown, context: any): Promise<{
    requested: number;
    succeeded: number;
    failed: number;
    results: BulkItemResult[];
}>;
export declare function bulkRerunScans(rawArgs: unknown, context: any): Promise<{
    requested: number;
    succeeded: number;
    failed: number;
    results: BulkItemResult[];
}>;
export declare function exportScans(rawArgs: unknown, context: any): Promise<{
    format: 'csv' | 'jsonl';
    filename: string;
    content: string;
    exported: number;
    skipped: number;
}>;
export {};
//# sourceMappingURL=bulkScanActions.d.ts.map
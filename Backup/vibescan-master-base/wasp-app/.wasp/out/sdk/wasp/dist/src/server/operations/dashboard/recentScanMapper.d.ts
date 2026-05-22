export interface RecentScan {
    id: string;
    status: string;
    inputType: string;
    inputRef: string;
    planAtSubmission: string;
    planned_sources: string[];
    created_at: Date;
    completed_at: Date | null;
    vulnerability_count: number;
    counts_by_source: Record<string, number>;
}
export interface RecentScanRow {
    id: string;
    status: string;
    inputType: string;
    inputRef: string;
    planAtSubmission: string;
    plannedSources?: string[];
    createdAt: Date;
    completedAt: Date | null;
    scanResults?: Array<{
        source: string;
        vulnerabilities: unknown;
    }>;
    _count?: {
        findings?: number;
    };
}
export declare function mapRecentScans(scans: RecentScanRow[]): RecentScan[];
//# sourceMappingURL=recentScanMapper.d.ts.map
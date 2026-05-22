export type DashboardMetrics = {
    totalScans: number;
    scansThisMonth: number;
    totalVulnerabilities: number;
    avgSeverity: string;
    quotaUsed: number;
    quotaLimit: number;
    planTier: string;
};
export declare const getDashboardMetrics: (rawArgs: unknown, context: any) => Promise<any>;
export declare const getQuotaStatus: (_rawArgs: unknown, context: any) => Promise<{
    used: number;
    limit: number;
    percentage: number;
    resetDate: Date;
    trend: "increasing" | "decreasing" | "stable";
}>;
export declare const getRecentScans: (rawArgs: unknown, context: any) => Promise<Array<{
    id: string;
    inputRef: string;
    status: string;
    createdAt: Date;
    findingsCount: number;
    severity: {
        critical: number;
        high: number;
        medium: number;
        low: number;
        info: number;
    };
}>>;
export declare const getSeverityBreakdown: (rawArgs: unknown, context: any) => Promise<{
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
    total: number;
}>;
//# sourceMappingURL=operations.d.ts.map
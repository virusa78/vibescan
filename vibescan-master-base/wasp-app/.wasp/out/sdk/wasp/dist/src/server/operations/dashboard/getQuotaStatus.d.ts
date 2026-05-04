export interface QuotaStatusResponse {
    used: number;
    limit: number;
    percentage: number;
    monthly_reset_date: string;
    usage_trend: 'increasing' | 'decreasing' | 'stable';
}
export declare function getQuotaStatus(_rawArgs: unknown, context: any): Promise<any>;
//# sourceMappingURL=getQuotaStatus.d.ts.map
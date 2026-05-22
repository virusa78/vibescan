export type ReportFindingRecord = {
    id: string;
    cveId: string | null;
    packageName: string;
    installedVersion: string;
    severity: string;
    cvssScore: number | null;
    fixedVersion: string | null;
    description: string | null;
    source: string;
    filePath: string | null;
    status: string;
};
export type SeverityBreakdown = {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
};
export type ReportUserContext = any;
export declare function buildSeverityBreakdown(findings: Array<{
    severity: string | null | undefined;
}>): SeverityBreakdown;
export declare function countFindingsBySeverity(findings: Array<{
    severity: string | null | undefined;
}>, severity: keyof SeverityBreakdown): number;
//# sourceMappingURL=shared.d.ts.map
/**
 * Severity calculation utilities for dashboard
 */
export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low' | 'info';
export interface SeverityBreakdown {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
    total: number;
}
export interface SeverityChartData {
    name: string;
    value: number;
    percentage: number;
}
/**
 * Normalize severity string to standard level
 */
export declare function normalizeSeverity(severity: string): SeverityLevel;
/**
 * Calculate severity breakdown from scans
 */
type ScanLike = {
    findings?: Array<{
        severity: string;
    }>;
};
export declare function calculateSeverityBreakdown(scans: ScanLike[]): SeverityBreakdown;
/**
 * Convert severity breakdown to chart data format
 */
export declare function breakdownToChartData(breakdown: SeverityBreakdown): SeverityChartData[];
/**
 * Get color for severity level
 */
export declare function getSeverityColor(severity: SeverityLevel): string;
/**
 * Get background color for severity level
 */
export declare function getSeverityBgColor(severity: SeverityLevel): string;
/**
 * Get border color for severity level
 */
export declare function getSeverityBorderColor(severity: SeverityLevel): string;
/**
 * Format relative time (e.g., "2 days ago")
 */
export declare function formatRelativeTime(date: string | Date): string;
/**
 * Get status badge styling
 */
export declare function getStatusBadge(status: string): {
    color: string;
    bg: string;
    border: string;
};
/**
 * Get scan type display name
 */
export declare function getScanTypeDisplay(inputType: string): string;
export {};
//# sourceMappingURL=severity.d.ts.map
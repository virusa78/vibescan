export type DashboardSortField = 'submitted' | 'target' | 'type' | 'status' | 'findings';
export type DashboardSortDirection = 'asc' | 'desc';
export type DashboardStatus = 'pending' | 'scanning' | 'done' | 'error' | 'cancelled';
export type ParsedDashboardSearch = {
    sortField: DashboardSortField;
    sortDirection: DashboardSortDirection;
    statuses: DashboardStatus[];
    query: string;
    isValid: boolean;
    normalizedSearch: string;
};
export declare function normalizeStatusValue(raw: string): DashboardStatus | null;
export declare function buildDashboardSearch(sortField: DashboardSortField, sortDirection: DashboardSortDirection, statuses: DashboardStatus[], query: string): string;
export declare function parseDashboardSearch(search: string): ParsedDashboardSearch;
//# sourceMappingURL=urlState.d.ts.map
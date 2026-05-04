import React from 'react';
type DashboardSortField = 'submitted' | 'target' | 'type' | 'status' | 'findings';
type DashboardSortDirection = 'asc' | 'desc';
type DashboardStatus = 'pending' | 'scanning' | 'done' | 'error' | 'cancelled';
interface ScanTableRow {
    id: string;
    status: string;
    inputType: string;
    inputRef: string;
    created_at: string;
    vulnerability_count: number;
}
interface ScanTableProps {
    scans: ScanTableRow[];
    loading?: boolean;
    onRefresh?: () => void;
    sortField: DashboardSortField;
    sortDirection: DashboardSortDirection;
    onSortChange: (field: DashboardSortField, event?: React.MouseEvent<HTMLButtonElement>) => void;
    statusFilters: DashboardStatus[];
    statusCounts: Record<DashboardStatus, number>;
    onToggleStatus: (status: DashboardStatus) => void;
    searchQuery: string;
    onSearchQueryChange: (query: string) => void;
    searchInputRef: React.RefObject<HTMLInputElement | null>;
    filteredCount: number;
    totalCount: number;
    onCancelScan: (scanId: string) => Promise<void>;
    onRerunScan: (scanId: string) => Promise<void>;
    onCopyScanId: (scanId: string) => Promise<void>;
    onBulkCancel: (scanIds: string[]) => Promise<void>;
    onBulkRerun: (scanIds: string[]) => Promise<void>;
    onBulkExport: (scanIds: string[], format: 'csv' | 'jsonl') => Promise<void>;
}
export declare function ScanTable({ scans, loading, onRefresh, sortField, sortDirection, onSortChange, statusFilters, statusCounts, onToggleStatus, searchQuery, onSearchQueryChange, searchInputRef, filteredCount, totalCount, onCancelScan, onRerunScan, onCopyScanId, onBulkCancel, onBulkRerun, onBulkExport, }: ScanTableProps): React.JSX.Element;
export {};
//# sourceMappingURL=ScanTable.d.ts.map
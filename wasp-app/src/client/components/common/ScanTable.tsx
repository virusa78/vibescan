import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import {
  getStatusBadge,
  getScanTypeDisplay,
  formatRelativeTime,
} from '../../utils/severity';
import { isEditableTarget } from '../../utils/keyboard';

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
  onSortChange: (field: DashboardSortField) => void;
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

const SORTABLE_COLUMNS: Array<{ field: DashboardSortField; label: string }> = [
  { field: 'target', label: 'TARGET' },
  { field: 'type', label: 'TYPE' },
  { field: 'status', label: 'STATUS' },
  { field: 'findings', label: 'FINDINGS' },
  { field: 'submitted', label: 'SUBMITTED' },
];

const STATUS_OPTIONS: Array<{ value: DashboardStatus; label: string }> = [
  { value: 'pending', label: 'Pending' },
  { value: 'scanning', label: 'Scanning' },
  { value: 'done', label: 'Done' },
  { value: 'error', label: 'Error' },
  { value: 'cancelled', label: 'Cancelled' },
];

const CANCELLABLE_STATUSES = new Set(['pending', 'scanning']);

// SortHeader icon component
function SortHeaderIcon({ active, direction }: { active: boolean; direction: DashboardSortDirection }) {
  if (!active) {
    return <div className="w-4 h-4 opacity-40 transition-opacity" />;
  }
  if (direction === 'asc') {
    return <ChevronUp className="w-4 h-4 transition-transform" />;
  }
  return <ChevronDown className="w-4 h-4 transition-transform" />;
}

function getReadableStatusLabel(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized === 'done') return 'Done';
  if (normalized === 'error') return 'Error';
  if (normalized === 'scanning') return 'Scanning';
  if (normalized === 'pending') return 'Pending';
  if (normalized === 'cancelled') return 'Cancelled';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export function ScanTable({
  scans,
  loading = false,
  onRefresh,
  sortField,
  sortDirection,
  onSortChange,
  statusFilters,
  statusCounts,
  onToggleStatus,
  searchQuery,
  onSearchQueryChange,
  searchInputRef,
  filteredCount,
  totalCount,
  onCancelScan,
  onRerunScan,
  onCopyScanId,
  onBulkCancel,
  onBulkRerun,
  onBulkExport,
}: ScanTableProps) {
  const navigate = useNavigate();
  const [activeRowIndex, setActiveRowIndex] = useState(0);
  const [selectedScanIds, setSelectedScanIds] = useState<string[]>([]);

  useEffect(() => {
    setActiveRowIndex((previous) => {
      if (scans.length === 0) {
        return 0;
      }
      return Math.min(previous, scans.length - 1);
    });

    setSelectedScanIds((previous) => previous.filter((scanId) => scans.some((scan) => scan.id === scanId)));
  }, [scans.length]);

  const activeScan = useMemo(() => scans[activeRowIndex], [activeRowIndex, scans]);
  const allVisibleSelected = scans.length > 0 && scans.every((scan) => selectedScanIds.includes(scan.id));

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (loading || scans.length === 0 || event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }

      if (isEditableTarget(event.target)) {
        return;
      }

      if (event.key === 'j') {
        event.preventDefault();
        setActiveRowIndex((previous) => Math.min(previous + 1, scans.length - 1));
        return;
      }

      if (event.key === 'k') {
        event.preventDefault();
        setActiveRowIndex((previous) => Math.max(previous - 1, 0));
        return;
      }

      if (!activeScan) {
        return;
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        navigate(`/scans/${activeScan.id}`);
        return;
      }

      if (event.key === 'x') {
        if (!CANCELLABLE_STATUSES.has(activeScan.status.toLowerCase())) {
          return;
        }
        event.preventDefault();
        void onCancelScan(activeScan.id);
        return;
      }

      if (event.key === 'c') {
        event.preventDefault();
        void onCopyScanId(activeScan.id);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeScan, loading, navigate, onCancelScan, onCopyScanId, scans.length]);

  const handleRowOpen = (scanId: string) => {
    navigate(`/scans/${scanId}`);
  };

  const toggleRowSelection = (scanId: string) => {
    setSelectedScanIds((previous) =>
      previous.includes(scanId) ? previous.filter((id) => id !== scanId) : [...previous, scanId],
    );
  };

  const toggleAllVisibleRows = () => {
    if (allVisibleSelected) {
      setSelectedScanIds((previous) => previous.filter((id) => !scans.some((scan) => scan.id === id)));
      return;
    }

    setSelectedScanIds((previous) => {
      const next = new Set(previous);
      for (const scan of scans) {
        next.add(scan.id);
      }
      return Array.from(next);
    });
  };

  const renderSkeletonRow = () => (
    <tr className="border-b border-border/20">
      {[0, 1, 2, 3, 4, 5, 6].map((idx) => (
        <td key={idx} className="py-3 px-4">
          <div className="h-4 bg-muted rounded animate-pulse w-20" />
        </td>
      ))}
    </tr>
  );

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader className="space-y-4">
        {selectedScanIds.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-primary/30 bg-primary/10 p-2">
            <span className="text-xs font-medium text-foreground">{selectedScanIds.length} selected</span>
            <button
              type="button"
              className="text-xs px-2 py-1 text-amber-500 hover:bg-amber-500/10 rounded transition"
              onClick={() => void onBulkCancel(selectedScanIds)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="text-xs px-2 py-1 text-foreground hover:bg-accent rounded transition"
              onClick={() => void onBulkRerun(selectedScanIds)}
            >
              Re-run
            </button>
            <button
              type="button"
              className="text-xs px-2 py-1 text-foreground hover:bg-accent rounded transition"
              onClick={() => void onBulkExport(selectedScanIds, 'csv')}
            >
              Export CSV
            </button>
            <button
              type="button"
              className="text-xs px-2 py-1 text-foreground hover:bg-accent rounded transition"
              onClick={() => void onBulkExport(selectedScanIds, 'jsonl')}
            >
              Export JSONL
            </button>
            <button
              type="button"
              className="text-xs px-2 py-1 text-muted-foreground hover:text-foreground"
              onClick={() => setSelectedScanIds([])}
            >
              Clear
            </button>
          </div>
        )}

        <div className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Recent Scans</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Latest vulnerability scan results
            </p>
          </div>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="text-xs px-3 py-1 border border-primary/50 text-primary rounded hover:bg-primary/10 transition"
              aria-label="Refresh recent scans"
            >
              Refresh
            </button>
          )}
        </div>

        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <Input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(event) => onSearchQueryChange(event.target.value)}
              placeholder="Search by target, scan id, CVE"
              className="w-72"
              aria-label="Search recent scans"
            />
            <span className="rounded-md border border-border/50 px-2 py-1 text-xs text-muted-foreground" aria-live="polite">
              {filteredCount}/{totalCount}
            </span>
          </div>
          <div className="text-xs text-muted-foreground">
            Shortcuts: j/k move, Enter open, x cancel, c copy id
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter scans by status">
          {STATUS_OPTIONS.map((option) => {
            const active = statusFilters.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onToggleStatus(option.value)}
                className={`rounded-full border px-3 py-1 text-xs transition ${
                  active
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border/60 text-muted-foreground hover:text-foreground'
                }`}
                aria-pressed={active}
                aria-label={`${option.label} (${statusCounts[option.value] ?? 0})`}
              >
                {option.label} ({statusCounts[option.value] ?? 0})
              </button>
            );
          })}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/30">
                  <th className="py-3 px-4">
                    <input type="checkbox" aria-label="Select all scans" />
                  </th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">TARGET</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">TYPE</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">STATUS</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">FINDINGS</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">SUBMITTED</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {[...Array(3)].map((_, idx) => (
                  <React.Fragment key={idx}>{renderSkeletonRow()}</React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        ) : scans.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-muted-foreground mb-4">No scans match current filters.</p>
            <button
              onClick={() => navigate('/new-scan')}
              className="text-sm px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition"
            >
              Create First Scan
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/30">
                  <th className="py-3 px-4">
                    <input
                      type="checkbox"
                      aria-label="Select all visible scans"
                      checked={allVisibleSelected}
                      onChange={toggleAllVisibleRows}
                    />
                  </th>
                  {SORTABLE_COLUMNS.map((column) => {
                    const active = sortField === column.field;
                    return (
                      <th
                        key={column.field}
                        className="text-left py-3 px-4 text-muted-foreground font-medium"
                        aria-sort={active ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                      >
                        <button
                          type="button"
                          className={`inline-flex items-center gap-2 px-2 py-1 rounded transition-all ${
                            active 
                              ? 'text-foreground bg-accent/10' 
                              : 'text-muted-foreground hover:text-foreground hover:bg-accent/5'
                          }`}
                          onClick={() => onSortChange(column.field)}
                          aria-label={`Sort by ${column.label.toLowerCase()} ${active && sortDirection === 'asc' ? 'descending' : 'ascending'}`}
                        >
                          {column.label}
                          <SortHeaderIcon active={active} direction={sortDirection} />
                        </button>
                      </th>
                    );
                  })}
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {scans.map((scan, index) => {
                  const statusBadge = getStatusBadge(scan.status);
                  const scanType = getScanTypeDisplay(scan.inputType);
                  const relativeTime = formatRelativeTime(scan.created_at);
                  const canCancel = CANCELLABLE_STATUSES.has(scan.status.toLowerCase());
                  const canRerun = scan.inputRef.trim().length > 0 && scan.inputType.trim().length > 0;
                  const isActive = index === activeRowIndex;

                  return (
                    <tr
                      key={scan.id}
                      className={`group border-b border-border/20 transition-colors cursor-pointer ${
                        isActive ? 'bg-accent/15' : 'hover:bg-accent/5'
                      }`}
                      onMouseEnter={() => setActiveRowIndex(index)}
                      onClick={() => handleRowOpen(scan.id)}
                      aria-selected={isActive}
                    >
                      <td className="py-3 px-4">
                        <input
                          type="checkbox"
                          checked={selectedScanIds.includes(scan.id)}
                          onChange={(event) => {
                            event.stopPropagation();
                            toggleRowSelection(scan.id);
                          }}
                          onClick={(event) => event.stopPropagation()}
                          aria-label={`Select scan ${scan.id}`}
                        />
                      </td>
                      <td className="py-3 px-4 text-foreground text-xs max-w-[20rem] truncate" title={scan.inputRef}>
                        {scan.inputRef}
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-xs px-2 py-1 border border-primary/50 text-primary rounded">
                          {scanType}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-xs px-2 py-1 border rounded font-medium ${statusBadge.color} ${statusBadge.border}`}
                        >
                          {getReadableStatusLabel(scan.status)}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-foreground font-medium">{scan.vulnerability_count}</span>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground text-xs">{relativeTime}</td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap items-center gap-1 opacity-90 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 transition-opacity">
                          <button
                            type="button"
                            className="text-xs px-2 py-1 text-primary hover:bg-primary/10 rounded transition"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleRowOpen(scan.id);
                            }}
                            aria-label={`Open scan ${scan.id}`}
                          >
                            Open
                          </button>
                          <button
                            type="button"
                            className="text-xs px-2 py-1 text-amber-500 hover:bg-amber-500/10 rounded transition disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={!canCancel}
                            title={!canCancel ? 'Only pending/scanning scans can be cancelled' : 'Cancel scan'}
                            onClick={(event) => {
                              event.stopPropagation();
                              if (!canCancel) return;
                              void onCancelScan(scan.id);
                            }}
                            aria-label={`Cancel scan ${scan.id}`}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            className="text-xs px-2 py-1 text-foreground hover:bg-accent rounded transition disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={!canRerun}
                            title={!canRerun ? 'Missing input reference/type for re-run' : 'Re-run scan'}
                            onClick={(event) => {
                              event.stopPropagation();
                              if (!canRerun) return;
                              void onRerunScan(scan.id);
                            }}
                            aria-label={`Re-run scan ${scan.id}`}
                          >
                            Re-run
                          </button>
                          <button
                            type="button"
                            className="text-xs px-2 py-1 text-foreground hover:bg-accent rounded transition"
                            onClick={(event) => {
                              event.stopPropagation();
                              void onCopyScanId(scan.id);
                            }}
                            aria-label={`Copy scan id ${scan.id}`}
                          >
                            Copy ID
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

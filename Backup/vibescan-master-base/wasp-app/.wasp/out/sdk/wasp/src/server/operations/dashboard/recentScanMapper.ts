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

function countJsonArrayItems(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

function buildCountsBySource(scan: RecentScanRow): Record<string, number> {
  return (scan.scanResults || []).reduce<Record<string, number>>((accumulator, result) => {
    accumulator[result.source] = countJsonArrayItems(result.vulnerabilities);
    return accumulator;
  }, {});
}

export function mapRecentScans(scans: RecentScanRow[]): RecentScan[] {
  return scans.map((scan) => ({
    id: scan.id,
    status: scan.status,
    inputType: scan.inputType,
    inputRef: scan.inputRef,
    planAtSubmission: scan.planAtSubmission,
    planned_sources: Array.isArray(scan.plannedSources) ? scan.plannedSources : [],
    created_at: scan.createdAt,
    completed_at: scan.completedAt,
    vulnerability_count: scan._count?.findings ?? 0,
    counts_by_source: buildCountsBySource(scan),
  }));
}

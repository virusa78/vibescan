export interface RecentScan {
  id: string;
  status: string;
  inputType: string;
  inputRef: string;
  planAtSubmission: string;
  created_at: Date;
  completed_at: Date | null;
  vulnerability_count: number;
}

export interface RecentScanRow {
  id: string;
  status: string;
  inputType: string;
  inputRef: string;
  planAtSubmission: string;
  createdAt: Date;
  completedAt: Date | null;
  _count?: {
    findings?: number;
  };
}

export function mapRecentScans(scans: RecentScanRow[]): RecentScan[] {
  return scans.map((scan) => ({
    id: scan.id,
    status: scan.status,
    inputType: scan.inputType,
    inputRef: scan.inputRef,
    planAtSubmission: scan.planAtSubmission,
    created_at: scan.createdAt,
    completed_at: scan.completedAt,
    vulnerability_count: scan._count?.findings ?? 0,
  }));
}

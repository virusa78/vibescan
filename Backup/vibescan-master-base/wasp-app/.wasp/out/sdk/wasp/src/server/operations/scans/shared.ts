export type ScanStatusValue = 'pending' | 'scanning' | 'done' | 'error' | 'cancelled';

export type ScanListItem = {
  id: string;
  status: string;
  inputType: string;
  inputRef: string;
  planAtSubmission: string;
  created_at: Date;
  completed_at: Date | null;
};

export type ScanSummaryRecord = {
  id: string;
  status: string;
  inputType: string;
  inputRef: string;
  planAtSubmission: string;
  createdAt: Date;
  completedAt: Date | null;
};

export type AuthenticatedScanUser = {
  id: string;
  workspaceId: string;
};

export function countJsonArrayItems(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

export function mapScanSummary(scan: ScanSummaryRecord): ScanListItem {
  return {
    id: scan.id,
    status: scan.status,
    inputType: scan.inputType,
    inputRef: scan.inputRef,
    planAtSubmission: scan.planAtSubmission,
    created_at: scan.createdAt,
    completed_at: scan.completedAt,
  };
}

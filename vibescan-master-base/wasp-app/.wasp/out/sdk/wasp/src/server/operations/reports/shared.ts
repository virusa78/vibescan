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

// Wasp-generated stub type for context compatibility
export type ReportUserContext = any;



export function buildSeverityBreakdown(findings: Array<{ severity: string | null | undefined }>): SeverityBreakdown {
  const breakdown: SeverityBreakdown = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };

  for (const finding of findings) {
    const severity = (finding.severity || 'info').toLowerCase();
    if (severity in breakdown) {
      breakdown[severity as keyof SeverityBreakdown]++;
    }
  }

  return breakdown;
}

export function countFindingsBySeverity(
  findings: Array<{ severity: string | null | undefined }>,
  severity: keyof SeverityBreakdown,
): number {
  return findings.filter((finding) => (finding.severity || 'info').toLowerCase() === severity).length;
}

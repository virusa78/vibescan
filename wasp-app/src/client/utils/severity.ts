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
export function normalizeSeverity(severity: string): SeverityLevel {
  const normalized = severity?.toLowerCase().trim();
  if (normalized === 'critical') return 'critical';
  if (normalized === 'high') return 'high';
  if (normalized === 'medium') return 'medium';
  if (normalized === 'low') return 'low';
  return 'info';
}

/**
 * Calculate severity breakdown from scans
 */
type ScanLike = {
  findings?: Array<{
    severity: string;
  }>;
};

export function calculateSeverityBreakdown(scans: ScanLike[]): SeverityBreakdown {
  const breakdown: SeverityBreakdown = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
    total: 0,
  };

  // This is a simplified version - in real implementation,
  // we'd aggregate findings from all scans
  // For now, we calculate based on mock data structure
  scans.forEach(scan => {
    if (!scan.findings) return;
    
    scan.findings.forEach((finding) => {
      const severity = normalizeSeverity(finding.severity);
      breakdown[severity]++;
      breakdown.total++;
    });
  });

  return breakdown;
}

/**
 * Convert severity breakdown to chart data format
 */
export function breakdownToChartData(breakdown: SeverityBreakdown): SeverityChartData[] {
  const total = breakdown.total || 1; // Avoid division by zero

  return [
    {
      name: 'Critical',
      value: breakdown.critical,
      percentage: Math.round((breakdown.critical / total) * 100),
    },
    {
      name: 'High',
      value: breakdown.high,
      percentage: Math.round((breakdown.high / total) * 100),
    },
    {
      name: 'Medium',
      value: breakdown.medium,
      percentage: Math.round((breakdown.medium / total) * 100),
    },
    {
      name: 'Low',
      value: breakdown.low,
      percentage: Math.round((breakdown.low / total) * 100),
    },
    {
      name: 'Info',
      value: breakdown.info,
      percentage: Math.round((breakdown.info / total) * 100),
    },
  ];
}

/**
 * Get color for severity level
 */
export function getSeverityColor(severity: SeverityLevel): string {
  switch (severity) {
    case 'critical':
      return 'text-red-500';
    case 'high':
      return 'text-orange-500';
    case 'medium':
      return 'text-amber-500';
    case 'low':
      return 'text-emerald-500';
    case 'info':
      return 'text-gray-500';
  }
}

/**
 * Get background color for severity level
 */
export function getSeverityBgColor(severity: SeverityLevel): string {
  switch (severity) {
    case 'critical':
      return 'bg-red-500/10';
    case 'high':
      return 'bg-orange-500/10';
    case 'medium':
      return 'bg-amber-500/10';
    case 'low':
      return 'bg-emerald-500/10';
    case 'info':
      return 'bg-gray-500/10';
  }
}

/**
 * Get border color for severity level
 */
export function getSeverityBorderColor(severity: SeverityLevel): string {
  switch (severity) {
    case 'critical':
      return 'border-red-500/30';
    case 'high':
      return 'border-orange-500/30';
    case 'medium':
      return 'border-amber-500/30';
    case 'low':
      return 'border-emerald-500/30';
    case 'info':
      return 'border-gray-500/30';
  }
}

/**
 * Format relative time (e.g., "2 days ago")
 */
export function formatRelativeTime(date: string | Date): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - dateObj.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return dateObj.toLocaleDateString();
}

/**
 * Get status badge styling
 */
export function getStatusBadge(status: string) {
  const normalized = status?.toLowerCase();
  if (normalized === 'error' || normalized === 'failed') {
    return { color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/30' };
  }
  if (normalized === 'done' || normalized === 'completed') {
    return { color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' };
  }
  if (normalized === 'scanning' || normalized === 'running' || normalized === 'pending') {
    return { color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/30' };
  }
  return { color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/30' };
}

/**
 * Get scan type display name
 */
export function getScanTypeDisplay(inputType: string): string {
  const normalized = inputType?.toLowerCase();
  if (normalized === 'github' || normalized === 'github_app') return 'GitHub';
  if (normalized === 'sbom' || normalized === 'sbom_upload') return 'SBOM';
  if (normalized === 'source_zip' || normalized === 'zip') return 'ZIP';
  if (normalized === 'ci_plugin' || normalized === 'ci') return 'CI/CD';
  return inputType || 'Unknown';
}

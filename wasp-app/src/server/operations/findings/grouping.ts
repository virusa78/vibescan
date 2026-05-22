export type FindingsGroupBy = 'project' | 'cve';

export type FindingOverviewRow = {
  id: string;
  project: { id: string; name: string; targetType: string; targetRef: string };
  cveId: string;
  packageName: string;
  installedVersion: string;
  filePath?: string | null;
  severity: string;
  status: 'active' | 'accepted' | 'snoozed' | 'rejected' | 'mitigated';
  slaState?: 'none' | 'on_track' | 'due_soon' | 'overdue';
  ageDays: number;
  activeDays: number;
  findings?: never;
};

export type FindingsGroup = {
  key: string;
  type: FindingsGroupBy;
  title: string;
  subtitle: string;
  count: number;
  activeCount: number;
  criticalHighCount: number;
  findings: FindingOverviewRow[];
};

function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function buildProjectGroupSubtitle(row: FindingOverviewRow): string {
  return row.project.targetRef;
}

function buildCveGroupSubtitle(findings: FindingOverviewRow[]): string {
  const uniquePackages = new Set(findings.map((finding) => `${finding.packageName}@${finding.installedVersion}`)).size;
  const uniqueProjects = new Set(findings.map((finding) => finding.project.id)).size;
  const first = findings[0];
  const packageLabel = first ? `${first.packageName}@${first.installedVersion}` : 'Unknown package';
  const packageSummary = uniquePackages > 1 ? `${packageLabel} + ${pluralize(uniquePackages - 1, 'more package')}` : packageLabel;
  return `${packageSummary} · ${pluralize(uniqueProjects, 'project')}`;
}

export function buildFindingGroups(findings: FindingOverviewRow[], groupBy: FindingsGroupBy): FindingsGroup[] {
  const groups = new Map<string, FindingsGroup>();

  for (const finding of findings) {
    const key = groupBy === 'project' ? finding.project.id : finding.cveId;
    const existing = groups.get(key);

    if (!existing) {
      groups.set(key, {
        key,
        type: groupBy,
        title: groupBy === 'project' ? finding.project.name : finding.cveId,
        subtitle: groupBy === 'project' ? buildProjectGroupSubtitle(finding) : buildCveGroupSubtitle([finding]),
        count: 0,
        activeCount: 0,
        criticalHighCount: 0,
        findings: [],
      });
    }

    const group = groups.get(key)!;
    group.findings.push(finding);
    group.count += 1;
    if (finding.status === 'active') {
      group.activeCount += 1;
    }
    if (finding.severity === 'critical' || finding.severity === 'high') {
      group.criticalHighCount += 1;
    }
  }

  for (const group of groups.values()) {
    if (group.type === 'cve') {
      group.subtitle = buildCveGroupSubtitle(group.findings);
    }
  }

  return Array.from(groups.values());
}

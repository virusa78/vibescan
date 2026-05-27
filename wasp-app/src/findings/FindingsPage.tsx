import { useEffect, useMemo, useState } from 'react';
import {
  acceptProjectFinding,
  getFindingsOverview,
  rejectProjectFinding,
  reopenProjectFinding,
  snoozeProjectFinding,
  useQuery,
} from 'wasp/client/operations';
import { AlertCircle, ArrowDown, ArrowUp, CheckCircle2, ChevronDown, ChevronRight, Copy, ExternalLink, ShieldAlert, TimerReset } from 'lucide-react';
import { Badge } from '../client/components/ui/badge';
import { Button } from '../client/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../client/components/ui/card';
import { Input } from '../client/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../client/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '../client/components/ui/sheet';
import { ScannerBadges } from '../reports/ScannerBadges';

type FindingStatus = 'active' | 'accepted' | 'snoozed' | 'rejected' | 'mitigated';
type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';
type FindingsGroupBy = 'project' | 'cve';
type SortField = 'severity' | 'firstSeen' | 'lastSeen' | 'project' | 'package' | 'scanCount' | 'fixedVersion' | 'sla';
type SortDirection = 'asc' | 'desc';
type FindingsGroup = {
  key: string;
  type: FindingsGroupBy;
  title: string;
  subtitle: string;
  count: number;
  activeCount: number;
  criticalHighCount: number;
  findings?: ProjectFindingRow[];
};
type ProjectOption = { id: string; name: string };

type ProjectFindingRow = {
  id: string;
  project: { id: string; name: string; targetType: string; targetRef: string };
  cveId: string;
  packageName: string;
  installedVersion: string;
  filePath?: string | null;
  severity: Severity;
  cvssScore?: number | null;
  fixedVersion?: string | null;
  description?: string | null;
  status: FindingStatus;
  firstSeenAt: string;
  lastSeenAt: string;
  lastMitigatedAt?: string | null;
  reopenedAt?: string | null;
  scanCount: number;
  reportedBy: string[];
  slaDueAt?: string | null;
  slaState: 'none' | 'on_track' | 'due_soon' | 'overdue';
  ageDays: number;
  activeDays: number;
  latestScan?: { id: string; inputRef: string; completedAt?: string | null } | null;
  links: { nvd: string; githubAdvisory: string };
};

const SCANNER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'grype', label: 'Grype' },
  { value: 'codescoring_johnny', label: 'Codescoring Johnny' },
  { value: 'snyk', label: 'Snyk' },
  { value: 'trivy', label: 'Trivy' },
  { value: 'owasp', label: 'OWASP' },
  { value: 'dast', label: 'DAST' },
];

const SORT_OPTIONS: Array<{ value: SortField; label: string }> = [
  { value: 'severity', label: 'Severity' },
  { value: 'firstSeen', label: 'First seen' },
  { value: 'lastSeen', label: 'Last seen' },
  { value: 'project', label: 'Project' },
  { value: 'package', label: 'Package' },
  { value: 'scanCount', label: 'Scan count' },
  { value: 'fixedVersion', label: 'Fixed version' },
  { value: 'sla', label: 'SLA' },
];

const severityClasses: Record<Severity, string> = {
  critical: 'border-l-red-600 bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300',
  high: 'border-l-orange-500 bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-300',
  medium: 'border-l-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300',
  low: 'border-l-sky-500 bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-300',
  info: 'border-l-slate-400 bg-slate-50 text-slate-700 dark:bg-slate-900/40 dark:text-slate-300',
};

const summaryCards = [
  {
    label: 'Active',
    value: 'active',
    icon: ShieldAlert,
    accent: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/25 dark:text-emerald-300',
    valueClass: 'text-emerald-700 dark:text-emerald-300',
    iconClass: 'text-emerald-600 dark:text-emerald-300',
  },
  {
    label: 'Critical / High',
    value: 'criticalHigh',
    icon: AlertCircle,
    accent: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/25 dark:text-rose-300',
    valueClass: 'text-rose-700 dark:text-rose-300',
    iconClass: 'text-rose-600 dark:text-rose-300',
  },
  {
    label: 'Overdue SLA',
    value: 'overdueSla',
    icon: TimerReset,
    accent: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/25 dark:text-amber-300',
    valueClass: 'text-amber-700 dark:text-amber-300',
    iconClass: 'text-amber-600 dark:text-amber-300',
  },
  {
    label: 'Newly seen',
    value: 'newlySeen',
    icon: ChevronRight,
    accent: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/25 dark:text-sky-300',
    valueClass: 'text-sky-700 dark:text-sky-300',
    iconClass: 'text-sky-600 dark:text-sky-300',
  },
  {
    label: 'Mitigated',
    value: 'mitigated',
    icon: CheckCircle2,
    accent: 'border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-900/60 dark:bg-teal-950/25 dark:text-teal-300',
    valueClass: 'text-teal-700 dark:text-teal-300',
    iconClass: 'text-teal-600 dark:text-teal-300',
  },
] as const;

function formatDate(value?: string | null): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
}

function StatusBadge({ status }: { status: FindingStatus }) {
  const variant: 'default' | 'secondary' | 'destructive' | 'outline' =
    status === 'active' ? 'destructive' : status === 'mitigated' ? 'secondary' : 'outline';
  return <Badge variant={variant} className="capitalize">{status}</Badge>;
}

function SlaBadge({ state, dueAt }: { state: ProjectFindingRow['slaState']; dueAt?: string | null }) {
  const label = state === 'none' ? 'No SLA' : state.replace('_', ' ');
  let className = '';
  if (state === 'overdue') {
    className = 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400';
  } else if (state === 'due_soon') {
    className = 'border-amber-300 bg-amber-50/90 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-400';
  } else if (state === 'on_track') {
    className = 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-400';
  } else {
    // none
    className = 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400';
  }
  return <Badge variant="outline" className={className}>{label}{dueAt ? ` · ${formatDate(dueAt)}` : ''}</Badge>;
}

export default function FindingsPage() {
  const [query, setQuery] = useState('');
  const [searchVal, setSearchVal] = useState('');
  const [groupBy, setGroupBy] = useState<FindingsGroupBy>('project');
  const [severity, setSeverity] = useState<string>('all');
  const [status, setStatus] = useState<string>('active');
  const [projectId, setProjectId] = useState<string>('all');
  const [scanner, setScanner] = useState<string>('all');
  const [fixable, setFixable] = useState<string>('all');
  const [sla, setSla] = useState<string>('all');
  const [age, setAge] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('severity');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [onlyLatestScan, setOnlyLatestScan] = useState<boolean>(true);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<{
    findingId: string;
    action: 'accept' | 'snooze' | 'reject' | 'reopen';
  } | null>(null);

  useEffect(() => {
    const handler = setTimeout(() => {
      setQuery(searchVal);
    }, 300);
    return () => {
      clearTimeout(handler);
    };
  }, [searchVal]);

  useEffect(() => {
    setExpandedProjects(new Set());
  }, [groupBy]);

  const overviewArgs = useMemo(() => ({
    q: query || undefined,
    groupBy,
    severity: severity === 'all' ? [] : [severity],
    status: status === 'all' ? [] : [status],
    projectId: projectId === 'all' ? undefined : projectId,
    scanner: scanner === 'all' ? [] : [scanner],
    fixable: fixable === 'all' ? undefined : fixable === 'fixable',
    sla: sla === 'all' ? [] : [sla],
    age: age === 'all' ? [] : [age],
    sort: { field: sortField, direction: sortDirection },
    onlyLatestScan,
    limit: 250,
  }), [age, fixable, groupBy, projectId, query, scanner, severity, sla, sortDirection, sortField, status, onlyLatestScan]);

  const { data, isLoading, error, refetch } = useQuery(getFindingsOverview, overviewArgs);
  const findings = Array.isArray(data?.findings) ? (data.findings as ProjectFindingRow[]) : [];
  const groups = Array.isArray(data?.groups) ? (data.groups as FindingsGroup[]) : [];
  const projectOptions = Array.isArray(data?.projectOptions) ? (data.projectOptions as ProjectOption[]) : [];
  const summary = data?.summary ?? { active: 0, criticalHigh: 0, overdueSla: 0, newlySeen: 0, mitigated: 0 };
  const selectedFinding = useMemo(
    () => findings.find((finding) => finding.id === selectedFindingId) ?? null,
    [findings, selectedFindingId],
  );

  useEffect(() => {
    if (!selectedFindingId) {
      return;
    }

    const refreshedFinding = findings.find((finding) => finding.id === selectedFindingId) ?? null;
    if (!refreshedFinding) {
      setSelectedFindingId(null);
    }
  }, [findings, selectedFindingId]);

  const runAction = async (action: 'accept' | 'snooze' | 'reject' | 'reopen', finding: ProjectFindingRow) => {
    if (pendingAction) {
      return;
    }

    const payload = {
      projectFindingId: finding.id,
      reason: action === 'snooze' ? 'Temporarily deferred from Findings triage' : `Marked ${action} from Findings triage`,
      ...(action === 'snooze'
        ? { expiresAt: new Date(Date.now() + 14 * 86_400_000).toISOString() }
        : {}),
    };
    setPendingAction({ findingId: finding.id, action });

    try {
      if (action === 'accept') await acceptProjectFinding(payload);
      if (action === 'snooze') await snoozeProjectFinding(payload);
      if (action === 'reject') await rejectProjectFinding(payload);
      if (action === 'reopen') await reopenProjectFinding(payload);
      await refetch();
    } finally {
      setPendingAction((current) => (
        current?.findingId === finding.id && current.action === action ? null : current
      ));
    }
  };

  return (
    <div className="w-full bg-background">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">Findings</h1>
            <p className="text-sm text-muted-foreground">Workspace CVE lifecycle grouped by project.</p>
          </div>
        </div>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {summaryCards.map((item) => (
            <Card key={item.label} className={`rounded-lg border ${item.accent}`}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{item.label}</CardTitle>
                <item.icon className={`size-4 ${item.iconClass}`} />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-semibold ${item.valueClass}`}>{summary[item.value]}</div>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="grid gap-3 rounded-lg border bg-background p-3 md:grid-cols-2 xl:grid-cols-4">
          <Input
            value={searchVal}
            onChange={(event) => setSearchVal(event.target.value)}
            placeholder="Search CVE, package, project, or path"
            className="md:col-span-2 xl:col-span-2"
          />
          <Select disabled={isLoading} value={groupBy} onValueChange={(value) => setGroupBy(value as FindingsGroupBy)}>
            <SelectTrigger>
              <SelectValue placeholder="Group by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="project">Group by project</SelectItem>
              <SelectItem value="cve">Group by CVE</SelectItem>
            </SelectContent>
          </Select>
          <Select disabled={isLoading} value={projectId} onValueChange={setProjectId}>
            <SelectTrigger>
              <SelectValue placeholder="Project" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All projects</SelectItem>
              {projectOptions.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select disabled={isLoading} value={severity} onValueChange={setSeverity}>
            <SelectTrigger>
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All severities</SelectItem>
              {(['critical', 'high', 'medium', 'low', 'info'] as Severity[]).map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select disabled={isLoading} value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {(['active', 'accepted', 'snoozed', 'rejected', 'mitigated'] as FindingStatus[]).map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select disabled={isLoading} value={scanner} onValueChange={setScanner}>
            <SelectTrigger>
              <SelectValue placeholder="Scanner" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All scanners</SelectItem>
              {SCANNER_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select disabled={isLoading} value={fixable} onValueChange={setFixable}>
            <SelectTrigger>
              <SelectValue placeholder="Fixability" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All findings</SelectItem>
              <SelectItem value="fixable">Fixable only</SelectItem>
              <SelectItem value="unfixable">Unfixed only</SelectItem>
            </SelectContent>
          </Select>
          <Select disabled={isLoading} value={age} onValueChange={setAge}>
            <SelectTrigger>
              <SelectValue placeholder="Age" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any age</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="7d">7d+</SelectItem>
              <SelectItem value="30d">30d+</SelectItem>
              <SelectItem value="90d">90d+</SelectItem>
            </SelectContent>
          </Select>
          <Select disabled={isLoading} value={sla} onValueChange={setSla}>
            <SelectTrigger>
              <SelectValue placeholder="SLA" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All SLA</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
              <SelectItem value="due_soon">Due soon</SelectItem>
              <SelectItem value="on_track">On track</SelectItem>
              <SelectItem value="none">No SLA</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Select disabled={isLoading} value={sortField} onValueChange={(value) => setSortField(value as SortField)}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Sort field" />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button
              disabled={isLoading}
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))}
              aria-label={`Sort ${sortDirection === 'asc' ? 'ascending' : 'descending'}`}
              title={sortDirection === 'asc' ? 'Ascending' : 'Descending'}
            >
              {sortDirection === 'asc' ? <ArrowUp className="size-4" /> : <ArrowDown className="size-4" />}
            </Button>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 border rounded-md bg-background">
            <input
              id="onlyLatestScan"
              type="checkbox"
              checked={onlyLatestScan}
              disabled={isLoading}
              onChange={(e) => setOnlyLatestScan(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary dark:border-slate-700 bg-background disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <label htmlFor="onlyLatestScan" className={`text-xs font-medium text-foreground select-none ${isLoading ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
              Hide duplicate findings (latest scan only)
            </label>
          </div>
        </section>

        <section className="overflow-hidden rounded-lg border bg-card/30">
          <div className="overflow-x-auto overflow-y-hidden no-scrollbar-y w-full">
            <div className="min-w-[900px] lg:min-w-full">
              <div className="grid grid-cols-[minmax(180px,1.2fr)_minmax(140px,0.9fr)_minmax(130px,1fr)_90px_90px_100px_70px_100px] gap-3 border-b bg-muted/40 px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">
                <span>Project / CVE</span>
                <span>Package</span>
                <span>Scanners</span>
                <span>Severity</span>
                <span>Status</span>
                <span>Seen</span>
                <span>Scans</span>
                <span>SLA</span>
              </div>
              {isLoading ? (
                <div className="p-8 text-sm text-muted-foreground">Loading findings...</div>
              ) : error ? (
                <div className="p-8 text-sm text-destructive">Unable to load findings.</div>
              ) : groups.length === 0 ? (
                <div className="p-8 text-sm text-muted-foreground">No findings match the current filters.</div>
              ) : groups.map((group) => {
                const expanded = expandedProjects.has(group.key);
                return (
                  <div key={group.key}>
                    <button
                      type="button"
                      onClick={() => setExpandedProjects((prev) => {
                        const next = new Set(prev);
                        if (next.has(group.key)) next.delete(group.key);
                        else next.add(group.key);
                        return next;
                      })}
                      className="flex w-full items-center justify-between gap-4 border-b bg-background px-4 py-3 text-left hover:bg-muted/40"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                        <span className="truncate font-medium">{group.title}</span>
                        <Badge variant="secondary">{group.count}</Badge>
                      </span>
                      <span className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                        <span className="truncate">{group.subtitle}</span>
                        <Badge variant="outline" className="shrink-0">{group.activeCount} active</Badge>
                        <Badge variant="outline" className="shrink-0">{group.criticalHighCount} high+</Badge>
                      </span>
                    </button>
                    {expanded ? (group.findings ?? []).map((finding) => (
                      <div
                        key={finding.id}
                        onClick={() => setSelectedFindingId(finding.id)}
                        className="grid w-full grid-cols-[minmax(180px,1.2fr)_minmax(140px,0.9fr)_minmax(130px,1fr)_90px_90px_100px_70px_100px] gap-3 border-b px-4 py-3 text-left text-sm hover:bg-muted/30 cursor-pointer items-center group/row"
                      >
                        <span className="min-w-0 border-l-4 pl-3">
                          <span className="block truncate font-medium">{finding.project.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">{finding.cveId}</span>
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate">{finding.packageName}</span>
                          <span className="block truncate text-xs text-muted-foreground">{finding.installedVersion} → {finding.fixedVersion || 'unfixed'}</span>
                          <span className="block truncate text-[11px] text-muted-foreground">{finding.filePath || finding.project.targetRef}</span>
                        </span>
                        <ScannerBadges cveId={finding.cveId} reportedBy={finding.reportedBy} />
                        <span><Badge variant="outline" className={`border-l-4 ${severityClasses[finding.severity]}`}>{finding.severity}</Badge></span>
                        <span><StatusBadge status={finding.status} /></span>
                        <span className="text-xs text-muted-foreground">{formatDate(finding.firstSeenAt)}<br />{finding.ageDays}d old</span>
                        <span>{finding.scanCount}</span>
                        <span><SlaBadge state={finding.slaState} dueAt={finding.slaDueAt} /></span>
                      </div>
                    )) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>

      <Sheet open={!!selectedFinding} onOpenChange={(open) => !open && setSelectedFindingId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
          {selectedFinding ? (
            <>
              <SheetHeader>
                <SheetTitle>{selectedFinding.cveId}</SheetTitle>
                <SheetDescription>{selectedFinding.project.name} · {selectedFinding.packageName}@{selectedFinding.installedVersion}</SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-6">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                    <span className="block text-[11px] uppercase tracking-wide text-muted-foreground">Status</span>
                    <div className="mt-1">
                      <StatusBadge status={selectedFinding.status} />
                    </div>
                  </div>
                  <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                    <span className="block text-[11px] uppercase tracking-wide text-muted-foreground">Severity</span>
                    <div className="mt-1">
                      <Badge variant="outline" className={`border-l-4 ${severityClasses[selectedFinding.severity]}`}>{selectedFinding.severity}</Badge>
                    </div>
                  </div>
                  <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                    <span className="block text-[11px] uppercase tracking-wide text-muted-foreground">SLA</span>
                    <div className="mt-1">
                      <SlaBadge state={selectedFinding.slaState} dueAt={selectedFinding.slaDueAt} />
                    </div>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">{selectedFinding.description || 'No description available.'}</p>
                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  <div><span className="text-muted-foreground">First seen</span><br />{formatDate(selectedFinding.firstSeenAt)}</div>
                  <div><span className="text-muted-foreground">Last seen</span><br />{formatDate(selectedFinding.lastSeenAt)}</div>
                  <div><span className="text-muted-foreground">Active for</span><br />{selectedFinding.activeDays} days</div>
                  <div><span className="text-muted-foreground">Scan count</span><br />{selectedFinding.scanCount}</div>
                  <div><span className="text-muted-foreground">Fixed version</span><br />{selectedFinding.fixedVersion || 'Not available'}</div>
                  <div><span className="text-muted-foreground">Scanners</span><br /><ScannerBadges cveId={selectedFinding.cveId} reportedBy={selectedFinding.reportedBy} /></div>
                </div>
              <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => runAction('accept', selectedFinding)}
                    disabled={pendingAction !== null}
                  >
                    {pendingAction?.findingId === selectedFinding.id && pendingAction.action === 'accept'
                      ? 'Accepting...'
                      : 'Accept'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => runAction('snooze', selectedFinding)}
                    disabled={pendingAction !== null}
                  >
                    {pendingAction?.findingId === selectedFinding.id && pendingAction.action === 'snooze'
                      ? 'Snoozing...'
                      : 'Snooze'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => runAction('reject', selectedFinding)}
                    disabled={pendingAction !== null}
                  >
                    {pendingAction?.findingId === selectedFinding.id && pendingAction.action === 'reject'
                      ? 'Rejecting...'
                      : 'Reject'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => runAction('reopen', selectedFinding)}
                    disabled={pendingAction !== null}
                  >
                    {pendingAction?.findingId === selectedFinding.id && pendingAction.action === 'reopen'
                      ? 'Reopening...'
                      : 'Reopen'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(`${selectedFinding.cveId} ${selectedFinding.packageName}@${selectedFinding.installedVersion}`)}>
                    <Copy className="size-4" /> Copy
                  </Button>
                </div>
                {pendingAction?.findingId === selectedFinding.id && (
                  <div className="text-xs text-muted-foreground">Updating finding status...</div>
                )}
                <div className="flex flex-wrap gap-2">
                  {selectedFinding.latestScan ? (
                    <>
                      <Button size="sm" asChild>
                        <a href={`/reports/${selectedFinding.latestScan.id}`}>Open latest report</a>
                      </Button>
                      <Button size="sm" variant="outline" asChild>
                        <a href={`/scans/${selectedFinding.latestScan.id}`}>Latest scan</a>
                      </Button>
                    </>
                  ) : null}
                  <Button size="sm" variant="outline" asChild>
                    <a href={selectedFinding.links.nvd} target="_blank" rel="noreferrer"><ExternalLink className="size-4" /> NVD</a>
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <a href={selectedFinding.links.githubAdvisory} target="_blank" rel="noreferrer"><ExternalLink className="size-4" /> Advisory</a>
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

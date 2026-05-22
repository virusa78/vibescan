import { useMemo, useState } from 'react';
import {
  acceptProjectFinding,
  getFindingsOverview,
  rejectProjectFinding,
  reopenProjectFinding,
  snoozeProjectFinding,
  useQuery,
} from 'wasp/client/operations';
import { AlertCircle, CheckCircle2, ChevronDown, ChevronRight, Copy, ExternalLink, ShieldAlert, TimerReset } from 'lucide-react';
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

const severityClasses: Record<Severity, string> = {
  critical: 'border-l-red-600 bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300',
  high: 'border-l-orange-500 bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-300',
  medium: 'border-l-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300',
  low: 'border-l-sky-500 bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-300',
  info: 'border-l-slate-400 bg-slate-50 text-slate-700 dark:bg-slate-900/40 dark:text-slate-300',
};

function formatDate(value?: string | null): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
}

function StatusBadge({ status }: { status: FindingStatus }) {
  const variant = status === 'active' ? 'destructive' : status === 'mitigated' ? 'secondary' : 'outline';
  return <Badge variant={variant as any} className="capitalize">{status}</Badge>;
}

function SlaBadge({ state, dueAt }: { state: ProjectFindingRow['slaState']; dueAt?: string | null }) {
  const label = state === 'none' ? 'No SLA' : state.replace('_', ' ');
  const className = state === 'overdue'
    ? 'border-red-300 bg-red-50 text-red-700'
    : state === 'due_soon'
      ? 'border-amber-300 bg-amber-50 text-amber-700'
      : 'border-emerald-300 bg-emerald-50 text-emerald-700';
  return <Badge variant="outline" className={className}>{label}{dueAt ? ` · ${formatDate(dueAt)}` : ''}</Badge>;
}

export default function FindingsPage() {
  const [query, setQuery] = useState('');
  const [severity, setSeverity] = useState<string>('all');
  const [status, setStatus] = useState<string>('active');
  const [sla, setSla] = useState<string>('all');
  const [sort, setSort] = useState<string>('severity:desc');
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [selectedFinding, setSelectedFinding] = useState<ProjectFindingRow | null>(null);

  const [sortField, sortDirection] = sort.split(':') as [string, 'asc' | 'desc'];
  const overviewArgs = useMemo(() => ({
    q: query || undefined,
    severity: severity === 'all' ? [] : [severity],
    status: status === 'all' ? [] : [status],
    sla: sla === 'all' ? [] : [sla],
    sort: { field: sortField, direction: sortDirection },
    limit: 250,
  }), [query, severity, sla, sortDirection, sortField, status]);

  const { data, isLoading, error, refetch } = useQuery(getFindingsOverview, overviewArgs);
  const findings = (data?.findings ?? []) as ProjectFindingRow[];
  const summary = data?.summary ?? { active: 0, criticalHigh: 0, overdueSla: 0, newlySeen: 0, mitigated: 0 };

  const grouped = useMemo(() => {
    const groups = new Map<string, { project: ProjectFindingRow['project']; rows: ProjectFindingRow[] }>();
    for (const finding of findings) {
      const existing = groups.get(finding.project.id) ?? { project: finding.project, rows: [] };
      existing.rows.push(finding);
      groups.set(finding.project.id, existing);
    }
    return Array.from(groups.values());
  }, [findings]);

  const runAction = async (action: 'accept' | 'snooze' | 'reject' | 'reopen', finding: ProjectFindingRow) => {
    const payload = {
      projectFindingId: finding.id,
      reason: action === 'snooze' ? 'Temporarily deferred from Findings triage' : `Marked ${action} from Findings triage`,
      ...(action === 'snooze'
        ? { expiresAt: new Date(Date.now() + 14 * 86_400_000).toISOString() }
        : {}),
    };
    if (action === 'accept') await acceptProjectFinding(payload);
    if (action === 'snooze') await snoozeProjectFinding(payload);
    if (action === 'reject') await rejectProjectFinding(payload);
    if (action === 'reopen') await reopenProjectFinding(payload);
    await refetch();
  };

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">Findings</h1>
            <p className="text-sm text-muted-foreground">Workspace CVE lifecycle grouped by project.</p>
          </div>
        </div>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {[
            { label: 'Active', value: summary.active, icon: ShieldAlert },
            { label: 'Critical / High', value: summary.criticalHigh, icon: AlertCircle },
            { label: 'Overdue SLA', value: summary.overdueSla, icon: TimerReset },
            { label: 'Newly seen', value: summary.newlySeen, icon: ChevronRight },
            { label: 'Mitigated', value: summary.mitigated, icon: CheckCircle2 },
          ].map((item) => (
            <Card key={item.label} className="rounded-lg">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{item.label}</CardTitle>
                <item.icon className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{item.value}</div>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="flex flex-col gap-3 rounded-lg border bg-background p-3 lg:flex-row lg:items-center">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search CVE, package, project, or path"
            className="lg:max-w-md"
          />
          <Select value={severity} onValueChange={setSeverity}>
            <SelectTrigger className="lg:w-40"><SelectValue placeholder="Severity" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All severities</SelectItem>
              {(['critical', 'high', 'medium', 'low', 'info'] as Severity[]).map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="lg:w-40"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {(['active', 'accepted', 'snoozed', 'rejected', 'mitigated'] as FindingStatus[]).map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={sla} onValueChange={setSla}>
            <SelectTrigger className="lg:w-40"><SelectValue placeholder="SLA" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All SLA</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
              <SelectItem value="due_soon">Due soon</SelectItem>
              <SelectItem value="on_track">On track</SelectItem>
              <SelectItem value="none">No SLA</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="lg:w-52"><SelectValue placeholder="Sort" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="severity:desc">Severity, SLA, age</SelectItem>
              <SelectItem value="firstSeen:asc">First seen oldest</SelectItem>
              <SelectItem value="lastSeen:desc">Last seen newest</SelectItem>
              <SelectItem value="project:asc">Project A-Z</SelectItem>
              <SelectItem value="package:asc">Package A-Z</SelectItem>
              <SelectItem value="scanCount:desc">Scan count</SelectItem>
              <SelectItem value="fixedVersion:asc">Fixed version</SelectItem>
            </SelectContent>
          </Select>
        </section>

        <section className="overflow-hidden rounded-lg border">
          <div className="grid grid-cols-[minmax(240px,1.3fr)_minmax(170px,0.9fr)_minmax(180px,1fr)_120px_120px_130px_110px_130px] gap-3 border-b bg-muted/40 px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">
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
          ) : grouped.length === 0 ? (
            <div className="p-8 text-sm text-muted-foreground">No findings match the current filters.</div>
          ) : grouped.map((group) => {
            const expanded = expandedProjects.has(group.project.id);
            return (
              <div key={group.project.id}>
                <button
                  type="button"
                  onClick={() => setExpandedProjects((prev) => {
                    const next = new Set(prev);
                    if (next.has(group.project.id)) next.delete(group.project.id);
                    else next.add(group.project.id);
                    return next;
                  })}
                  className="flex w-full items-center justify-between border-b bg-background px-4 py-3 text-left hover:bg-muted/40"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                    <span className="truncate font-medium">{group.project.name}</span>
                    <Badge variant="secondary">{group.rows.length}</Badge>
                  </span>
                  <span className="truncate text-xs text-muted-foreground">{group.project.targetRef}</span>
                </button>
                {expanded ? group.rows.map((finding) => (
                  <button
                    key={finding.id}
                    type="button"
                    onClick={() => setSelectedFinding(finding)}
                    className="grid w-full grid-cols-[minmax(240px,1.3fr)_minmax(170px,0.9fr)_minmax(180px,1fr)_120px_120px_130px_110px_130px] gap-3 border-b px-4 py-3 text-left text-sm hover:bg-muted/30"
                  >
                    <span className="min-w-0 border-l-4 pl-3">
                      <span className="block truncate font-medium">{finding.cveId}</span>
                      <span className="block truncate text-xs text-muted-foreground">{finding.filePath || 'No path'}</span>
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate">{finding.packageName}</span>
                      <span className="block truncate text-xs text-muted-foreground">{finding.installedVersion} → {finding.fixedVersion || 'unfixed'}</span>
                    </span>
                    <ScannerBadges cveId={finding.cveId} reportedBy={finding.reportedBy} />
                    <span><Badge variant="outline" className={`border-l-4 ${severityClasses[finding.severity]}`}>{finding.severity}</Badge></span>
                    <span><StatusBadge status={finding.status} /></span>
                    <span className="text-xs text-muted-foreground">{formatDate(finding.firstSeenAt)}<br />{finding.ageDays}d old</span>
                    <span>{finding.scanCount}</span>
                    <span><SlaBadge state={finding.slaState} dueAt={finding.slaDueAt} /></span>
                  </button>
                )) : null}
              </div>
            );
          })}
        </section>
      </div>

      <Sheet open={!!selectedFinding} onOpenChange={(open) => !open && setSelectedFinding(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
          {selectedFinding ? (
            <>
              <SheetHeader>
                <SheetTitle>{selectedFinding.cveId}</SheetTitle>
                <SheetDescription>{selectedFinding.project.name} · {selectedFinding.packageName}@{selectedFinding.installedVersion}</SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-6">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className={`border-l-4 ${severityClasses[selectedFinding.severity]}`}>{selectedFinding.severity}</Badge>
                  <StatusBadge status={selectedFinding.status} />
                  <SlaBadge state={selectedFinding.slaState} dueAt={selectedFinding.slaDueAt} />
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
                  <Button size="sm" variant="outline" onClick={() => runAction('accept', selectedFinding)}>Accept</Button>
                  <Button size="sm" variant="outline" onClick={() => runAction('snooze', selectedFinding)}>Snooze</Button>
                  <Button size="sm" variant="outline" onClick={() => runAction('reject', selectedFinding)}>Reject</Button>
                  <Button size="sm" variant="outline" onClick={() => runAction('reopen', selectedFinding)}>Reopen</Button>
                  <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(`${selectedFinding.cveId} ${selectedFinding.packageName}@${selectedFinding.installedVersion}`)}>
                    <Copy className="size-4" /> Copy
                  </Button>
                </div>
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
    </main>
  );
}

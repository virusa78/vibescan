import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { AlertCircle, FileText, ShieldCheck } from 'lucide-react';
import { ToggleChipGroup } from '../client/components/common/ToggleChipGroup';
import { Link as ExternalLink } from '../client/components/common/VibeUI';
import { Button } from '../client/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../client/components/ui/card';
import { Input } from '../client/components/ui/input';
import { Skeleton } from '../client/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../client/components/ui/select';
import { useAsyncState } from '../client/hooks/useAsyncState';
import { toast } from '../client/hooks/use-toast';
import { isEditableTarget } from '../client/utils/keyboard';
import { buildPatchSnippet } from './patchSnippet';
import { resolveCveId, buildGitHubAdvisoryUrl, buildNvdUrl, buildPackageUrl } from './linkHelpers';
import { api } from '../client/utils/api';

type SeveritySummary = {
  critical?: number;
  high?: number;
  medium?: number;
  low?: number;
  info?: number;
};

type ReportSummary = {
  scanId: string;
  totalFindings: number;
  severity: SeveritySummary;
};

type ReportFinding = {
  id?: string;
  cveId?: string;
  cve?: string;
  packageName?: string;
  ecosystem?: string;
  severity?: string;
  description?: string;
  fixedVersion?: string | null;
  annotation?: {
    state?: 'accepted' | 'snoozed' | 'rejected' | 'expired';
    reason?: string | null;
    expires_at?: string | null;
  } | null;
};

type ReportResponse = {
  scanId?: string;
  findings?: ReportFinding[];
  vulnerabilities?: ReportFinding[];
};

type CiDecision = {
  decision: 'pass' | 'fail';
  reason: string;
  criticalIssues: number;
};

type FixableFilter = 'all' | 'fixable' | 'unfixable';
type SeverityFilter = 'all' | 'critical' | 'high' | 'medium' | 'low' | 'info';
type AnnotationFilter = 'all' | 'accepted' | 'snoozed' | 'rejected' | 'expired' | 'unannotated';

function isFixableFinding(finding: ReportFinding): boolean {
  return Boolean((finding.fixedVersion ?? '').trim());
}

export default function ReportsPage() {
  const { scanId } = useParams();
  const navigate = useNavigate();
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const { isLoading, error, run, setError, setIsLoading } = useAsyncState(true);

  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [ciDecision, setCiDecision] = useState<CiDecision | null>(null);
  const [pdfStatus, setPdfStatus] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [fixableFilter, setFixableFilter] = useState<FixableFilter>('all');
  const [annotationFilter, setAnnotationFilter] = useState<AnnotationFilter>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'severity' | 'package' | 'cve'>('newest');
  const [annotationDrafts, setAnnotationDrafts] = useState<Record<string, { state: 'accepted' | 'snoozed' | 'rejected'; reason: string; expiresAt: string }>>({});
  const [annotationSaving, setAnnotationSaving] = useState<Record<string, boolean>>({});
  const [remediationLoading, setRemediationLoading] = useState<Record<string, boolean>>({});
  const [remediationTimestamp, setRemediationTimestamp] = useState<Record<string, string | null>>({});

  useEffect(() => {
    if (!scanId) {
      setError('Missing scan id in route.');
      setIsLoading(false);
      return;
    }

    run(
      async () => {
        const [summaryRes, reportRes, ciRes] = await Promise.all([
          api.get(`/api/v1/reports/${scanId}/summary`),
          api.get(`/api/v1/reports/${scanId}`),
          api.get(`/api/v1/reports/${scanId}/ci-decision`),
        ]);

        setSummary(summaryRes.data);
        setReport(reportRes.data);
        setCiDecision(ciRes.data);
      },
      { errorMessage: 'Failed to load report data.' },
    );
  }, [scanId, run, setError, setIsLoading]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }

      if (event.key === '/' && !event.shiftKey) {
        if (isEditableTarget(event.target)) {
          return;
        }

        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      if (event.key === 'Escape') {
        if (searchQuery.length > 0) {
          event.preventDefault();
          setSearchQuery('');
        }

        const target = event.target;
        if (target instanceof HTMLElement && target.getAttribute('aria-pressed') !== null) {
          target.blur();
        }
        return;
      }

      if (isEditableTarget(event.target)) {
        return;
      }

      if (event.key >= '1' && event.key <= '5') {
        const severityByKey: Record<string, SeverityFilter> = {
          '1': 'critical',
          '2': 'high',
          '3': 'medium',
          '4': 'low',
          '5': 'info',
        };

        const nextSeverity = severityByKey[event.key];
        if (nextSeverity) {
          event.preventDefault();
          setSeverityFilter(nextSeverity);
        }
        return;
      }

      if (event.key.toLowerCase() === 'f') {
        event.preventDefault();
        setFixableFilter((previous) => (previous === 'fixable' ? 'all' : 'fixable'));
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [searchQuery.length]);

  const generatePdf = async () => {
    if (!scanId) return;

    setPdfStatus('Queueing PDF generation...');
    try {
      const res = await api.post(`/api/v1/reports/${scanId}/pdf`, { format: 'full' });
      const data = res.data;
      setPdfStatus(`PDF job queued: ${data.jobId}`);
    } catch (err) {
      setPdfStatus(err instanceof Error ? err.message : 'Failed to queue PDF.');
    }
  };

  const findings = useMemo(() => {
    const incoming = report?.findings ?? report?.vulnerabilities ?? [];
    return Array.isArray(incoming) ? incoming : [];
  }, [report]);

  const severitySummary = useMemo<SeveritySummary>(() => {
    const fallback = findings.reduce<Required<SeveritySummary>>(
      (acc, finding) => {
        const normalized = (finding.severity ?? '').toLowerCase();
        if (normalized === 'critical') acc.critical += 1;
        else if (normalized === 'high') acc.high += 1;
        else if (normalized === 'medium') acc.medium += 1;
        else if (normalized === 'low') acc.low += 1;
        else acc.info += 1;
        return acc;
      },
      { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
    );

    return {
      critical: summary?.severity?.critical ?? fallback.critical,
      high: summary?.severity?.high ?? fallback.high,
      medium: summary?.severity?.medium ?? fallback.medium,
      low: summary?.severity?.low ?? fallback.low,
      info: summary?.severity?.info ?? fallback.info,
    };
  }, [findings, summary?.severity]);

  const severityChipOptions = useMemo(() => {
    const entries = [
      { value: 'critical', label: 'Critical', count: severitySummary.critical ?? 0 },
      { value: 'high', label: 'High', count: severitySummary.high ?? 0 },
      { value: 'medium', label: 'Medium', count: severitySummary.medium ?? 0 },
      { value: 'low', label: 'Low', count: severitySummary.low ?? 0 },
      { value: 'info', label: 'Info', count: severitySummary.info ?? 0 },
    ];

    return [{ value: 'all', label: 'All', count: findings.length }, ...entries];
  }, [findings.length, severitySummary.critical, severitySummary.high, severitySummary.info, severitySummary.low, severitySummary.medium]);

  const fixableCounts = useMemo(() => {
    const fixable = findings.filter(isFixableFinding).length;
    const unfixable = findings.length - fixable;

    return {
      all: findings.length,
      fixable,
      unfixable,
    };
  }, [findings]);

  const fixableChipOptions = useMemo(
    () => [
      { value: 'all', label: 'All', count: fixableCounts.all },
      { value: 'fixable', label: 'Fixable', count: fixableCounts.fixable },
      { value: 'unfixable', label: 'Unfixable', count: fixableCounts.unfixable },
    ],
    [fixableCounts.all, fixableCounts.fixable, fixableCounts.unfixable],
  );

  const annotationCounts = useMemo(() => {
    const counts: Record<AnnotationFilter, number> = {
      all: findings.length,
      accepted: 0,
      snoozed: 0,
      rejected: 0,
      expired: 0,
      unannotated: 0,
    };

    for (const finding of findings) {
      const state = finding.annotation?.state;
      if (!state) {
        counts.unannotated += 1;
        continue;
      }

      if (state === 'accepted') counts.accepted += 1;
      else if (state === 'snoozed') counts.snoozed += 1;
      else if (state === 'rejected') counts.rejected += 1;
      else if (state === 'expired') counts.expired += 1;
    }

    return counts;
  }, [findings]);

  const annotationChipOptions = useMemo(
    () => [
      { value: 'all', label: 'All', count: annotationCounts.all },
      { value: 'accepted', label: 'Accepted', count: annotationCounts.accepted },
      { value: 'snoozed', label: 'Snoozed', count: annotationCounts.snoozed },
      { value: 'rejected', label: 'Rejected', count: annotationCounts.rejected },
      { value: 'expired', label: 'Expired', count: annotationCounts.expired },
      { value: 'unannotated', label: 'No annotation', count: annotationCounts.unannotated },
    ],
    [annotationCounts],
  );

  const filteredFindings = useMemo(() => {
    const list = findings.slice();
    const query = searchQuery.trim().toLowerCase();

    const filtered = list.filter((finding) => {
      if (severityFilter !== 'all' && (finding.severity ?? '').toLowerCase() !== severityFilter) {
        return false;
      }

      if (fixableFilter === 'fixable' && !isFixableFinding(finding)) {
        return false;
      }

      if (fixableFilter === 'unfixable' && isFixableFinding(finding)) {
        return false;
      }

      if (annotationFilter === 'unannotated' && finding.annotation?.state) {
        return false;
      }

      if (annotationFilter !== 'all' && annotationFilter !== 'unannotated') {
        if ((finding.annotation?.state ?? null) !== annotationFilter) {
          return false;
        }
      }

      if (!query) {
        return true;
      }

      const cve = (finding.cveId ?? finding.cve ?? '').toLowerCase();
      const pkg = (finding.packageName ?? '').toLowerCase();
      const description = (finding.description ?? '').toLowerCase();
      return cve.includes(query) || pkg.includes(query) || description.includes(query);
    });

    if (sortBy === 'severity') {
      const order: Record<string, number> = {
        critical: 0,
        high: 1,
        medium: 2,
        low: 3,
        info: 4,
        unknown: 5,
      };
      filtered.sort(
        (a, b) => order[(a.severity ?? 'unknown').toLowerCase()] - order[(b.severity ?? 'unknown').toLowerCase()],
      );
    } else if (sortBy === 'package') {
      filtered.sort((a, b) => (a.packageName ?? '').localeCompare(b.packageName ?? ''));
    } else if (sortBy === 'cve') {
      filtered.sort((a, b) => (a.cveId ?? a.cve ?? '').localeCompare(b.cveId ?? b.cve ?? ''));
    }

    return filtered;
  }, [annotationFilter, findings, fixableFilter, searchQuery, severityFilter, sortBy]);

  const buildPackageLink = (finding: ReportFinding): string | null => {
    return buildPackageUrl(finding);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSeverityFilter('all');
    setFixableFilter('all');
    setAnnotationFilter('all');
  };

  const updateFindingAnnotationInState = (
    findingId: string,
    annotation: { state: 'accepted' | 'snoozed' | 'rejected' | 'expired'; reason: string | null; expires_at: string | null },
  ) => {
    setReport((previous) => {
      if (!previous) return previous;

      if (Array.isArray(previous.findings)) {
        return {
          ...previous,
          findings: previous.findings.map((finding) =>
            finding.id === findingId ? { ...finding, annotation } : finding,
          ),
        };
      }

      if (Array.isArray(previous.vulnerabilities)) {
        return {
          ...previous,
          vulnerabilities: previous.vulnerabilities.map((finding) =>
            finding.id === findingId ? { ...finding, annotation } : finding,
          ),
        };
      }

      return previous;
    });
  };

  if (isLoading) {
    return (
      <div className="p-8 lg:p-10 space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((idx) => (
            <Card key={idx} className="border-border/50 bg-card/50 backdrop-blur-sm">
              <CardHeader className="pb-3">
                <Skeleton className="h-3 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-4 w-56" />
          </CardHeader>
          <CardContent className="space-y-3">
            {[0, 1, 2].map((idx) => (
              <Skeleton key={idx} className="h-14 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="rounded-md border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-600">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 lg:p-10">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-foreground text-4xl font-bold tracking-tight mb-2">Report</h1>
          <p className="text-muted-foreground">Scan: {scanId}</p>
        </div>
        <Button onClick={generatePdf} aria-label="Generate report PDF">
          <FileText className="w-4 h-4 mr-2" />
          Generate PDF
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Total Findings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">{summary?.totalFindings ?? findings.length}</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Critical
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-red-500">{severitySummary.critical ?? 0}</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              High
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-orange-500">{severitySummary.high ?? 0}</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-primary" />
              CI Decision
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${ciDecision?.decision === 'pass' ? 'text-green-500' : 'text-red-500'}`}>
              {(ciDecision?.decision ?? 'unknown').toUpperCase()}
            </p>
          </CardContent>
        </Card>
      </div>

      {pdfStatus && (
        <div className="mb-6 rounded-md border border-border/60 bg-card/40 p-3 text-sm text-muted-foreground">
          {pdfStatus}
        </div>
      )}

      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader className="space-y-3">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <div>
              <CardTitle>Findings</CardTitle>
              <p className="text-sm text-muted-foreground">Filter, search and sort findings</p>
            </div>
            <div className="flex items-center gap-2">
              <Input
                ref={searchInputRef}
                placeholder="Search by CVE or package"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="w-64"
                aria-label="Search findings"
              />
              <Select value={sortBy} onValueChange={(value) => setSortBy(value as typeof sortBy)}>
                <SelectTrigger className="w-44" aria-label="Sort findings">
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Default</SelectItem>
                  <SelectItem value="severity">Severity</SelectItem>
                  <SelectItem value="package">Package</SelectItem>
                  <SelectItem value="cve">CVE</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={() => { clearFilters(); setSortBy('newest'); }} aria-label="Clear all findings filters">
                Clear
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Severity</p>
            <ToggleChipGroup
              options={severityChipOptions}
              value={severityFilter}
              onChange={(next) => setSeverityFilter(next as SeverityFilter)}
              ariaLabel="Severity filters"
            />
          </div>

          <div className="space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Fixability</p>
            <ToggleChipGroup
              options={fixableChipOptions}
              value={fixableFilter}
              onChange={(next) => setFixableFilter(next as FixableFilter)}
              ariaLabel="Fixability filters"
            />
          </div>

          <div className="space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Annotation</p>
            <ToggleChipGroup
              options={annotationChipOptions}
              value={annotationFilter}
              onChange={(next) => setAnnotationFilter(next as AnnotationFilter)}
              ariaLabel="Annotation filters"
            />
          </div>
        </CardHeader>
        <CardContent>
          {findings.length === 0 ? (
            <div className="rounded-md border border-border/60 bg-card/40 p-4">
              <p className="text-sm font-medium text-foreground">Clean! This scan has no findings.</p>
              <Button className="mt-3" onClick={() => navigate('/dashboard')} aria-label="Back to Dashboard">
                Back to Dashboard
              </Button>
            </div>
          ) : filteredFindings.length === 0 ? (
            <div className="rounded-md border border-border/60 bg-card/40 p-4 text-sm text-muted-foreground flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                No findings match current filters.
              </div>
              <Button variant="outline" onClick={clearFilters} aria-label="Clear findings filters">
                Clear filters
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredFindings.map((finding, index) => {
                const fid = finding.id ?? `${finding.cveId ?? finding.cve ?? 'finding'}-${index}`;
                const findingId = finding.id ?? '';
                const cve = resolveCveId(finding);
                const packageLink = buildPackageLink(finding);
                const fixSnippet = buildPatchSnippet(finding.ecosystem, finding.packageName, finding.fixedVersion);
                const canCopyPatch = fixSnippet.length > 0;
                const draft = annotationDrafts[fid] ?? {
                  state: (finding.annotation?.state === 'snoozed' || finding.annotation?.state === 'rejected'
                    ? finding.annotation.state
                    : 'accepted') as 'accepted' | 'snoozed' | 'rejected',
                  reason: finding.annotation?.reason ?? '',
                  expiresAt: finding.annotation?.expires_at?.slice(0, 10) ?? '',
                };

                return (
                  <div key={fid} className="rounded-md border border-border/50 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-mono text-sm text-foreground">
                        {cve ? (
                          <span className="flex items-center gap-2">
                            <ExternalLink
                              href={buildGitHubAdvisoryUrl(cve)}
                              aria-label={`Open GitHub advisory search for ${cve}`}
                            >
                              {cve}
                            </ExternalLink>
                            <ExternalLink
                              href={buildNvdUrl(cve)}
                              withIcon={false}
                              className="text-xs text-muted-foreground"
                              aria-label={`Open NVD details for ${cve}`}
                            >
                              NVD
                            </ExternalLink>
                          </span>
                        ) : (
                          'Unknown CVE'
                        )}
                      </p>
                      <span className="text-xs px-2 py-1 rounded bg-accent/60 text-foreground">
                        {(finding.severity ?? 'unknown').toUpperCase()}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {finding.packageName ? (
                        packageLink ? (
                          <ExternalLink
                            href={packageLink}
                            className="text-sm"
                            aria-label={`Open package page for ${finding.packageName}`}
                          >
                            {finding.packageName}
                          </ExternalLink>
                        ) : (
                          finding.packageName
                        )
                      ) : (
                        finding.description ?? 'No details'
                      )}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded border border-border/60 bg-card/50 px-2 py-1">
                        Annotation: {(finding.annotation?.state ?? 'none').toUpperCase()}
                      </span>
                      {finding.annotation?.reason ? (
                        <span className="text-muted-foreground">Note: {finding.annotation.reason}</span>
                      ) : null}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Select
                        value={draft.state}
                        onValueChange={(value) =>
                          setAnnotationDrafts((previous) => ({
                            ...previous,
                            [fid]: { ...draft, state: value as 'accepted' | 'snoozed' | 'rejected' },
                          }))
                        }
                      >
                        <SelectTrigger className="w-36" aria-label="Annotation state">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="accepted">Accepted</SelectItem>
                          <SelectItem value="snoozed">Snoozed</SelectItem>
                          <SelectItem value="rejected">Rejected</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        value={draft.reason}
                        onChange={(event) =>
                          setAnnotationDrafts((previous) => ({
                            ...previous,
                            [fid]: { ...draft, reason: event.target.value },
                          }))
                        }
                        className="w-64"
                        placeholder="Optional note"
                        aria-label="Annotation reason"
                      />
                      {draft.state === 'snoozed' && (
                        <Input
                          type="date"
                          value={draft.expiresAt}
                          onChange={(event) =>
                            setAnnotationDrafts((previous) => ({
                              ...previous,
                              [fid]: { ...draft, expiresAt: event.target.value },
                            }))
                          }
                          className="w-44"
                          aria-label="Snooze until date"
                        />
                      )}
                      <Button
                        onClick={async () => {
                          if (!scanId || !findingId) return;
                          setAnnotationSaving((previous) => ({ ...previous, [fid]: true }));
                          try {
                            const payload: Record<string, unknown> = {
                              state: draft.state,
                              reason: draft.reason.trim() || undefined,
                            };
                            if (draft.state === 'snoozed' && draft.expiresAt) {
                              payload.expiresAt = new Date(`${draft.expiresAt}T23:59:59.000Z`).toISOString();
                            }

                            const response = await api.post(
                              `/api/v1/reports/${scanId}/findings/${findingId}/annotation`,
                              payload,
                            );
                            const annotation = response.data?.annotation;
                            if (annotation) {
                              updateFindingAnnotationInState(findingId, annotation);
                              toast({ title: 'Annotation saved' });
                            }
                          } catch (annotationError) {
                            console.error(annotationError);
                            toast({ title: 'Annotation save failed', variant: 'destructive' });
                          } finally {
                            setAnnotationSaving((previous) => ({ ...previous, [fid]: false }));
                          }
                        }}
                        aria-label="Save annotation"
                      >
                        {annotationSaving[fid] ? 'Saving...' : 'Save annotation'}
                      </Button>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Button
                        onClick={() => {
                          void navigator.clipboard?.writeText(`${finding.cveId ?? finding.cve ?? ''}\n${finding.packageName ?? ''}\n${finding.description ?? ''}`);
                          toast({ title: 'Finding copied' });
                        }}
                        aria-label="Copy finding details"
                      >
                        Copy
                      </Button>
                      <Button
                        disabled={!canCopyPatch}
                        title={!canCopyPatch ? 'Patch snippet requires package and fixed version' : 'Copy patch snippet'}
                        onClick={() => {
                          if (!canCopyPatch) return;
                          void navigator.clipboard?.writeText(fixSnippet);
                          toast({ title: 'Patch snippet copied' });
                        }}
                        aria-label="Copy-as patch"
                      >
                        Copy-as patch
                      </Button>
                      <Button
                        onClick={async () => {
                          if (!scanId || !findingId) return;
                          setRemediationLoading((prev) => ({ ...prev, [fid]: true }));
                          try {
                            const res = await api.post(
                              `/api/v1/reports/${scanId}/findings/${findingId}/remediation`,
                              { promptType: 'quick_fix' },
                            );
                            const data = res.data;
                            setRemediationTimestamp((prev) => ({
                              ...prev,
                              [fid]: data.createdAt ?? new Date().toISOString(),
                            }));
                          } catch (generationError) {
                            console.error(generationError);
                          } finally {
                            setRemediationLoading((prev) => ({ ...prev, [fid]: false }));
                          }
                        }}
                        aria-label="Generate remediation"
                      >
                        {remediationLoading[fid] ? 'Generating...' : 'Generate Remediation'}
                      </Button>
                      {remediationTimestamp[fid] && (
                        <span className="text-xs text-muted-foreground">
                          Last: {new Date(remediationTimestamp[fid]!).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

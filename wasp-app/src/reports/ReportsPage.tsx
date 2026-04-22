import { useEffect, useState, useMemo } from "react";
import { useParams } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "../client/components/ui/card";
import { Button } from "../client/components/ui/button";
import { Input } from "../client/components/ui/input";
import { Skeleton } from "../client/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../client/components/ui/select";
import { AlertCircle, FileText, ShieldCheck } from "lucide-react";
import { useAsyncState } from "../client/hooks/useAsyncState";
import { api } from "wasp/client/api";
import { ToggleChipGroup } from "../client/components/common/ToggleChipGroup";
import { Link as ExternalLink } from "../client/components/common/VibeUI";

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
};

type ReportResponse = {
  scanId: string;
  findings: ReportFinding[];
};

type CiDecision = {
  decision: "pass" | "fail";
  reason: string;
  criticalIssues: number;
};

export default function ReportsPage() {
  const { scanId } = useParams();
  const { isLoading, error, run, setError, setIsLoading } = useAsyncState(true);
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [ciDecision, setCiDecision] = useState<CiDecision | null>(null);
  const [pdfStatus, setPdfStatus] = useState<string | null>(null);

  // UI: filters & sorting
  const [searchQuery, setSearchQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState<"all" | "critical" | "high" | "medium" | "low" | "info">("all");
  const [sortBy, setSortBy] = useState<"newest" | "severity" | "package" | "cve">("newest");
  const [remediationLoading, setRemediationLoading] = useState<Record<string, boolean>>({});
  const [remediationTimestamp, setRemediationTimestamp] = useState<Record<string, string | null>>({});

  useEffect(() => {
    if (!scanId) {
      setError("Missing scan id in route.");
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

        const [summaryData, reportData, ciData] = [summaryRes.data, reportRes.data, ciRes.data];

        setSummary(summaryData);
        setReport(reportData);
        setCiDecision(ciData);
      },
      { errorMessage: "Failed to load report data." },
    );
  }, [scanId, run, setError, setIsLoading]);

  const generatePdf = async () => {
    if (!scanId) return;
    setPdfStatus("Queueing PDF generation...");
    try {
      const res = await api.post(`/api/v1/reports/${scanId}/pdf`, { format: "full" });

      const data = res.data;
      setPdfStatus(`PDF job queued: ${data.jobId}`);
    } catch (err) {
      setPdfStatus(err instanceof Error ? err.message : "Failed to queue PDF.");
    }
  };

  const findings = report?.findings ?? [];
  const sev = summary?.severity ?? {};
  const severityChipOptions = useMemo(() => {
    const entries = [
      { value: "critical", label: "Critical", count: sev.critical ?? 0 },
      { value: "high", label: "High", count: sev.high ?? 0 },
      { value: "medium", label: "Medium", count: sev.medium ?? 0 },
      { value: "low", label: "Low", count: sev.low ?? 0 },
      { value: "info", label: "Info", count: sev.info ?? 0 },
    ];
    return [{ value: "all", label: "All", count: summary?.totalFindings ?? 0 }, ...entries];
  }, [sev.critical, sev.high, sev.info, sev.low, sev.medium, summary?.totalFindings]);

  const filteredFindings = useMemo(() => {
    const list = (findings || []).slice();
    const q = searchQuery.trim().toLowerCase();
    let res = list.filter((f) => {
      if (severityFilter !== "all" && (f.severity ?? "").toLowerCase() !== severityFilter) return false;
      if (!q) return true;
      return (f.cveId ?? f.cve ?? "").toLowerCase().includes(q) || (f.packageName ?? f.description ?? "").toLowerCase().includes(q);
    });

    if (sortBy === "severity") {
      const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4, unknown: 5 };
      res.sort((a, b) => (order[(a.severity ?? "unknown").toLowerCase()] - order[(b.severity ?? "unknown").toLowerCase()]));
    } else if (sortBy === "package") {
      res.sort((a, b) => ((a.packageName ?? "").localeCompare(b.packageName ?? "")));
    } else if (sortBy === "cve") {
      res.sort((a, b) => ((a.cveId ?? a.cve ?? "").localeCompare(b.cveId ?? b.cve ?? "")));
    }

    return res;
  }, [findings, searchQuery, severityFilter, sortBy]);

  const resolveCve = (finding: ReportFinding) => finding.cveId ?? finding.cve ?? "";

  const buildPackageLink = (finding: ReportFinding): string | null => {
    const pkg = (finding.packageName ?? "").trim();
    if (!pkg) return null;

    const ecosystem = (finding.ecosystem ?? "").toLowerCase();
    if (ecosystem === "npm") return `https://www.npmjs.com/package/${encodeURIComponent(pkg)}`;
    if (ecosystem === "pypi") return `https://pypi.org/project/${encodeURIComponent(pkg)}/`;
    if (ecosystem === "go") return `https://pkg.go.dev/${pkg}`;
    if (ecosystem === "docker") return `https://hub.docker.com/_/${encodeURIComponent(pkg)}`;
    if (ecosystem === "maven" && pkg.includes(":")) {
      const [group, artifact] = pkg.split(":");
      if (group && artifact) return `https://central.sonatype.com/artifact/${group}/${artifact}`;
    }

    if (pkg.startsWith("pkg:npm/")) return `https://www.npmjs.com/package/${encodeURIComponent(pkg.slice("pkg:npm/".length))}`;
    if (pkg.startsWith("pkg:pypi/")) return `https://pypi.org/project/${encodeURIComponent(pkg.slice("pkg:pypi/".length))}/`;
    if (pkg.startsWith("pkg:golang/")) return `https://pkg.go.dev/${pkg.slice("pkg:golang/".length)}`;
    if (pkg.startsWith("pkg:docker/")) return `https://hub.docker.com/_/${encodeURIComponent(pkg.slice("pkg:docker/".length))}`;
    return null;
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
        <Button onClick={generatePdf}>
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
            <p className="text-3xl font-bold text-foreground">{summary?.totalFindings ?? 0}</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Critical
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-red-500">{sev.critical ?? 0}</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              High
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-orange-500">{sev.high ?? 0}</p>
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
            <p className={`text-2xl font-bold ${ciDecision?.decision === "pass" ? "text-green-500" : "text-red-500"}`}>
              {(ciDecision?.decision ?? "unknown").toUpperCase()}
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
        <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Findings</CardTitle>
            <p className="text-sm text-muted-foreground">Filter, search and sort findings</p>
          </div>
          <div className="mt-3 md:mt-0 flex items-center gap-2">
            <Input
              placeholder="Search by CVE or package"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-64"
            />
            <Select value={sortBy} onValueChange={(val) => setSortBy(val as any)}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Default</SelectItem>
                <SelectItem value="severity">Severity</SelectItem>
                <SelectItem value="package">Package</SelectItem>
                <SelectItem value="cve">CVE</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => { setSearchQuery(''); setSeverityFilter('all'); setSortBy('newest'); }}>
              Clear
            </Button>
          </div>
          <div className="mt-3">
            <ToggleChipGroup
              options={severityChipOptions}
              value={severityFilter}
              onChange={(next) => setSeverityFilter(next as typeof severityFilter)}
            />
          </div>
        </CardHeader>
        <CardContent>
          {filteredFindings.length === 0 ? (
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              No findings for this scan.
            </div>
          ) : (
            <div className="space-y-2">
              {filteredFindings.map((finding, index) => {
                const fid = finding.id ?? `${finding.cveId ?? finding.cve ?? "finding"}-${index}`;
                const findingId = finding.id ?? '';
                return (
                  <div key={fid} className="rounded-md border border-border/50 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-mono text-sm text-foreground">
                        {resolveCve(finding) ? (
                          <span className="flex items-center gap-2">
                            <ExternalLink href={`https://github.com/advisories?query=${encodeURIComponent(resolveCve(finding))}`}>
                              {resolveCve(finding)}
                            </ExternalLink>
                            <ExternalLink href={`https://nvd.nist.gov/vuln/detail/${encodeURIComponent(resolveCve(finding))}`} withIcon={false} className="text-xs text-muted-foreground">
                              NVD
                            </ExternalLink>
                          </span>
                        ) : (
                          "Unknown CVE"
                        )}
                      </p>
                      <span className="text-xs px-2 py-1 rounded bg-accent/60 text-foreground">
                        {(finding.severity ?? "unknown").toUpperCase()}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {finding.packageName ? (
                        buildPackageLink(finding) ? (
                          <ExternalLink href={buildPackageLink(finding)!} className="text-sm">
                            {finding.packageName}
                          </ExternalLink>
                        ) : (
                          finding.packageName
                        )
                      ) : (
                        finding.description ?? "No details"
                      )}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <Button onClick={() => {
                        try {
                          navigator.clipboard?.writeText(`${finding.cveId ?? finding.cve ?? ''}\n${finding.packageName ?? ''}\n${finding.description ?? ''}`);
                        } catch (e) { console.error(e); }
                      }}>
                        Copy
                      </Button>
                      <Button onClick={async () => {
                        if (!scanId || !findingId) return;
                        setRemediationLoading(prev => ({...prev, [fid]: true}));
                        try {
                          const res = await api.post(`/api/v1/reports/${scanId}/findings/${findingId}/remediation`, { promptType: 'quick_fix' });
                          const data = res.data;
                          setRemediationTimestamp(prev => ({...prev, [fid]: data.createdAt ?? new Date().toISOString()}));
                        } catch (e) {
                          console.error(e);
                        } finally {
                          setRemediationLoading(prev => ({...prev, [fid]: false}));
                        }
                      }}>
                        {remediationLoading[fid] ? 'Generating...' : 'Generate Remediation'}
                      </Button>
                      {remediationTimestamp[fid] && (
                        <span className="text-xs text-muted-foreground">Last: {new Date(remediationTimestamp[fid]!).toLocaleString()}</span>
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

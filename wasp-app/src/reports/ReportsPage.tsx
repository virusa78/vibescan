import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "../client/components/ui/card";
import { Button } from "../client/components/ui/button";
import { AlertCircle, FileText, ShieldCheck } from "lucide-react";

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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [ciDecision, setCiDecision] = useState<CiDecision | null>(null);
  const [pdfStatus, setPdfStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!scanId) {
      setError("Missing scan id in route.");
      setIsLoading(false);
      return;
    }

    const run = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const [summaryRes, reportRes, ciRes] = await Promise.all([
          fetch(`/api/v1/reports/${scanId}/summary`, { credentials: "include" }),
          fetch(`/api/v1/reports/${scanId}`, { credentials: "include" }),
          fetch(`/api/v1/reports/${scanId}/ci-decision`, { credentials: "include" }),
        ]);

        if (!summaryRes.ok) {
          throw new Error(`Failed to load summary (${summaryRes.status})`);
        }
        if (!reportRes.ok) {
          throw new Error(`Failed to load report (${reportRes.status})`);
        }
        if (!ciRes.ok) {
          throw new Error(`Failed to load CI decision (${ciRes.status})`);
        }

        const [summaryData, reportData, ciData] = await Promise.all([
          summaryRes.json(),
          reportRes.json(),
          ciRes.json(),
        ]);

        setSummary(summaryData);
        setReport(reportData);
        setCiDecision(ciData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load report data.");
      } finally {
        setIsLoading(false);
      }
    };

    run();
  }, [scanId]);

  const generatePdf = async () => {
    if (!scanId) return;
    setPdfStatus("Queueing PDF generation...");
    try {
      const res = await fetch(`/api/v1/reports/${scanId}/pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ format: "full" }),
      });

      if (!res.ok) {
        throw new Error(`Failed to queue PDF (${res.status})`);
      }

      const data = await res.json();
      setPdfStatus(`PDF job queued: ${data.jobId}`);
    } catch (err) {
      setPdfStatus(err instanceof Error ? err.message : "Failed to queue PDF.");
    }
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="text-center text-muted-foreground">Loading report...</div>
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

  const findings = report?.findings ?? [];
  const sev = summary?.severity ?? {};

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
        <CardHeader>
          <CardTitle>Findings</CardTitle>
        </CardHeader>
        <CardContent>
          {findings.length === 0 ? (
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              No findings for this scan.
            </div>
          ) : (
            <div className="space-y-2">
              {findings.map((finding, index) => (
                <div
                  key={finding.id ?? `${finding.cveId ?? finding.cve ?? "finding"}-${index}`}
                  className="rounded-md border border-border/50 p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-mono text-sm text-foreground">{finding.cveId ?? finding.cve ?? "Unknown CVE"}</p>
                    <span className="text-xs px-2 py-1 rounded bg-accent/60 text-foreground">
                      {(finding.severity ?? "unknown").toUpperCase()}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {finding.packageName ?? finding.description ?? "No details"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

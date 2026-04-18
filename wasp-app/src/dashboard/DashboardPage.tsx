import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../client/components/ui/card";
import { BarChart3, Bug, TrendingUp, Zap } from "lucide-react";

function getStatusBadge(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === "error") return { color: "text-red-500", bg: "bg-red-500/10", border: "border-red-500/30" };
  if (normalized === "done") return { color: "text-green-500", bg: "bg-green-500/10", border: "border-green-500/30" };
  if (normalized === "scanning") return { color: "text-blue-500", bg: "bg-blue-500/10", border: "border-blue-500/30" };
  return { color: "text-yellow-500", bg: "bg-yellow-500/10", border: "border-yellow-500/30" };
}

export default function DashboardPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<{
    total_scans: number;
    total_vulnerabilities: number;
    avg_severity: string | null;
  } | null>(null);
  const [quota, setQuota] = useState<{
    used: number;
    limit: number;
    percentage: number;
    monthly_reset_date: string;
  } | null>(null);
  const [severity, setSeverity] = useState<{
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
    total: number;
  } | null>(null);
  const [recentScans, setRecentScans] = useState<
    Array<{
      id: string;
      status: string;
      inputType: string;
      inputRef: string;
      created_at: string;
      vulnerability_count: number;
    }>
  >([]);

  useEffect(() => {
    const run = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const [metricsRes, quotaRes, severityRes, recentRes] = await Promise.all([
          fetch("/api/v1/dashboard/metrics", { credentials: "include" }),
          fetch("/api/v1/dashboard/quota", { credentials: "include" }),
          fetch("/api/v1/dashboard/severity-breakdown", { credentials: "include" }),
          fetch("/api/v1/dashboard/recent-scans?limit=10", { credentials: "include" }),
        ]);

        if (!metricsRes.ok || !quotaRes.ok || !severityRes.ok || !recentRes.ok) {
          throw new Error("Failed to load dashboard data.");
        }

        const [metricsData, quotaData, severityData, recentData] = await Promise.all([
          metricsRes.json(),
          quotaRes.json(),
          severityRes.json(),
          recentRes.json(),
        ]);

        setMetrics(metricsData);
        setQuota(quotaData);
        setSeverity(severityData);
        setRecentScans(recentData.scans ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load dashboard.");
      } finally {
        setIsLoading(false);
      }
    };

    run();
  }, []);

  const runningScans = useMemo(
    () =>
      recentScans.filter((scan) =>
        ["pending", "scanning", "running"].includes(scan.status.toLowerCase()),
      ).length,
    [recentScans],
  );

  const statCards = [
    {
      label: "TOTAL SCANS",
      value: metrics?.total_scans ?? 0,
      subtext: "All time",
      icon: <BarChart3 className="text-primary" size={24} />,
    },
    {
      label: "VULNERABILITIES",
      value: metrics?.total_vulnerabilities ?? 0,
      subtext: `Avg severity: ${metrics?.avg_severity ?? "N/A"}`,
      icon: <Bug className="text-red-500" size={24} />,
    },
    {
      label: "ACTIVE FINDINGS",
      value: severity?.total ?? 0,
      subtext: `Critical: ${severity?.critical ?? 0}`,
      icon: <TrendingUp className="text-primary" size={24} />,
    },
    {
      label: "ACTIVE SCANS",
      value: runningScans,
      subtext: "Recent running/pending",
      icon: <Zap className="text-yellow-500" size={24} />,
    },
  ];

  return (
    <div className="p-8 lg:p-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-foreground text-4xl font-bold tracking-tight mb-2">
          Dashboard
        </h1>
        <p className="text-muted-foreground">
          Monitor your vulnerability scans and security metrics
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((stat) => (
          <Card key={stat.label} className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {stat.label}
                </CardTitle>
                {stat.icon}
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-foreground">{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{stat.subtext}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts & Info Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <Card className="lg:col-span-2 border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle>Vulnerability Trend</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Current severity distribution</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3">
                <p className="text-xs text-muted-foreground">CRITICAL</p>
                <p className="text-xl font-bold text-red-500">{severity?.critical ?? 0}</p>
              </div>
              <div className="rounded-md border border-orange-500/30 bg-orange-500/10 p-3">
                <p className="text-xs text-muted-foreground">HIGH</p>
                <p className="text-xl font-bold text-orange-500">{severity?.high ?? 0}</p>
              </div>
              <div className="rounded-md border border-yellow-500/30 bg-yellow-500/10 p-3">
                <p className="text-xs text-muted-foreground">MEDIUM</p>
                <p className="text-xl font-bold text-yellow-500">{severity?.medium ?? 0}</p>
              </div>
              <div className="rounded-md border border-green-500/30 bg-green-500/10 p-3">
                <p className="text-xs text-muted-foreground">LOW</p>
                <p className="text-xl font-bold text-green-500">{severity?.low ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-sm">Quota Usage</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="flex justify-between text-xs mb-2">
                  <span className="text-foreground">
                    {quota?.used ?? 0} / {quota?.limit ?? 0} scans
                  </span>
                  <span className="text-primary">
                    {Math.max((quota?.limit ?? 0) - (quota?.used ?? 0), 0)} left
                  </span>
                </div>
                <div className="w-full bg-border/30 rounded-full h-2">
                  <div className="bg-primary rounded-full h-2" style={{ width: `${Math.min(quota?.percentage ?? 0, 100)}%` }}></div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Resets {quota?.monthly_reset_date ? new Date(quota.monthly_reset_date).toLocaleDateString() : "—"}
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-sm">Delta Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-primary mb-3">{severity?.total ?? 0}</p>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs">
                  <span className="px-2 py-1 border border-red-500/50 text-red-500 rounded">CRITICAL: {severity?.critical ?? 0}</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="px-2 py-1 border border-yellow-500/50 text-yellow-500 rounded">HIGH: {severity?.high ?? 0}</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="px-2 py-1 border border-orange-500/50 text-orange-500 rounded">MEDIUM: {severity?.medium ?? 0}</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="px-2 py-1 border border-green-500/50 text-green-500 rounded">LOW: {severity?.low ?? 0}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recent Scans Table */}
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle>Recent Scans</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">Latest vulnerability scan results</p>
        </CardHeader>
        <CardContent>
          {isLoading && <p className="text-muted-foreground">Loading scans...</p>}
          {!isLoading && recentScans.length === 0 && (
            <p className="text-muted-foreground">No scans yet.</p>
          )}
          {recentScans.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/30">
                    <th className="text-left py-3 px-4 text-muted-foreground font-medium">PROJECT</th>
                    <th className="text-left py-3 px-4 text-muted-foreground font-medium">TYPE</th>
                    <th className="text-left py-3 px-4 text-muted-foreground font-medium">STATUS</th>
                    <th className="text-left py-3 px-4 text-muted-foreground font-medium">SEVERITY</th>
                    <th className="text-left py-3 px-4 text-muted-foreground font-medium">DELTA</th>
                    <th className="text-left py-3 px-4 text-muted-foreground font-medium">DATE</th>
                  </tr>
                </thead>
                <tbody>
                  {recentScans.map((scan) => {
                    const statusBadge = getStatusBadge(scan.status);
                    return (
                      <tr key={scan.id} className="border-b border-border/20 hover:bg-accent/5 transition-colors">
                        <td className="py-3 px-4 text-foreground font-medium">{scan.inputRef || "Unknown scan"}</td>
                        <td className="py-3 px-4">
                          <span className="text-xs px-2 py-1 border border-primary/50 text-primary rounded">
                            {scan.inputType || "unknown"}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`text-xs px-2 py-1 border rounded ${statusBadge.color} ${statusBadge.border}`}>
                            {scan.status}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-muted-foreground">{scan.vulnerability_count}</span>
                        </td>
                        <td className="py-3 px-4 text-primary font-medium">—</td>
                        <td className="py-3 px-4 text-muted-foreground">
                          {new Date(scan.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

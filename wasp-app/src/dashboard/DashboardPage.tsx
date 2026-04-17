import { Link as WaspRouterLink, routes } from "wasp/client/router";
import { getScans, useQuery } from "wasp/client/operations";
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
  const { data: scans, isLoading } = useQuery(getScans);
  const recentScans = scans ?? [];
  const totalScans = recentScans.length;
  const queuedScans = recentScans.filter((scan) => scan.status === "pending").length;
  const runningScans = recentScans.filter((scan) => scan.status === "scanning").length;
  const failedScans = recentScans.filter((scan) => scan.status === "error").length;

  const statCards = [
    { label: "TOTAL SCANS", value: totalScans, subtext: "12 this week", icon: <BarChart3 className="text-primary" size={24} /> },
    { label: "VULNERABILITIES", value: 156, subtext: "12 critical", icon: <Bug className="text-red-500" size={24} /> },
    { label: "DELTA FOUND", value: 48, subtext: "Enterprise-only CVEs", icon: <TrendingUp className="text-primary" size={24} /> },
    { label: "ACTIVE SCANS", value: runningScans, subtext: "2m 15s avg", icon: <Zap className="text-yellow-500" size={24} /> },
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
            <p className="text-xs text-muted-foreground mt-1">Last 7 days severity distribution</p>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center text-muted-foreground">
              [Chart Area - Would contain line chart]
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
                  <span className="text-foreground">67 / 200 scans</span>
                  <span className="text-primary">133 left</span>
                </div>
                <div className="w-full bg-border/30 rounded-full h-2">
                  <div className="bg-primary rounded-full h-2" style={{ width: "33.5%" }}></div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Resets 2/1/2026</p>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-sm">Delta Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-primary mb-3">8</p>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs">
                  <span className="px-2 py-1 border border-red-500/50 text-red-500 rounded">CRITICAL: 2</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="px-2 py-1 border border-yellow-500/50 text-yellow-500 rounded">HIGH: 2</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="px-2 py-1 border border-orange-500/50 text-orange-500 rounded">MEDIUM: 2</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="px-2 py-1 border border-green-500/50 text-green-500 rounded">LOW: 2</span>
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
                            source_zip
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`text-xs px-2 py-1 border rounded ${statusBadge.color} ${statusBadge.border}`}>
                            {scan.status}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex gap-1">
                            <div className="w-2 h-2 rounded-full bg-red-500"></div>
                            <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                            <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                            <div className="w-2 h-2 rounded-full bg-green-500"></div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-primary font-medium">8</td>
                        <td className="py-3 px-4 text-muted-foreground">
                          {new Date(scan.createdAt).toLocaleDateString()}
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

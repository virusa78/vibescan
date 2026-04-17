import { getScans, useQuery } from "wasp/client/operations";
import { Card, CardContent, CardHeader, CardTitle } from "../client/components/ui/card";
import { TrendingDown, TrendingUp, BarChart3, AlertCircle } from "lucide-react";

export default function ReportsPage() {
  const { data: scans, isLoading } = useQuery(getScans);
  const recentScans = scans ?? [];

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="text-center text-muted-foreground">Loading reports...</div>
      </div>
    );
  }

  return (
    <div className="p-8 lg:p-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-foreground text-4xl font-bold tracking-tight mb-2">
          Reports
        </h1>
        <p className="text-muted-foreground">
          View and manage vulnerability scan reports
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              Total Scans
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">{recentScans.length}</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-red-500" />
              Critical Issues
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-red-500">—</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-yellow-500" />
              Pending
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-yellow-500">{recentScans.filter(s => s.status === 'pending').length}</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-green-500" />
              Completed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-500">{recentScans.filter(s => s.status === 'done').length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Scans */}
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle>Recent Scans</CardTitle>
        </CardHeader>
        <CardContent>
          {recentScans.length === 0 ? (
            <p className="text-muted-foreground text-sm">No scans yet. Create your first scan to get started.</p>
          ) : (
            <div className="space-y-2">
              {recentScans.slice(0, 5).map((scan) => (
                <div key={scan.id} className="flex items-center justify-between p-3 border border-border/50 rounded-lg hover:bg-accent/50 transition-colors">
                  <div className="flex-1">
                    <p className="font-mono text-sm text-foreground">{scan.id.substring(0, 12)}...</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(scan.createdAt).toLocaleDateString()} • {scan.inputType}
                    </p>
                  </div>
                  <div className={`px-3 py-1 rounded-md text-xs font-semibold ${
                    scan.status === 'done' ? 'bg-green-500/20 text-green-600' :
                    scan.status === 'error' ? 'bg-red-500/20 text-red-600' :
                    'bg-blue-500/20 text-blue-600'
                  }`}>
                    {scan.status?.toUpperCase()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* API Docs */}
      <Card className="mt-8 border-dashed border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-sm">API Documentation</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>Get detailed report for a scan:</p>
          <code className="block bg-background/50 p-2 rounded text-xs">GET /api/v1/reports/:scanId</code>
          <p className="mt-4">Generate PDF report:</p>
          <code className="block bg-background/50 p-2 rounded text-xs">POST /api/v1/reports/:scanId/pdf</code>
        </CardContent>
      </Card>
    </div>
  );
}

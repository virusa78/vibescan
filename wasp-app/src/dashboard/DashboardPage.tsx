import { Link as WaspRouterLink, routes } from "wasp/client/router";
import { getScans, useQuery } from "wasp/client/operations";
import { Button } from "../client/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../client/components/ui/card";

function getStatusClass(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === "error") return "bg-red-500/10 text-red-500 border-red-500/30";
  if (normalized === "done") {
    return "bg-green-500/10 text-green-500 border-green-500/30";
  }
  if (normalized === "scanning") {
    return "bg-blue-500/10 text-blue-500 border-blue-500/30";
  }
  return "bg-yellow-500/10 text-yellow-500 border-yellow-500/30";
}

export default function DashboardPage() {
  const { data: scans, isLoading } = useQuery(getScans);
  const recentScans = scans ?? [];
  const totalScans = recentScans.length;
  const queuedScans = recentScans.filter((scan) => scan.status === "pending").length;
  const runningScans = recentScans.filter((scan) =>
    scan.status === "scanning",
  ).length;
  const failedScans = recentScans.filter((scan) => scan.status === "error").length;

  return (
    <div className="py-10 lg:mt-10">
      <div className="mx-auto max-w-5xl px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-foreground text-3xl font-bold tracking-tight sm:text-4xl">
            Scan Dashboard
          </h1>
          <p className="text-muted-foreground mt-2">
            Run new scans and review recent scan activity.
          </p>
        </div>

        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card className="from-card/95 to-card/75 border-border/70 bg-gradient-to-b backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-sm">Total Scans</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{totalScans}</p>
            </CardContent>
          </Card>
          <Card className="from-card/95 to-card/75 border-border/70 bg-gradient-to-b backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-sm">Queued</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{queuedScans}</p>
            </CardContent>
          </Card>
          <Card className="from-card/95 to-card/75 border-border/70 bg-gradient-to-b backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-sm">Running</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{runningScans}</p>
            </CardContent>
          </Card>
          <Card className="from-card/95 to-card/75 border-border/70 bg-gradient-to-b backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-sm">Failed</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{failedScans}</p>
            </CardContent>
          </Card>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card className="from-card/95 to-card/75 border-border/70 bg-gradient-to-b backdrop-blur-sm">
            <CardHeader>
              <CardTitle>New Scan</CardTitle>
            </CardHeader>
            <CardContent>
              <WaspRouterLink to={routes.NewScanRoute.to}>
                <Button>Create scan</Button>
              </WaspRouterLink>
            </CardContent>
          </Card>
          <Card className="from-card/95 to-card/75 border-border/70 bg-gradient-to-b backdrop-blur-sm">
            <CardHeader>
              <CardTitle>Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <WaspRouterLink to={routes.SettingsRoute.to}>
                <Button variant="outline">Open settings</Button>
              </WaspRouterLink>
            </CardContent>
          </Card>
          <Card className="from-card/95 to-card/75 border-border/70 bg-gradient-to-b backdrop-blur-sm">
            <CardHeader>
              <CardTitle>Billing & Plan</CardTitle>
            </CardHeader>
            <CardContent>
              <WaspRouterLink to={routes.AccountRoute.to}>
                <Button variant="outline">Open account</Button>
              </WaspRouterLink>
            </CardContent>
          </Card>
        </div>

        <Card className="from-card/95 to-card/75 border-border/70 bg-gradient-to-b backdrop-blur-sm">
          <CardHeader>
            <CardTitle>Recent Scans</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading && <p className="text-muted-foreground">Loading scans...</p>}
            {!isLoading && recentScans.length === 0 && (
              <p className="text-muted-foreground">No scans yet.</p>
            )}
            <div className="space-y-3">
              {recentScans.map((scan) => (
                <div
                  key={scan.id}
                  className="border-border flex items-center justify-between rounded-md border p-3"
                >
                  <div>
                    <WaspRouterLink
                      to={routes.ScanDetailsRoute.to}
                      params={{ scanId: scan.id }}
                      className="font-medium hover:underline"
                    >
                      {scan.inputRef || "Unknown scan"}
                    </WaspRouterLink>
                    <p className="text-muted-foreground text-sm">
                      {new Date(scan.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <span
                    className={`rounded-md border px-2 py-1 text-xs ${getStatusClass(scan.status)}`}
                  >
                    {scan.status}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

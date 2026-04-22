import { useParams } from "react-router";
import { getScanById, useQuery } from "wasp/client/operations";
import { Link as WaspRouterLink, routes } from "wasp/client/router";
import { Alert, AlertDescription } from "../client/components/ui/alert";
import { Button } from "../client/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../client/components/ui/card";
import { Skeleton } from "../client/components/ui/skeleton";
import { getScanTypeDisplay } from "../client/utils/severity";

function getStatusClass(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === "failed") return "bg-red-500/10 text-red-500 border-red-500/30";
  if (normalized === "completed" || normalized === "done") {
    return "bg-green-500/10 text-green-500 border-green-500/30";
  }
  if (normalized === "running" || normalized === "processing") {
    return "bg-blue-500/10 text-blue-500 border-blue-500/30";
  }
  return "bg-yellow-500/10 text-yellow-500 border-yellow-500/30";
}

export default function ScanDetailsPage() {
  const { scanId } = useParams();
  const scanQuery = useQuery(
    getScanById,
    { scanId: scanId ?? "" },
    {
      enabled: !!scanId,
      refetchInterval: 3000,
    },
  );

  if (scanQuery.isLoading) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-10 space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-9 w-44" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-72" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-8 w-40" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (scanQuery.error) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <Alert variant="destructive">
          <AlertDescription>
            {scanQuery.error instanceof Error
              ? scanQuery.error.message
              : "Failed to load scan details."}
          </AlertDescription>
        </Alert>
        <div className="mt-4">
          <WaspRouterLink to={routes.NewScanRoute.to}>
            <Button variant="outline">Back to scans</Button>
          </WaspRouterLink>
        </div>
      </div>
    );
  }

  const scan = scanQuery.data;
  if (!scan) {
    return (
      <div className="p-8 text-sm text-muted-foreground">
        Scan not found. It may have been removed.
      </div>
    );
  }

  const scanResults = Array.isArray((scan as any).scanResults) ? (scan as any).scanResults : [];
  const scanDeltas = Array.isArray((scan as any).scanDeltas) ? (scan as any).scanDeltas : [];
  const latestDelta = scanDeltas[0];

  return (
    <div className="py-10 lg:mt-10">
      <div className="mx-auto max-w-4xl px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-foreground text-3xl font-bold">Scan Details</h1>
            <p className="text-muted-foreground mt-2 text-sm">Track progress and metadata.</p>
          </div>
          <WaspRouterLink to={routes.NewScanRoute.to}>
            <Button variant="outline">New Scan</Button>
          </WaspRouterLink>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              {scan.inputRef || "Scan " + scan.id}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-muted-foreground text-sm">Status:</span>
              <span
                className={`rounded-md border px-2 py-1 text-xs ${getStatusClass(scan.status)}`}
              >
                {scan.status}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <p className="text-muted-foreground text-xs">Scan ID</p>
                <p className="break-all text-sm">{scan.id}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Input Type</p>
                <p className="text-sm">{getScanTypeDisplay(scan.inputType)}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Created At</p>
                <p className="text-sm">{new Date(scan.createdAt).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Completed At</p>
                <p className="text-sm">
                  {scan.completedAt ? new Date(scan.completedAt).toLocaleString() : "Not finished"}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-border/60 bg-muted/20 p-4" data-testid="scanner-summary">
                <p className="text-muted-foreground text-xs uppercase tracking-wide">Scanner results</p>
                <div className="mt-2 space-y-2">
                  {scanResults.length === 0 ? (
                    <p className="text-sm">No scanner results yet.</p>
                  ) : (
                    scanResults.map((result: any) => (
                      <div key={result.id} className="flex items-center justify-between gap-3 text-sm">
                        <span className="font-medium capitalize">{result.source}</span>
                        <span className="text-muted-foreground">{result.scannerVersion}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-border/60 bg-muted/20 p-4" data-testid="delta-summary">
                <p className="text-muted-foreground text-xs uppercase tracking-wide">Delta / dedup</p>
                {latestDelta ? (
                  <div className="mt-2 space-y-1 text-sm">
                    <div className="flex items-center justify-between"><span>Free</span><span>{latestDelta.totalFreeCount}</span></div>
                    <div className="flex items-center justify-between"><span>Enterprise</span><span>{latestDelta.totalEnterpriseCount}</span></div>
                    <div className="flex items-center justify-between"><span>Delta</span><span>{latestDelta.deltaCount}</span></div>
                  </div>
                ) : (
                  <p className="mt-2 text-sm">No delta recorded yet.</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

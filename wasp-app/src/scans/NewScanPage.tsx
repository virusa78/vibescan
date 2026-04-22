import { FormEvent, useMemo, useState } from "react";
import { submitScan, getScans, useQuery } from "wasp/client/operations";
import { Alert, AlertDescription } from "../client/components/ui/alert";
import { Button } from "../client/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../client/components/ui/card";
import { Input } from "../client/components/ui/input";
import { Label } from "../client/components/ui/label";
import { Skeleton } from "../client/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../client/components/ui/select";
import { Link as WaspRouterLink, routes } from "wasp/client/router";
import { useAsyncState } from "../client/hooks/useAsyncState";

export default function NewScanPage() {
  const [inputRef, setInputRef] = useState("");
  const [inputType, setInputType] = useState<"github" | "sbom" | "source_zip">("github");
  const { isLoading: isSubmitting, error, run } = useAsyncState();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [createdScanId, setCreatedScanId] = useState<string | null>(null);
  const {
    data: recentScans,
    isLoading: isRecentLoading,
    error: recentError,
    refetch,
  } = useQuery(getScans);
  const normalizedScans = useMemo(() => recentScans ?? [], [recentScans]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSuccessMessage(null);
    setCreatedScanId(null);
    await run(
      async () => {
        const normalized = inputRef.trim();

        const createdScan = await submitScan({
          inputRef: normalized,
          inputType,
        });

        setSuccessMessage("Scan job created.");
        setCreatedScanId(createdScan.id);
        setInputRef("");
        await refetch();
      },
      { errorMessage: "Failed to submit scan." },
    );
  };

  return (
    <div className="py-10 lg:mt-10">
      <div className="mx-auto max-w-5xl px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-foreground mt-2 text-4xl font-bold tracking-tight sm:text-5xl">
            New <span className="text-primary">Scan</span>
          </h2>
          <p className="text-muted-foreground mt-4">
            Submit a scan for vulnerability analysis.
          </p>
        </div>

        <Card className="border-border/70 mt-8 bg-card/90 shadow-sm">
          <CardHeader>
            <CardTitle>Scan Input</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {successMessage && (
              <Alert>
                <AlertDescription className="flex flex-wrap items-center gap-2">
                  <span>{successMessage}</span>
                  {createdScanId && (
                    <WaspRouterLink
                      to={routes.ScanDetailsRoute.to}
                      params={{ scanId: createdScanId }}
                      className="text-primary underline underline-offset-2"
                    >
                      Open details
                    </WaspRouterLink>
                  )}
                </AlertDescription>
              </Alert>
            )}
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="inputRef">Input Reference</Label>
                <Input
                  id="inputRef"
                  value={inputRef}
                  onChange={(e) => setInputRef(e.target.value)}
                  placeholder="e.g., owner/repo or path/to/sbom.json"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="inputType">Input Type</Label>
                <Select
                  value={inputType}
                  onValueChange={(value) =>
                    setInputType(value as "github" | "sbom" | "source_zip")
                  }
                >
                  <SelectTrigger id="inputType" className="w-full">
                    <SelectValue placeholder="Select input type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="github">GitHub Repository</SelectItem>
                    <SelectItem value="sbom">SBOM File</SelectItem>
                    <SelectItem value="source_zip">Source ZIP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Submitting..." : "Start scan"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-border/70 mt-8 bg-card/90 shadow-sm">
          <CardHeader>
            <CardTitle>Recent Scans</CardTitle>
          </CardHeader>
          <CardContent>
            {isRecentLoading && (
              <div className="space-y-3">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            )}
            {recentError && !isRecentLoading && (
              <Alert variant="destructive">
                <AlertDescription>
                  {recentError instanceof Error
                    ? recentError.message
                    : "Failed to load recent scans."}
                </AlertDescription>
              </Alert>
            )}
            {!isRecentLoading && !recentError && normalizedScans.length === 0 && (
              <div className="text-muted-foreground text-sm">
                Scans will appear here once submitted.
              </div>
            )}
            {!isRecentLoading && !recentError && normalizedScans.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-border/60 border-b text-left">
                      <th className="py-2 pr-4 font-medium">Input</th>
                      <th className="py-2 pr-4 font-medium">Type</th>
                      <th className="py-2 pr-4 font-medium">Status</th>
                      <th className="py-2 pr-4 font-medium">Created</th>
                      <th className="py-2 text-right font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {normalizedScans.map((scan) => (
                      <tr key={scan.id} className="border-border/50 border-b">
                        <td className="py-3 pr-4">
                          <div className="text-foreground font-medium">
                            {scan.inputRef || scan.id}
                          </div>
                          <div className="text-muted-foreground text-xs">
                            {scan.id}
                          </div>
                        </td>
                        <td className="py-3 pr-4 capitalize">{scan.inputType}</td>
                        <td className="py-3 pr-4">
                          <span className="rounded-full border px-2 py-1 text-xs capitalize">
                            {scan.status}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground">
                          {new Date(scan.createdAt).toLocaleString()}
                        </td>
                        <td className="py-3 text-right">
                          <WaspRouterLink
                            to={routes.ScanDetailsRoute.to}
                            params={{ scanId: scan.id }}
                            className="text-primary text-xs font-medium underline underline-offset-2"
                          >
                            View details
                          </WaspRouterLink>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

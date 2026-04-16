import { FormEvent, useEffect, useMemo, useState } from "react";
import { getScans, useQuery } from "wasp/client/operations";
import { Alert, AlertDescription } from "../client/components/ui/alert";
import { Button } from "../client/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../client/components/ui/card";
import { Input } from "../client/components/ui/input";
import { Label } from "../client/components/ui/label";
import { submitScan } from "wasp/client/operations";
import { getUserSettings } from "wasp/client/operations";
import { Link as WaspRouterLink, routes } from "wasp/client/router";
import { settingsApi } from "../user/settingsApi";

export default function NewScanPage() {
  const [githubRepo, setGithubRepo] = useState("");
  const [githubRef, setGithubRef] = useState("main");
  const [githubToken, setGithubToken] = useState("");
  const [isPrivateRepo, setIsPrivateRepo] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [createdScanId, setCreatedScanId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { data: scans, refetch, isLoading } = useQuery(getScans);
  const { data: settings } = useQuery(getUserSettings);

  const scanRows = useMemo(() => scans ?? [], [scans]);

  useEffect(() => {
    if (!settings) return;

    if (!githubRepo && settings.defaultRepo) {
      setGithubRepo(settings.defaultRepo);
    }
    if (githubRef === "main" && settings.defaultBranch) {
      setGithubRef(settings.defaultBranch);
    }
    if (!githubToken && settings.githubToken) {
      setGithubToken(settings.githubToken);
      setIsPrivateRepo(true);
    }
  }, [settings, githubRepo, githubRef, githubToken]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setCreatedScanId(null);
    setIsSubmitting(true);

    try {
      const normalizedRepo = githubRepo.trim();
      if (!normalizedRepo.includes("/") || normalizedRepo.split("/").length !== 2) {
        throw new Error("Repository must be in owner/name format.");
      }

      const settings = await settingsApi.get();
      const token = githubToken || settings?.githubToken || "";

      const createdScan = await submitScan({
        githubRepo: normalizedRepo,
        githubRef: githubRef.trim() || "main",
        githubToken: token,
        isPrivateRepo,
      });

      setSuccessMessage("Scan job created.");
      setCreatedScanId(createdScan.id);
      setGithubRepo("");
      setGithubToken("");
      await refetch();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to submit scan.";
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="py-10 lg:mt-10">
      <div className="mx-auto max-w-5xl px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-foreground mt-2 text-4xl font-bold tracking-tight sm:text-5xl">
            New <span className="text-primary">Scan</span>
          </h2>
          <p className="text-muted-foreground mt-4">
            Submit a GitHub repository and branch. For private repos, token is required.
          </p>
        </div>

        <Card className="from-card/95 to-card/75 border-border/70 mt-8 bg-gradient-to-b backdrop-blur-sm">
          <CardHeader>
            <CardTitle>GitHub Scan Input</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {errorMessage && (
              <Alert variant="destructive">
                <AlertDescription>{errorMessage}</AlertDescription>
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
                <Label htmlFor="githubRepo">Repository (owner/name)</Label>
                <Input
                  id="githubRepo"
                  value={githubRepo}
                  onChange={(e) => setGithubRepo(e.target.value)}
                  placeholder="anchore/grype"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="githubRef">Branch / Ref</Label>
                <Input
                  id="githubRef"
                  value={githubRef}
                  onChange={(e) => setGithubRef(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="githubToken">Token override (optional)</Label>
                <Input
                  id="githubToken"
                  type="password"
                  value={githubToken}
                  onChange={(e) => setGithubToken(e.target.value)}
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isPrivateRepo}
                  onChange={(e) => setIsPrivateRepo(e.target.checked)}
                />
                Private repository
              </label>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Submitting..." : "Start scan"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="from-card/95 to-card/75 border-border/70 mt-8 bg-gradient-to-b backdrop-blur-sm">
          <CardHeader>
            <CardTitle>Recent Scans</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading && <p className="text-muted-foreground">Loading scans...</p>}
            {!isLoading && scanRows.length === 0 && (
              <p className="text-muted-foreground">No scans yet.</p>
            )}
            <div className="space-y-3">
              {scanRows.map((scan) => (
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
                      {scan.githubRepo || "Unknown repo"}
                    </WaspRouterLink>
                    <p className="text-muted-foreground text-sm">
                      {scan.githubRef || "main"} • {new Date(scan.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <span className="border-border bg-muted rounded-md border px-2 py-1 text-xs">
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

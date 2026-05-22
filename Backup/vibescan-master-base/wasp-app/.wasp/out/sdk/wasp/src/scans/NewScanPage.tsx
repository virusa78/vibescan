import { FormEvent, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { ArrowRight, Github, Package, UploadCloud } from "lucide-react";
import { submitScan, getScans, useQuery } from "wasp/client/operations";
import { Alert, AlertDescription } from "../client/components/ui/alert";
import { Button } from "../client/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../client/components/ui/card";
import { Input } from "../client/components/ui/input";
import { Label } from "../client/components/ui/label";
import { Skeleton } from "../client/components/ui/skeleton";
import { Link as WaspRouterLink, routes } from "wasp/client/router";
import { useAsyncState } from "../client/hooks/useAsyncState";

type ScanInputType = "github" | "sbom" | "source_zip";

const inputTypeOptions: Array<{
  value: ScanInputType;
  title: string;
  description: string;
  placeholder: string;
  hint: string;
  icon: typeof Github;
}> = [
  {
    value: "github",
    title: "GitHub repository",
    description: "Paste a repository URL to clone and scan a live codebase quickly.",
    placeholder: "https://github.com/owner/repository",
    hint: "Best default path for most users. Use a full repository URL.",
    icon: Github,
  },
  {
    value: "sbom",
    title: "SBOM file",
    description: "Use a prepared CycloneDX or similar dependency manifest.",
    placeholder: "/path/to/bom.json",
    hint: "Best when CI already produces an SBOM and you want fast dependency analysis.",
    icon: Package,
  },
  {
    value: "source_zip",
    title: "Source ZIP",
    description: "Reference a source archive when GitHub access is not available.",
    placeholder: "/path/to/project.zip",
    hint: "Best for offline packages, ad-hoc snapshots, or vendor source drops.",
    icon: UploadCloud,
  },
];

export default function NewScanPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const source = queryParams.get("source");
  const requestedType = queryParams.get("type");
  const [inputRef, setInputRef] = useState("");
  const [inputType, setInputType] = useState<ScanInputType>("github");
  const { isLoading: isSubmitting, error, run } = useAsyncState();
  const {
    data: recentScans,
    isLoading: isRecentLoading,
    error: recentError,
    refetch,
  } = useQuery(getScans);
  const normalizedScans = useMemo(() => recentScans ?? [], [recentScans]);
  const activeType = useMemo(
    () => inputTypeOptions.find((option) => option.value === inputType) ?? inputTypeOptions[0],
    [inputType],
  );

  useEffect(() => {
    if (requestedType === "github" || requestedType === "sbom" || requestedType === "source_zip") {
      setInputType(requestedType);
    }
  }, [requestedType]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await run(
      async () => {
        const normalized = inputRef.trim();

        const createdScan = await submitScan({
          inputRef: normalized,
          inputType,
        });

        setInputRef("");
        await refetch();
        navigate(routes.ScanDetailsRoute.build({ scanId: createdScan.id } as any));
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
            Choose the input you already have and queue the fastest useful scan for this workspace.
          </p>
        </div>

        {source === "onboarding" && (
          <Alert className="mt-8">
            <AlertDescription>
              You came here from guided setup. Pick your input type, submit the scan, and you will land on scan details immediately.
            </AlertDescription>
          </Alert>
        )}

        <Card className="border-border/70 mt-8 bg-card/90 shadow-sm">
          <CardHeader>
            <CardTitle>Choose your input type</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 lg:grid-cols-3">
              {inputTypeOptions.map((option) => {
                const Icon = option.icon;
                const isActive = option.value === inputType;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setInputType(option.value)}
                    className={`rounded-xl border p-4 text-left transition ${
                      isActive
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border/70 bg-background hover:border-primary/40 hover:bg-accent/40"
                    }`}
                  >
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="text-foreground font-medium">{option.title}</div>
                    <div className="text-muted-foreground mt-2 text-sm">
                      {option.description}
                    </div>
                  </button>
                );
              })}
            </div>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="rounded-lg border border-border/60 bg-background/80 p-4">
                <div className="text-sm font-medium text-foreground">
                  {activeType.title}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {activeType.hint}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="inputRef">Input Reference</Label>
                <Input
                  id="inputRef"
                  value={inputRef}
                  onChange={(e) => setInputRef(e.target.value)}
                  placeholder={activeType.placeholder}
                />
                <p className="text-xs text-muted-foreground">
                  Use the exact repository URL or file reference your environment understands. We keep the field flexible so you can move fast.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button type="submit" disabled={isSubmitting || inputRef.trim().length === 0}>
                  {isSubmitting ? "Submitting..." : "Start scan"}
                  {!isSubmitting && <ArrowRight className="ml-2 h-4 w-4" />}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate(routes.OnboardingRoute.to)}
                >
                  Open guided setup
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="border-border/70 mt-8 bg-card/90 shadow-sm">
          <CardHeader>
            <CardTitle>Quick guidance</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-border/60 p-4">
              <div className="text-sm font-medium text-foreground">GitHub</div>
              <p className="mt-2 text-sm text-muted-foreground">
                Best default if the code already lives in GitHub and you want the shortest path to value.
              </p>
            </div>
            <div className="rounded-lg border border-border/60 p-4">
              <div className="text-sm font-medium text-foreground">SBOM</div>
              <p className="mt-2 text-sm text-muted-foreground">
                Best when CI already emits dependency manifests and you want a package-focused scan.
              </p>
            </div>
            <div className="rounded-lg border border-border/60 p-4">
              <div className="text-sm font-medium text-foreground">ZIP</div>
              <p className="mt-2 text-sm text-muted-foreground">
                Best when GitHub access is unavailable and you only have a packaged source snapshot.
              </p>
            </div>
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
                Your workspace has no scans yet. The first one will appear here immediately after submission.
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

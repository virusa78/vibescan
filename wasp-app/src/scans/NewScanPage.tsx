import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { ArrowRight, Github, Package, UploadCloud } from "lucide-react";
import { submitScan, getScans, getScannerAccessSettings, useQuery } from "wasp/client/operations";
import { Alert, AlertDescription } from "../client/components/ui/alert";
import { Button } from "../client/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../client/components/ui/card";
import { Input } from "../client/components/ui/input";
import { Label } from "../client/components/ui/label";
import { Skeleton } from "../client/components/ui/skeleton";
import { Link as WaspRouterLink, routes } from "wasp/client/router";
import { useAsyncState } from "../client/hooks/useAsyncState";
import { ScannerLineupCard } from "../client/components/common/ScannerLineupCard";
import { getPlannedScannerSources, getScannerLineupEntry, type ScannerAccessPreview, type ScannerSource } from "../client/utils/scannerLineup";
import { getScannerBadgeClass, getScannerFullName, getScannerLetter, STRIPE_THICKNESS_CLASS } from "../client/utils/scannerColors";
import { developerSecurityTitle, scanInputTypeLabels } from "../client/utils/productVocabulary";

type ScanInputType = "github" | "sbom" | "source_zip";

type ScannerChoice = {
  source: ScannerSource;
  label: string;
  description: string;
  selectable: boolean;
  selected_by_default: boolean;
  status: "available" | "cooling_down" | "unavailable";
  disabled_reason: string | null;
  cooldown_reset_at: string | null;
  usage?: {
    used: number;
    limit: number;
    remaining: number;
    reset_at: string | null;
  };
};

type ScannerAccessResponse = ScannerAccessPreview & {
  snyk_enabled: boolean;
  snyk_api_key_attached: boolean;
  snyk_api_key_preview: string | null;
  snyk_ready: boolean;
  snyk_ready_reason: string | null;
  snyk_credential_source: "environment" | "user-secret" | null;
  scanner_health: {
    johnny: {
      kind: "johnny";
      configured: boolean;
      healthy: boolean | null;
      checkedAt: string | null;
      healthyAt: string | null;
      host: string | null;
      probeDirectory: string | null;
      probeCommand: string | null;
      error: string | null;
    };
    snyk: {
      kind: "snyk";
      configured: boolean;
      healthy: boolean | null;
      checkedAt: string | null;
      healthyAt: string | null;
      host: string | null;
      probeDirectory: string | null;
      probeCommand: string | null;
      error: string | null;
    };
  };
  scanner_choices?: ScannerChoice[];
};

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
    title: scanInputTypeLabels.github,
    description: "Paste a repository URL to clone and scan a live codebase quickly.",
    placeholder: "https://github.com/owner/repository",
    hint: "Best default path for most users. Use a full repository URL.",
    icon: Github,
  },
  {
    value: "sbom",
    title: scanInputTypeLabels.sbom,
    description: "Use a prepared CycloneDX or similar dependency manifest.",
    placeholder: "/path/to/bom.json",
    hint: "Best when CI already produces an SBOM and you want fast dependency analysis.",
    icon: Package,
  },
  {
    value: "source_zip",
    title: scanInputTypeLabels.source_zip,
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
  const [selectedScannerSources, setSelectedScannerSources] = useState<ScannerSource[]>([]);
  const selectionInitializedRef = useRef(false);
  const { isLoading: isSubmitting, error, run } = useAsyncState();
  const { data: scannerAccessData } = useQuery(getScannerAccessSettings);
  const {
    data: recentScans,
    isLoading: isRecentLoading,
    error: recentError,
    refetch,
  } = useQuery(getScans);
  const normalizedScans = useMemo(() => recentScans ?? [], [recentScans]);
  const scannerChoices = useMemo<ScannerChoice[]>(() => {
    const access = scannerAccessData as ScannerAccessResponse | null;
    if (Array.isArray(access?.scanner_choices) && access.scanner_choices.length > 0) {
      return access.scanner_choices;
    }

    return getPlannedScannerSources(scannerAccessData as ScannerAccessPreview | null).map((source) => {
      const entry = getScannerLineupEntry(source);
      return {
        source,
        label: entry.label,
        description: entry.description,
        selectable: true,
        selected_by_default: true,
        status: "available",
        disabled_reason: null,
        cooldown_reset_at: null,
      };
    });
  }, [scannerAccessData]);
  const scannerChoiceMap = useMemo(
    () => new Map(scannerChoices.map((choice) => [choice.source, choice])),
    [scannerChoices],
  );
  const scannerSources = useMemo(() => scannerChoices.map((choice) => choice.source), [scannerChoices]);

  // recommended scanners for the current inputType (use planned sources as recommendation)
  const recommendedBySource = useMemo(() => {
    const planned = getPlannedScannerSources(scannerAccessData as ScannerAccessPreview | null);
    return Object.fromEntries(planned.map((s) => [s, true]));
  }, [scannerAccessData]);
  const activeType = useMemo(
    () => inputTypeOptions.find((option) => option.value === inputType) ?? inputTypeOptions[0],
    [inputType],
  );
  const selectedCount = selectedScannerSources.length;
  const allSelectableScannerSources = useMemo(
    () => scannerChoices.filter((choice) => choice.selectable).map((choice) => choice.source),
    [scannerChoices],
  );
  const johnnyChoice = useMemo(
    () => scannerChoices.find((choice) => choice.source === "codescoring_johnny") ?? null,
    [scannerChoices],
  );
  const scannerLaneSubtitle = johnnyChoice?.status === "cooling_down"
    ? `Johnny is on cooldown. ${johnnyChoice.disabled_reason ?? "It will unlock again later."}`
    : johnnyChoice?.status === "unavailable"
      ? `Johnny is unavailable. ${johnnyChoice.disabled_reason ?? "Check scanner access settings."}`
      : "Pick the lanes you want to run. You can mix free and enterprise scanners per scan.";

  useEffect(() => {
    if (requestedType === "github" || requestedType === "sbom" || requestedType === "source_zip") {
      setInputType(requestedType);
    }
  }, [requestedType]);

  useEffect(() => {
    if (selectionInitializedRef.current || scannerChoices.length === 0) {
      return;
    }

    setSelectedScannerSources(scannerChoices.filter((choice) => choice.selectable && choice.selected_by_default).map((choice) => choice.source));
    selectionInitializedRef.current = true;
  }, [scannerChoices]);

  useEffect(() => {
    setSelectedScannerSources((current) => {
      const next = current.filter((source) => scannerChoiceMap.get(source)?.selectable);
      return next.length === current.length ? current : next;
    });
  }, [scannerChoiceMap]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await run(
      async () => {
        if (selectedScannerSources.length === 0) {
          throw new Error("Select at least one scanner lane.");
        }

        const normalized = inputRef.trim();

        const submitArgs = {
          inputRef: normalized,
          inputType,
          selectedSources: selectedScannerSources,
        } satisfies Parameters<typeof submitScan>[0] & { selectedSources: ScannerSource[] };

        const createdScan = await submitScan(submitArgs);

        setInputRef("");
        await refetch();
        navigate(routes.ScanDetailsRoute.build({ params: { scanId: createdScan.id } }));
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
            Pick an input source and the lanes you want to run. This is the same {developerSecurityTitle.toLowerCase()} used across the rest of the product.
          </p>
        </div>

        {source === "onboarding" && (
          <Alert className="mt-8">
            <AlertDescription>
              You came here from guided setup. Pick your input type, submit the scan, and you will land on scan details immediately.
            </AlertDescription>
          </Alert>
        )}

        <ScannerLineupCard
          sources={scannerSources}
          selectionMode
          selectedBySource={Object.fromEntries(selectedScannerSources.map((scanner) => [scanner, true])) as Partial<Record<ScannerSource, boolean>>}
          selectableBySource={Object.fromEntries(scannerChoices.map((choice) => [choice.source, choice.selectable])) as Partial<Record<ScannerSource, boolean>>}
          disabledReasonBySource={Object.fromEntries(scannerChoices.map((choice) => [choice.source, choice.disabled_reason])) as Partial<Record<ScannerSource, string | null>>}
          recommendedBySource={recommendedBySource as Partial<Record<ScannerSource, boolean>>}
          onToggleSource={(scanner) => {
            const choice = scannerChoiceMap.get(scanner);
            if (!choice?.selectable) {
              return;
            }

            setSelectedScannerSources((current) => (
              current.includes(scanner)
                ? current.filter((source) => source !== scanner)
                : [...current, scanner]
            ));
          }}
          title="Parallel scan lanes"
          subtitle={scannerLaneSubtitle}
          className="border-border/70 mt-8 bg-card/90 shadow-sm"
        />

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
            <span>{selectedCount === 0 ? "Choose at least one lane to continue." : `${selectedCount} of ${scannerChoices.length} lanes selected.`}</span>
          <span>
            {allSelectableScannerSources.length === scannerChoices.length
              ? "All available lanes are selectable."
              : "Some lanes are locked right now."}
          </span>
        </div>

        <Card className="border-border/70 mt-8 bg-card/90 shadow-sm">
          <CardHeader>
            <CardTitle>Choose an input source</CardTitle>
            <CardDescription>
              Use the source you already have, then run the scanners that make sense for that input.
            </CardDescription>
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
                    className={`group flex items-start gap-0 rounded-xl border transition ${
                      isActive
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border/70 bg-background hover:border-primary/40 hover:bg-accent/40"
                    }`}
                  >
                    {/* left stripe to visually match scanner selection thickness */}
                    <span className={`${isActive ? STRIPE_THICKNESS_CLASS : 'w-3 md:w-4'} ${isActive ? 'bg-accent' : 'bg-transparent'} mr-3 hidden sm:block rounded-r-sm`} aria-hidden="true" />

                    <div className="p-4">
                      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="text-foreground font-medium">{option.title}</div>
                      <div className="text-muted-foreground mt-2 text-sm">
                        {option.description}
                      </div>
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
                <Label htmlFor="inputRef">Source reference</Label>
                <Input
                  id="inputRef"
                  value={inputRef}
                  onChange={(e) => setInputRef(e.target.value)}
                  placeholder={activeType.placeholder}
                />
                <p className="text-xs text-muted-foreground">
                  Paste the exact repository URL, SBOM path, or archive path your environment can resolve.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button type="submit" disabled={isSubmitting || inputRef.trim().length === 0 || selectedCount === 0}>
                  {isSubmitting ? "Starting..." : "Run scan"}
                  {!isSubmitting && <ArrowRight className="ml-2 h-4 w-4" />}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate(routes.OnboardingRoute.to)}
                >
                  Use guided setup
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="border-border/70 mt-8 bg-card/90 shadow-sm">
          <CardHeader>
            <CardTitle>Best fit by input</CardTitle>
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
            <CardTitle>Recent scans</CardTitle>
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
                      <th className="py-2 pr-4 font-medium">Scanners</th>
                      <th className="py-2 pr-4 font-medium">Type</th>
                      <th className="py-2 pr-4 font-medium">Status</th>
                      <th className="py-2 pr-4 font-medium">Created</th>
                      <th className="py-2 text-right font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {normalizedScans.map((scan) => (
                      <tr key={scan.id} className="border-border/50 border-b" data-testid="scan-row">
                        <td className="py-3 pr-4">
                          <div className="text-foreground font-medium">
                            {scan.inputRef || scan.id}
                          </div>
                          <div className="text-muted-foreground text-xs">
                            {scan.id}
                          </div>
                        </td>
                        <td className="py-3 pr-4">
                          <div className="flex flex-wrap gap-1.5">
                            {(Array.isArray((scan as { plannedSources?: ScannerSource[] }).plannedSources)
                              && (scan as { plannedSources?: ScannerSource[] }).plannedSources!.length > 0
                              ? (scan as { plannedSources?: ScannerSource[] }).plannedSources!
                              : ["grype" as ScannerSource]
                            ).map((source) => (
                              <span
                                key={`${scan.id}-${source}`}
                                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${getScannerBadgeClass(source)}`}
                                title={getScannerFullName(source)}
                                aria-label={`${getScannerFullName(source)} scanner`}
                              >
                                <span className="font-semibold">{getScannerLetter(source)}</span>
                                <span>{getScannerLineupEntry(source).label}</span>
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-3 pr-4 capitalize">{scan.inputType}</td>
                        <td className="py-3 pr-4">
                          <span className="rounded-full border px-2 py-1 text-xs capitalize" data-testid="scan-status">
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

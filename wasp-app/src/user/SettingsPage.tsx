import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "wasp/client/auth";
import { ExternalLink } from "lucide-react";
import { Alert, AlertDescription } from "../client/components/ui/alert";
import { Button } from "../client/components/ui/button";
import { Badge } from "../client/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../client/components/ui/card";
import { Checkbox } from "../client/components/ui/checkbox";
import { Input } from "../client/components/ui/input";
import { Label } from "../client/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../client/components/ui/select";
import { useAsyncState } from "../client/hooks/useAsyncState";
import { Link as WaspRouterLink, routes } from "wasp/client/router";
import {
  useQuery,
  updateUserSettings,
  getNotificationSettings,
  getScannerAccessSettings,
  getZohoIntegrationStatus,
  linkGithubInstallation,
  getGithubAppSetup,
  listGithubInstallations,
  connectZoho,
  disconnectZoho,
  testZohoConnection,
  resyncZohoWorkspace,
  updateNotificationSettings,
  updateScannerAccessSettings,
  updateGithubInstallationSettings,
} from "wasp/client/operations";
import {
  getScannerAvailabilityLabel,
  getScannerHealthLabel,
} from "../client/utils/scannerStatusVocabulary";
import { getBillingPlanLabel, getBillingStateLabel } from "../client/utils/productVocabulary";

type NotificationSettingsResponse = {
  project_key?: string;
  email_on_scan_complete?: boolean;
  email_on_vulnerability?: boolean;
  weekly_digest?: boolean;
  sms_enabled?: boolean;
};

type ScannerHealthSnapshot = {
  kind: "johnny" | "snyk";
  configured: boolean;
  healthy: boolean | null;
  checkedAt: string | null;
  healthyAt: string | null;
  host: string | null;
  probeDirectory: string | null;
  probeCommand: string | null;
  error: string | null;
};

type ScannerAccessResponse = {
  snyk_enabled: boolean;
  snyk_api_key_attached: boolean;
  snyk_api_key_preview: string | null;
  snyk_ready: boolean;
  snyk_ready_reason: string | null;
  snyk_credential_source: "environment" | "user-secret" | null;
  scanner_health: {
    johnny: ScannerHealthSnapshot;
    snyk: ScannerHealthSnapshot;
  };
  scanner_choices: Array<{
    source: "grype" | "trivy" | "codescoring_johnny" | "owasp" | "snyk";
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
  }>;
};

type GithubInstallationSummary = {
  id: string;
  github_installation_id: string;
  workspace_id: string | null;
  org_id: string | null;
  account_login: string | null;
  repository_selection: string;
  repos_scope: string[];
  trigger_on_push: boolean;
  trigger_on_pr: boolean;
  target_branches: string[];
  fail_pr_on_severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  available_repos: string[];
};

type GithubInstallationsResponse = {
  installations: GithubInstallationSummary[];
};

type GithubAppSetupResponse = {
  configured: boolean;
  app_id: string | null;
  app_slug: string | null;
  install_url: string | null;
  callback_url: string | null;
  webhook_url: string | null;
  manual_linking_required: boolean;
  missing_fields: string[];
  setup_message: string;
};

type ZohoIntegrationStatusResponse = {
  connected: boolean;
  connection_status: "disconnected" | "connected" | "syncing" | "error";
  sync_status: "idle" | "queued" | "running" | "succeeded" | "failed";
  accounts_domain: string | null;
  api_domain: string | null;
  zoho_organization_id: string | null;
  zoho_account_id: string | null;
  zoho_contact_id: string | null;
  last_sync_at: string | null;
  last_sync_attempt_at: string | null;
  last_error_at: string | null;
  last_error_code: string | null;
  last_error_message: string | null;
  sync_cursor: string | null;
  last_payload_hash: string | null;
  workspace_snapshot: {
    workspace: {
      id: string;
      name: string;
      slug: string;
      is_personal: boolean;
    };
    owner: {
      id: string;
      email: string;
      displayName: string | null;
      username: string | null;
    } | null;
    summary: {
      plan: string;
      billingState: string | null;
      scanHealth: "idle" | "healthy" | "degraded" | "processing";
      lastScanAt: string | null;
      openCriticalFindingsCount: number;
      integrationHealth: "disconnected" | "connected" | "syncing" | "error";
    };
  } | null;
};

type ZohoResyncResponse = {
  queued: boolean;
  jobId: string;
  status: ZohoIntegrationStatusResponse;
};

const DEFAULT_PROJECT_KEY = "default";

function normalizeProjectKey(projectKey: string): string {
  const normalized = projectKey.trim();
  return normalized.length > 0 ? normalized : DEFAULT_PROJECT_KEY;
}

export default function SettingsPage() {
  const { data: user } = useAuth();
  const {
    isLoading: isProfileLoading,
    error: profileError,
    run: runProfile,
  } = useAsyncState();
  const {
    isLoading: isNotificationLoading,
    error: notificationError,
    run: runNotification,
  } = useAsyncState();
  const {
    isLoading: isScannerAccessLoading,
    error: scannerAccessError,
    run: runScannerAccess,
  } = useAsyncState();
  const {
    isLoading: isGitHubLoading,
    error: githubError,
    run: runGitHub,
  } = useAsyncState();
  const {
    isLoading: isZohoLoading,
    error: zohoError,
    run: runZoho,
  } = useAsyncState();
  const [profileSuccessMessage, setProfileSuccessMessage] = useState<string | null>(null);
  const [notificationSuccessMessage, setNotificationSuccessMessage] = useState<string | null>(null);
  const [scannerAccessSuccessMessage, setScannerAccessSuccessMessage] = useState<string | null>(null);
  const [githubSuccessMessage, setGithubSuccessMessage] = useState<string | null>(null);
  const [zohoSuccessMessage, setZohoSuccessMessage] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [timezone, setTimezone] = useState("");
  const [language, setLanguage] = useState("en");
  const [region, setRegion] = useState<"IN" | "PK" | "OTHER">("OTHER");
  const [projectKey, setProjectKey] = useState(DEFAULT_PROJECT_KEY);
  const [emailOnScanComplete, setEmailOnScanComplete] = useState(true);
  const [emailOnVulnerability, setEmailOnVulnerability] = useState(true);
  const [weeklyDigest, setWeeklyDigest] = useState(false);
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [snykApiKey, setSnykApiKey] = useState("");
  const [scannerAccess, setScannerAccess] = useState<ScannerAccessResponse | null>(null);
  const [zohoAuthorizationCode, setZohoAuthorizationCode] = useState("");
  const [zohoRefreshToken, setZohoRefreshToken] = useState("");
  const [githubInstallationIdInput, setGithubInstallationIdInput] = useState("");
  const [reposByInstallation, setReposByInstallation] = useState<Record<string, string[]>>({});
  const [targetBranchesByInstallation, setTargetBranchesByInstallation] = useState<Record<string, string>>({});
  const [pushTriggerByInstallation, setPushTriggerByInstallation] = useState<Record<string, boolean>>({});
  const [prTriggerByInstallation, setPrTriggerByInstallation] = useState<Record<string, boolean>>({});
  const [severityByInstallation, setSeverityByInstallation] = useState<
    Record<string, "LOW" | "MEDIUM" | "HIGH" | "CRITICAL">
  >({});
  const {
    data: githubAppSetupQuery,
  } = useQuery(getGithubAppSetup);
  const {
    data: zohoStatusQuery,
    error: zohoStatusError,
    refetch: refetchZohoStatus,
  } = useQuery(getZohoIntegrationStatus);
  const {
    data: githubInstallationsQuery,
    isLoading: isGitHubInstallationsLoading,
    refetch: refetchGithubInstallations,
  } = useQuery(listGithubInstallations);
  const githubAppSetup = (githubAppSetupQuery as GithubAppSetupResponse | undefined) ?? null;
  const zohoStatus = (zohoStatusQuery as ZohoIntegrationStatusResponse | undefined) ?? null;
  const githubInstallations = useMemo(
    () => ((githubInstallationsQuery as GithubInstallationsResponse | undefined)?.installations ?? []),
    [githubInstallationsQuery],
  );
  const scannerChoices = scannerAccess?.scanner_choices ?? [];
  const scannerHealth = scannerAccess?.scanner_health ?? null;
  const snykApiKeyAttached = scannerAccess?.snyk_api_key_attached ?? false;
  const snykApiKeyPreview = scannerAccess?.snyk_api_key_preview ?? null;
  const snykCredentialSource = scannerAccess?.snyk_credential_source ?? null;
  const snykReadyReason = scannerAccess?.snyk_ready_reason ?? null;
  const johnnyChoice = scannerChoices.find((choice) => choice.source === "codescoring_johnny") ?? null;
  const snykChoice = scannerChoices.find((choice) => choice.source === "snyk") ?? null;

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName ?? user.username ?? "");
      setTimezone(user.timezone ?? "");
      setLanguage(user.language ?? "en");
      setRegion(
        user.region === "IN" || user.region === "PK" ? user.region : "OTHER",
      );
    }
  }, [user]);

  const loadNotificationSettings = useCallback(async (targetProjectKey: string) => {
    const normalizedProjectKey = normalizeProjectKey(targetProjectKey);

    await runNotification(
      async () => {
        const data = await getNotificationSettings({ project_key: normalizedProjectKey }) as NotificationSettingsResponse;

        setProjectKey(data.project_key ?? normalizedProjectKey);
        setEmailOnScanComplete(data.email_on_scan_complete ?? true);
        setEmailOnVulnerability(data.email_on_vulnerability ?? true);
        setWeeklyDigest(data.weekly_digest ?? false);
        setSmsEnabled(data.sms_enabled ?? false);
      },
      { errorMessage: "Failed to load notification settings." },
    );
  }, [runNotification]);

  const loadScannerAccessSettings = useCallback(async () => {
    await runScannerAccess(
      async () => {
        const data = await getScannerAccessSettings({}) as ScannerAccessResponse;

        setSnykApiKey("");
        setScannerAccess(data);
      },
      { errorMessage: "Failed to load scanner access settings." },
    );
  }, [runScannerAccess]);

  useEffect(() => {
    if (!user) {
      return;
    }

    void loadNotificationSettings(DEFAULT_PROJECT_KEY);
    void loadScannerAccessSettings();
  }, [user, loadNotificationSettings, loadScannerAccessSettings]);

  useEffect(() => {
    if (!githubInstallations.length) {
      setReposByInstallation({});
      setTargetBranchesByInstallation({});
      setPushTriggerByInstallation({});
      setPrTriggerByInstallation({});
      setSeverityByInstallation({});
      return;
    }

    setReposByInstallation(
      Object.fromEntries(
        githubInstallations.map((installation) => [installation.id, installation.repos_scope]),
      ),
    );
    setTargetBranchesByInstallation(
      Object.fromEntries(
        githubInstallations.map((installation) => [installation.id, installation.target_branches.join(", ")]),
      ),
    );
    setPushTriggerByInstallation(
      Object.fromEntries(
        githubInstallations.map((installation) => [installation.id, installation.trigger_on_push]),
      ),
    );
    setPrTriggerByInstallation(
      Object.fromEntries(
        githubInstallations.map((installation) => [installation.id, installation.trigger_on_pr]),
      ),
    );
    setSeverityByInstallation(
      Object.fromEntries(
        githubInstallations.map((installation) => [installation.id, installation.fail_pr_on_severity]),
      ) as Record<string, "LOW" | "MEDIUM" | "HIGH" | "CRITICAL">,
    );
  }, [githubInstallations]);

  const onSaveProfile = async (event: FormEvent) => {
    event.preventDefault();
    setProfileSuccessMessage(null);
    await runProfile(
      async () => {
        await updateUserSettings({
          displayName,
          timezone,
          language,
          region,
        });
        setProfileSuccessMessage("Profile settings saved successfully.");
      },
      { errorMessage: "Failed to save profile settings." },
    );
  };

  const onLoadNotificationSettings = async (event: FormEvent) => {
    event.preventDefault();
    setNotificationSuccessMessage(null);
    await loadNotificationSettings(projectKey);
  };

  const onSaveNotificationSettings = async (event: FormEvent) => {
    event.preventDefault();
    setNotificationSuccessMessage(null);

    const normalizedProjectKey = normalizeProjectKey(projectKey);

    await runNotification(
      async () => {
        const response = await updateNotificationSettings({
          project_key: normalizedProjectKey,
          email_on_scan_complete: emailOnScanComplete,
          email_on_vulnerability: emailOnVulnerability,
          weekly_digest: weeklyDigest,
        });

        const data = response as NotificationSettingsResponse;
        setProjectKey(data.project_key ?? normalizedProjectKey);
        setEmailOnScanComplete(data.email_on_scan_complete ?? emailOnScanComplete);
        setEmailOnVulnerability(data.email_on_vulnerability ?? emailOnVulnerability);
        setWeeklyDigest(data.weekly_digest ?? weeklyDigest);
        setSmsEnabled(data.sms_enabled ?? false);
        setNotificationSuccessMessage(
          `Notification settings saved for project "${data.project_key ?? normalizedProjectKey}".`,
        );
      },
      { errorMessage: "Failed to save notification settings." },
    );
  };

  const onRefreshScannerAccess = async () => {
    setScannerAccessSuccessMessage(null);
    await loadScannerAccessSettings();
  };

  const onSaveScannerAccessSettings = async (event: FormEvent) => {
    event.preventDefault();
    setScannerAccessSuccessMessage(null);

    await runScannerAccess(
      async () => {
        const response = await updateScannerAccessSettings({
          snyk_api_key: snykApiKey,
        });

        const data = response as ScannerAccessResponse;
        setSnykApiKey("");
        setScannerAccess(data);
        setScannerAccessSuccessMessage(
          data.snyk_api_key_attached
            ? "Snyk API key attached successfully."
            : "Snyk API key cleared.",
        );
      },
      { errorMessage: "Failed to save scanner access settings." },
    );
  };

  const onLinkGithubInstallation = async (event: FormEvent) => {
    event.preventDefault();
    setGithubSuccessMessage(null);

    await runGitHub(
      async () => {
        await linkGithubInstallation({
          installationId: githubInstallationIdInput.trim(),
        });
        setGithubInstallationIdInput("");
        await refetchGithubInstallations();
        setGithubSuccessMessage("GitHub installation linked to the active workspace.");
      },
      { errorMessage: "Failed to link GitHub installation." },
    );
  };

  const onSaveGithubInstallationSettings = async (installation: GithubInstallationSummary) => {
    setGithubSuccessMessage(null);

    await runGitHub(
      async () => {
        const targetBranches = (targetBranchesByInstallation[installation.id] ?? "")
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean);

        await updateGithubInstallationSettings({
          installationId: installation.id,
          repos_scope: reposByInstallation[installation.id] ?? installation.repos_scope,
          trigger_on_push: pushTriggerByInstallation[installation.id] ?? installation.trigger_on_push,
          trigger_on_pr: prTriggerByInstallation[installation.id] ?? installation.trigger_on_pr,
          target_branches: targetBranches,
          fail_pr_on_severity:
            severityByInstallation[installation.id] ?? installation.fail_pr_on_severity,
        });
        await refetchGithubInstallations();
        setGithubSuccessMessage(
          `GitHub settings updated for installation ${installation.github_installation_id}.`,
        );
      },
      { errorMessage: "Failed to save GitHub installation settings." },
    );
  };

  const onConnectZoho = async (event: FormEvent) => {
    event.preventDefault();
    setZohoSuccessMessage(null);

    await runZoho(
      async () => {
        const response = await connectZoho({
          authorization_code: zohoAuthorizationCode.trim() || undefined,
          refresh_token: zohoRefreshToken.trim() || undefined,
        });
        setZohoAuthorizationCode("");
        setZohoRefreshToken("");
        await refetchZohoStatus();
        setZohoSuccessMessage(
          response.connected
            ? "Zoho CRM connected and initial sync queued."
            : "Zoho CRM connection updated.",
        );
      },
      { errorMessage: "Failed to connect Zoho CRM." },
    );
  };

  const onDisconnectZoho = async () => {
    setZohoSuccessMessage(null);

    await runZoho(
      async () => {
        await disconnectZoho({});
        await refetchZohoStatus();
        setZohoSuccessMessage("Zoho CRM disconnected for the active workspace.");
      },
      { errorMessage: "Failed to disconnect Zoho CRM." },
    );
  };

  const onTestZohoConnection = async () => {
    setZohoSuccessMessage(null);

    await runZoho(
      async () => {
        const response = await testZohoConnection({});
        await refetchZohoStatus();
        setZohoSuccessMessage(
          response.connected
            ? "Zoho CRM connection verified successfully."
            : "Zoho CRM test completed.",
        );
      },
      { errorMessage: "Failed to test Zoho CRM connection." },
    );
  };

  const onResyncZohoWorkspace = async () => {
    setZohoSuccessMessage(null);

    await runZoho(
      async () => {
        const response = await resyncZohoWorkspace({});
        await refetchZohoStatus();
        const data = response as ZohoResyncResponse;
        setZohoSuccessMessage(
          data.queued
            ? `Zoho CRM resync queued (job ${data.jobId}).`
            : "Zoho CRM resync requested.",
        );
      },
      { errorMessage: "Failed to queue Zoho CRM resync." },
    );
  };

  const toggleRepoSelection = (installationId: string, repositoryFullName: string, checked: boolean) => {
    setReposByInstallation((current) => {
      const existing = current[installationId] ?? [];
      const next = checked
        ? Array.from(new Set([...existing, repositoryFullName])).sort()
        : existing.filter((value) => value !== repositoryFullName);

      return {
        ...current,
        [installationId]: next,
      };
    });
  };

  return (
    <div className="mt-10 px-6">
      <Card className="mb-4 lg:m-8">
        <CardHeader>
          <CardTitle>Billing shell</CardTitle>
          <CardDescription>Current plan, usage, and upgrade path in product terms.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-md border border-border/60 p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Plan</div>
              <div className="mt-2 text-lg font-semibold">{getBillingPlanLabel((user?.plan as any) ?? "free_trial")}</div>
            </div>
            <div className="rounded-md border border-border/60 p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Billing state</div>
              <div className="mt-2 text-lg font-semibold">{getBillingStateLabel(user?.subscriptionStatus ?? null)}</div>
            </div>
            <div className="rounded-md border border-border/60 p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Usage</div>
              <div className="mt-2 text-lg font-semibold">{user?.monthlyQuotaUsed ?? 0}/{user?.monthlyQuotaLimit ?? 0}</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <WaspRouterLink to={routes.BillingPageRoute.to}>Open billing</WaspRouterLink>
            </Button>
            <Button asChild variant="outline">
              <WaspRouterLink to={routes.PricingPageRoute.to}>Review plans</WaspRouterLink>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-4 lg:m-8">
        <CardHeader>
          <CardTitle>User Profile Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {profileError && (
            <Alert variant="destructive">
              <AlertDescription>{profileError}</AlertDescription>
            </Alert>
          )}
          {profileSuccessMessage && (
            <Alert>
              <AlertDescription>{profileSuccessMessage}</AlertDescription>
            </Alert>
          )}

          <form className="space-y-4" onSubmit={onSaveProfile}>
            <div className="space-y-2">
              <Label htmlFor="displayName">Display name</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Input
                id="timezone"
                placeholder="e.g., UTC, Asia/Kolkata"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="language">Language</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger id="language" className="w-full">
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="ru">Русский</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="region">Region</Label>
              <Select
                value={region}
                onValueChange={(value) =>
                  setRegion(value === "IN" || value === "PK" ? value : "OTHER")
                }
              >
                <SelectTrigger id="region" className="w-full">
                  <SelectValue placeholder="Select region" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="IN">India (IN)</SelectItem>
                  <SelectItem value="PK">Pakistan (PK)</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={isProfileLoading}>
              {isProfileLoading ? "Saving..." : "Save profile"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="mb-4 lg:m-8">
        <CardHeader>
          <CardTitle>Notification Settings by Project</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {notificationError && (
            <Alert variant="destructive">
              <AlertDescription>{notificationError}</AlertDescription>
            </Alert>
          )}
          {notificationSuccessMessage && (
            <Alert>
              <AlertDescription>{notificationSuccessMessage}</AlertDescription>
            </Alert>
          )}

          <form className="space-y-4" onSubmit={onLoadNotificationSettings}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="w-full space-y-2">
                <Label htmlFor="projectKey">Project key</Label>
                <Input
                  id="projectKey"
                  placeholder="e.g., owner/repo"
                  value={projectKey}
                  onChange={(event) => setProjectKey(event.target.value)}
                />
              </div>
              <Button type="submit" variant="outline" disabled={isNotificationLoading}>
                {isNotificationLoading ? "Loading..." : "Load"}
              </Button>
            </div>
          </form>

          <form className="space-y-4" onSubmit={onSaveNotificationSettings}>
            <div className="space-y-4 rounded-md border border-border/60 p-4">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="emailOnScanComplete"
                  checked={emailOnScanComplete}
                  onCheckedChange={(checked) => setEmailOnScanComplete(checked === true)}
                  disabled={isNotificationLoading}
                />
                <div className="space-y-1">
                  <Label htmlFor="emailOnScanComplete">Email on scan complete</Label>
                  <p className="text-xs text-muted-foreground">
                    Send an email when scan processing finishes for this project.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Checkbox
                  id="emailOnVulnerability"
                  checked={emailOnVulnerability}
                  onCheckedChange={(checked) => setEmailOnVulnerability(checked === true)}
                  disabled={isNotificationLoading}
                />
                <div className="space-y-1">
                  <Label htmlFor="emailOnVulnerability">Email on new vulnerabilities</Label>
                  <p className="text-xs text-muted-foreground">
                    Send an email when newly detected vulnerabilities appear in this project.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Checkbox
                  id="weeklyDigest"
                  checked={weeklyDigest}
                  onCheckedChange={(checked) => setWeeklyDigest(checked === true)}
                  disabled={isNotificationLoading}
                />
                <div className="space-y-1">
                  <Label htmlFor="weeklyDigest">Weekly digest</Label>
                  <p className="text-xs text-muted-foreground">
                    Receive a weekly summary email for this project.
                  </p>
                </div>
              </div>

              <div className="text-xs text-muted-foreground">
                SMS notifications: {smsEnabled ? "enabled" : "disabled"}
              </div>
            </div>

            <Button type="submit" disabled={isNotificationLoading}>
              {isNotificationLoading ? "Saving..." : "Save notification settings"}
            </Button>
          </form>
        </CardContent>
      </Card>
      <Card className="mb-4 lg:m-8">
        <CardHeader>
          <CardTitle>Scanner availability</CardTitle>
          <CardDescription>Manage which scanners are available for this workspace.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {scannerAccessError && (
            <Alert variant="destructive">
              <AlertDescription>{scannerAccessError}</AlertDescription>
            </Alert>
          )}
          {scannerAccessSuccessMessage && (
            <Alert>
              <AlertDescription>{scannerAccessSuccessMessage}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-4 rounded-md border border-border/60 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={johnnyChoice?.status === "available" ? "default" : johnnyChoice?.status === "cooling_down" ? "secondary" : "outline"}>
                Johnny: {getScannerAvailabilityLabel(johnnyChoice?.status)}
              </Badge>
              <Badge variant={snykChoice?.status === "available" ? "default" : "outline"}>
                Snyk: {getScannerAvailabilityLabel(snykChoice?.status)}
              </Badge>
              {snykCredentialSource && (
                <Badge variant="outline">Credential source: {snykCredentialSource}</Badge>
              )}
            </div>

            <div className="space-y-1 text-sm">
              <div>
                Snyk key:{" "}
                <span className="font-medium">
                  {snykApiKeyAttached ? (snykApiKeyPreview ?? "attached") : "not attached"}
                </span>
              </div>
              {snykReadyReason && (
                <div className="text-muted-foreground">Why Snyk is unavailable: {snykReadyReason}</div>
              )}
              {scannerHealth && (
                <div className="text-muted-foreground">
                  Health checks:
                  {" "}
                  Johnny {getScannerHealthLabel(scannerHealth.johnny.healthy)},
                  {" "}
                  Snyk {getScannerHealthLabel(scannerHealth.snyk.healthy)}
                </div>
              )}
            </div>

            <form className="space-y-4" onSubmit={onSaveScannerAccessSettings}>
              <div className="space-y-2">
                <Label htmlFor="snykApiKey">Snyk API key</Label>
                <Input
                  id="snykApiKey"
                  type="password"
                  placeholder={snykApiKeyAttached ? "Enter new key to replace current one, or leave blank to clear" : "Enter Snyk API key"}
                  value={snykApiKey}
                  onChange={(event) => setSnykApiKey(event.target.value)}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={isScannerAccessLoading}>
                  {isScannerAccessLoading ? "Saving..." : "Save scanner settings"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={onRefreshScannerAccess}
                  disabled={isScannerAccessLoading}
                >
                  Refresh checks
                </Button>
              </div>
            </form>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-4 lg:m-8">
        <CardHeader>
          <CardTitle>Zoho CRM Integration</CardTitle>
          <CardDescription>Sync the active workspace summary into Zoho CRM Account and Contact records.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {zohoStatusError && (
            <Alert variant="destructive">
              <AlertDescription>
                {zohoStatusError instanceof Error ? zohoStatusError.message : String(zohoStatusError)}
              </AlertDescription>
            </Alert>
          )}
          {zohoError && (
            <Alert variant="destructive">
              <AlertDescription>{zohoError}</AlertDescription>
            </Alert>
          )}
          {zohoSuccessMessage && (
            <Alert>
              <AlertDescription>{zohoSuccessMessage}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-4 rounded-md border border-border/60 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={zohoStatus?.connected ? "default" : "outline"}>
                Connection: {zohoStatus?.connection_status ?? "disconnected"}
              </Badge>
              <Badge variant={zohoStatus?.sync_status === "succeeded" ? "default" : zohoStatus?.sync_status === "failed" ? "destructive" : "secondary"}>
                Sync: {zohoStatus?.sync_status ?? "idle"}
              </Badge>
              {zohoStatus?.workspace_snapshot?.summary.scanHealth && (
                <Badge variant="outline">
                  Scan health: {zohoStatus.workspace_snapshot.summary.scanHealth}
                </Badge>
              )}
            </div>

            {zohoStatus?.workspace_snapshot ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <div className="rounded-md border border-border/60 p-4">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Workspace</div>
                  <div className="mt-2 text-lg font-semibold">{zohoStatus.workspace_snapshot.workspace.name}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{zohoStatus.workspace_snapshot.workspace.slug}</div>
                </div>
                <div className="rounded-md border border-border/60 p-4">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Plan / billing</div>
                  <div className="mt-2 text-lg font-semibold">{zohoStatus.workspace_snapshot.summary.plan}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{zohoStatus.workspace_snapshot.summary.billingState ?? "no billing state"}</div>
                </div>
                <div className="rounded-md border border-border/60 p-4">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Open criticals</div>
                  <div className="mt-2 text-lg font-semibold">{zohoStatus.workspace_snapshot.summary.openCriticalFindingsCount}</div>
                </div>
                <div className="rounded-md border border-border/60 p-4">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Last scan</div>
                  <div className="mt-2 text-sm font-semibold">
                    {zohoStatus.workspace_snapshot.summary.lastScanAt ?? "No completed scans yet"}
                  </div>
                </div>
                <div className="rounded-md border border-border/60 p-4">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Owner</div>
                  <div className="mt-2 text-sm font-semibold">
                    {zohoStatus.workspace_snapshot.owner?.displayName ?? zohoStatus.workspace_snapshot.owner?.username ?? zohoStatus.workspace_snapshot.owner?.email ?? "Unknown"}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{zohoStatus.workspace_snapshot.owner?.email ?? "No owner email"}</div>
                </div>
                <div className="rounded-md border border-border/60 p-4">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Zoho ids</div>
                  <div className="mt-2 text-xs text-muted-foreground break-all">
                    <div>Org: {zohoStatus.zoho_organization_id ?? "unset"}</div>
                    <div>Account: {zohoStatus.zoho_account_id ?? "unset"}</div>
                    <div>Contact: {zohoStatus.zoho_contact_id ?? "unset"}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-md border border-dashed border-border/60 p-4 text-sm text-muted-foreground">
                No Zoho summary is available yet. Connect the integration to start syncing workspace health.
              </div>
            )}

            <form className="space-y-4" onSubmit={onConnectZoho}>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="zohoAuthorizationCode">Authorization code</Label>
                  <Input
                    id="zohoAuthorizationCode"
                    placeholder="Paste Zoho OAuth authorization code"
                    value={zohoAuthorizationCode}
                    onChange={(event) => setZohoAuthorizationCode(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="zohoRefreshToken">Refresh token</Label>
                  <Input
                    id="zohoRefreshToken"
                    placeholder="Optional refresh token for direct setup"
                    value={zohoRefreshToken}
                    onChange={(event) => setZohoRefreshToken(event.target.value)}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Enter either an authorization code from Zoho OAuth or an existing refresh token. The tokens are encrypted at rest and only the workspace admin can manage this connection.
              </p>

              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={isZohoLoading}>
                  {isZohoLoading ? "Connecting..." : "Connect Zoho"}
                </Button>
                <Button type="button" variant="outline" onClick={onTestZohoConnection} disabled={isZohoLoading || !zohoStatus?.connected}>
                  Test connection
                </Button>
                <Button type="button" variant="outline" onClick={onResyncZohoWorkspace} disabled={isZohoLoading || !zohoStatus?.connected}>
                  Queue resync
                </Button>
                <Button type="button" variant="destructive" onClick={onDisconnectZoho} disabled={isZohoLoading || !zohoStatus?.connected}>
                  Disconnect
                </Button>
              </div>
            </form>

            {(zohoStatus?.last_error_message || zohoStatus?.last_sync_at || zohoStatus?.last_sync_attempt_at) && (
              <div className="rounded-md border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
                {zohoStatus.last_sync_at && <div>Last successful sync: {zohoStatus.last_sync_at}</div>}
                {zohoStatus.last_sync_attempt_at && <div>Last sync attempt: {zohoStatus.last_sync_attempt_at}</div>}
                {zohoStatus.last_error_message && (
                  <div>
                    Last error: {zohoStatus.last_error_message}
                    {zohoStatus.last_error_code ? ` (${zohoStatus.last_error_code})` : ""}
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="mb-4 lg:m-8">
        <CardHeader>
          <CardTitle>GitHub Integration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {githubError && (
            <Alert variant="destructive">
              <AlertDescription>{githubError}</AlertDescription>
            </Alert>
          )}
          {githubSuccessMessage && (
            <Alert>
              <AlertDescription>{githubSuccessMessage}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2 rounded-md border border-border/60 p-4">
            <div className="text-sm font-medium">Install and connect GitHub App</div>
            {githubAppSetup?.configured ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Install the GitHub App in GitHub first, then link the resulting installation to this workspace.
                </p>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  {githubAppSetup.install_url ? (
                    <Button asChild type="button">
                      <a href={githubAppSetup.install_url} target="_blank" rel="noreferrer">
                        Install GitHub App
                        <ExternalLink className="ml-2 h-4 w-4" />
                      </a>
                    </Button>
                  ) : (
                    <div className="rounded-md border border-dashed border-border/60 p-3 text-sm text-muted-foreground">
                      GitHub App is configured, but `GITHUB_APP_SLUG` is missing, so the direct install link cannot be generated automatically.
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground">
                    After installation, GitHub will show an installation ID that you can paste below.
                  </div>
                </div>
                <div className="rounded-md border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
                  <div>Callback URL: {githubAppSetup.callback_url}</div>
                  <div>Webhook URL: {githubAppSetup.webhook_url}</div>
                </div>
              </div>
            ) : (
              <div className="space-y-3 rounded-md border border-dashed border-border/60 p-3 text-sm text-muted-foreground">
                <div>{githubAppSetup?.setup_message ?? 'GitHub App env is not fully configured yet.'}</div>
                {githubAppSetup?.missing_fields?.length ? (
                  <div className="rounded-md border border-border/60 bg-muted/30 p-3 text-xs">
                    <div className="font-medium text-foreground">Missing variables</div>
                    <div>{githubAppSetup.missing_fields.join(', ')}</div>
                  </div>
                ) : null}
                <div className="rounded-md border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
                  <div>Callback URL: {githubAppSetup?.callback_url}</div>
                  <div>Webhook URL: {githubAppSetup?.webhook_url}</div>
                </div>
              </div>
            )}

            <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={onLinkGithubInstallation}>
              <div className="w-full space-y-2">
                <Label htmlFor="githubInstallationId">Installation ID</Label>
                <Input
                  id="githubInstallationId"
                  placeholder="e.g. 12345678"
                  value={githubInstallationIdInput}
                  onChange={(event) => setGithubInstallationIdInput(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Advanced fallback: paste an installation ID manually if you already installed the GitHub App and want to attach it to this workspace.
                </p>
              </div>
              <Button type="submit" disabled={isGitHubLoading || githubInstallationIdInput.trim().length === 0}>
                {isGitHubLoading ? "Linking..." : "Link installation"}
              </Button>
            </form>
          </div>

          {isGitHubInstallationsLoading && (
            <div className="text-sm text-muted-foreground">Loading GitHub installations...</div>
          )}

          {!isGitHubInstallationsLoading && githubInstallations.length === 0 && (
            <div className="rounded-md border border-border/60 p-4 text-sm text-muted-foreground">
              No GitHub installations are linked to this workspace yet.
            </div>
          )}

          {githubInstallations.map((installation) => {
            const selectedRepos = reposByInstallation[installation.id] ?? installation.repos_scope;
            const availableRepos = installation.available_repos.length > 0
              ? installation.available_repos
              : installation.repos_scope;

            return (
              <div key={installation.id} className="space-y-4 rounded-md border border-border/60 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="default">
                        {installation.account_login ?? `Installation ${installation.github_installation_id}`}
                      </Badge>
                      <Badge variant="outline">Selection: {installation.repository_selection}</Badge>
                      <Badge variant="secondary">{selectedRepos.length} repos enabled</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Installation ID: {installation.github_installation_id}
                    </div>
                  </div>
                  <Button
                    type="button"
                    onClick={() => void onSaveGithubInstallationSettings(installation)}
                    disabled={isGitHubLoading}
                  >
                    {isGitHubLoading ? "Saving..." : "Save GitHub settings"}
                  </Button>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-2 rounded-md border border-border/60 p-4">
                    <div className="text-sm font-medium">Triggers</div>
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id={`push-${installation.id}`}
                        checked={pushTriggerByInstallation[installation.id] ?? installation.trigger_on_push}
                        onCheckedChange={(checked) =>
                          setPushTriggerByInstallation((current) => ({
                            ...current,
                            [installation.id]: checked === true,
                          }))
                        }
                      />
                      <div className="space-y-1">
                        <Label htmlFor={`push-${installation.id}`}>Run on push</Label>
                        <p className="text-xs text-muted-foreground">
                          Queue scans when enabled repositories receive qualifying push events.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id={`pr-${installation.id}`}
                        checked={prTriggerByInstallation[installation.id] ?? installation.trigger_on_pr}
                        onCheckedChange={(checked) =>
                          setPrTriggerByInstallation((current) => ({
                            ...current,
                            [installation.id]: checked === true,
                          }))
                        }
                      />
                      <div className="space-y-1">
                        <Label htmlFor={`pr-${installation.id}`}>Run on pull requests</Label>
                        <p className="text-xs text-muted-foreground">
                          Queue scans on pull request events for the selected repositories and branches.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 rounded-md border border-border/60 p-4">
                    <div className="space-y-2">
                      <Label htmlFor={`branches-${installation.id}`}>Target branches</Label>
                      <Input
                        id={`branches-${installation.id}`}
                        placeholder="main, develop"
                        value={targetBranchesByInstallation[installation.id] ?? installation.target_branches.join(", ")}
                        onChange={(event) =>
                          setTargetBranchesByInstallation((current) => ({
                            ...current,
                            [installation.id]: event.target.value,
                          }))
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        Comma-separated list. Only matching push/PR target branches will queue scans.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`severity-${installation.id}`}>Fail PR on severity</Label>
                      <Select
                        value={severityByInstallation[installation.id] ?? installation.fail_pr_on_severity}
                        onValueChange={(value) =>
                          setSeverityByInstallation((current) => ({
                            ...current,
                            [installation.id]: value as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
                          }))
                        }
                      >
                        <SelectTrigger id={`severity-${installation.id}`} className="w-full">
                          <SelectValue placeholder="Select severity threshold" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="LOW">LOW</SelectItem>
                          <SelectItem value="MEDIUM">MEDIUM</SelectItem>
                          <SelectItem value="HIGH">HIGH</SelectItem>
                          <SelectItem value="CRITICAL">CRITICAL</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 rounded-md border border-border/60 p-4">
                  <div className="text-sm font-medium">Enabled repositories</div>
                  <p className="text-xs text-muted-foreground">
                    Toggle repositories that should participate in GitHub-triggered scans for this workspace.
                  </p>
                  <div className="grid gap-3 md:grid-cols-2">
                    {availableRepos.map((repositoryFullName) => (
                      <div key={repositoryFullName} className="flex items-start gap-3 rounded-md border border-border/50 p-3">
                        <Checkbox
                          id={`${installation.id}-${repositoryFullName}`}
                          checked={selectedRepos.includes(repositoryFullName)}
                          onCheckedChange={(checked) =>
                            toggleRepoSelection(installation.id, repositoryFullName, checked === true)
                          }
                        />
                        <div className="space-y-1">
                          <Label htmlFor={`${installation.id}-${repositoryFullName}`}>
                            {repositoryFullName}
                          </Label>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

    </div>
  );
}

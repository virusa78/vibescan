import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "wasp/client/auth";
import { ExternalLink } from "lucide-react";
import { Alert, AlertDescription } from "../client/components/ui/alert";
import { Button } from "../client/components/ui/button";
import { Badge } from "../client/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../client/components/ui/card";
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
import {
  useQuery,
  updateUserSettings,
  getNotificationSettings,
  getScannerAccessSettings,
  linkGithubInstallation,
  getGithubAppSetup,
  listGithubInstallations,
  updateNotificationSettings,
  updateScannerAccessSettings,
  updateGithubInstallationSettings,
} from "wasp/client/operations";

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
  const [profileSuccessMessage, setProfileSuccessMessage] = useState<string | null>(null);
  const [notificationSuccessMessage, setNotificationSuccessMessage] = useState<string | null>(null);
  const [scannerAccessSuccessMessage, setScannerAccessSuccessMessage] = useState<string | null>(null);
  const [githubSuccessMessage, setGithubSuccessMessage] = useState<string | null>(null);

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
  const [snykApiKeyAttached, setSnykApiKeyAttached] = useState(false);
  const [snykApiKeyPreview, setSnykApiKeyPreview] = useState<string | null>(null);
  const [snykEnabled, setSnykEnabled] = useState(false);
  const [snykReady, setSnykReady] = useState(false);
  const [snykReadyReason, setSnykReadyReason] = useState<string | null>(null);
  const [snykCredentialSource, setSnykCredentialSource] = useState<ScannerAccessResponse["snyk_credential_source"]>(null);
  const [scannerHealth, setScannerHealth] = useState<ScannerAccessResponse["scanner_health"] | null>(null);
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
    data: githubInstallationsQuery,
    isLoading: isGitHubInstallationsLoading,
    refetch: refetchGithubInstallations,
  } = useQuery(listGithubInstallations);
  const githubAppSetup = (githubAppSetupQuery as GithubAppSetupResponse | undefined) ?? null;
  const githubInstallations = useMemo(
    () => ((githubInstallationsQuery as GithubInstallationsResponse | undefined)?.installations ?? []),
    [githubInstallationsQuery],
  );

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
        setSnykEnabled(data.snyk_enabled);
        setSnykApiKeyAttached(data.snyk_api_key_attached);
        setSnykApiKeyPreview(data.snyk_api_key_preview);
        setSnykReady(data.snyk_ready);
        setSnykReadyReason(data.snyk_ready_reason);
        setSnykCredentialSource(data.snyk_credential_source);
        setScannerHealth(data.scanner_health);
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
        setSnykEnabled(data.snyk_enabled);
        setSnykApiKeyAttached(data.snyk_api_key_attached);
        setSnykApiKeyPreview(data.snyk_api_key_preview);
        setSnykReady(data.snyk_ready);
        setSnykReadyReason(data.snyk_ready_reason);
        setSnykCredentialSource(data.snyk_credential_source);
        setScannerHealth(data.scanner_health);
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
          <CardTitle>Scanner Access</CardTitle>
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
              <Badge variant={snykEnabled ? "default" : "outline"}>
                {snykEnabled ? "Snyk enabled" : "Snyk disabled"}
              </Badge>
              <Badge variant={snykReady ? "default" : "secondary"}>
                {snykReady ? "Ready" : "Not ready"}
              </Badge>
              {snykCredentialSource && (
                <Badge variant="outline">Credential source: {snykCredentialSource}</Badge>
              )}
            </div>

            <div className="space-y-1 text-sm">
              <div>
                Attached key:{" "}
                <span className="font-medium">
                  {snykApiKeyAttached ? (snykApiKeyPreview ?? "attached") : "not attached"}
                </span>
              </div>
              {snykReadyReason && (
                <div className="text-muted-foreground">Reason: {snykReadyReason}</div>
              )}
              {scannerHealth && (
                <div className="text-muted-foreground">
                  Health probes:
                  {" "}
                  Johnny {scannerHealth.johnny.healthy === true ? "healthy" : scannerHealth.johnny.healthy === false ? "unhealthy" : "unknown"},
                  {" "}
                  Snyk {scannerHealth.snyk.healthy === true ? "healthy" : scannerHealth.snyk.healthy === false ? "unhealthy" : "unknown"}
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
                  {isScannerAccessLoading ? "Saving..." : "Save scanner access"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={onRefreshScannerAccess}
                  disabled={isScannerAccessLoading}
                >
                  Refresh status
                </Button>
              </div>
            </form>
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
              <div className="rounded-md border border-dashed border-border/60 p-3 text-sm text-muted-foreground">
                GitHub App env is not fully configured yet. Configure the app first, then return here to connect installations.
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

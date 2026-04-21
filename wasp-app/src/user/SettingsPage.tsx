import { FormEvent, useCallback, useEffect, useState } from "react";
import { useAuth } from "wasp/client/auth";
import { updateUserSettings } from "wasp/client/operations";
import { api } from "wasp/client/api";
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
  snyk_api_key_attached: boolean;
  snyk_api_key_preview: string | null;
  scanner_health: {
    johnny: ScannerHealthSnapshot;
    snyk: ScannerHealthSnapshot;
  };
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
  const [profileSuccessMessage, setProfileSuccessMessage] = useState<string | null>(null);
  const [notificationSuccessMessage, setNotificationSuccessMessage] = useState<string | null>(null);
  const [scannerAccessSuccessMessage, setScannerAccessSuccessMessage] = useState<string | null>(null);

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
  const [scannerHealth, setScannerHealth] = useState<ScannerAccessResponse["scanner_health"] | null>(null);

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
        const response = await api.get("/api/v1/settings/notifications", {
          params: { project_key: normalizedProjectKey },
        });
        const data = response.data as NotificationSettingsResponse;

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
        const response = await api.get("/api/v1/settings/scanner-access");
        const data = response.data as ScannerAccessResponse;

        setSnykApiKey("");
        setSnykApiKeyAttached(data.snyk_api_key_attached);
        setSnykApiKeyPreview(data.snyk_api_key_preview);
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
        const response = await api.post("/api/v1/settings/notifications", {
          project_key: normalizedProjectKey,
          email_on_scan_complete: emailOnScanComplete,
          email_on_vulnerability: emailOnVulnerability,
          weekly_digest: weeklyDigest,
        });

        const data = response.data as NotificationSettingsResponse;
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
        const response = await api.post("/api/v1/settings/scanner-access", {
          snyk_api_key: snykApiKey,
        });

        const data = response.data as ScannerAccessResponse;
        setSnykApiKey("");
        setSnykApiKeyAttached(data.snyk_api_key_attached);
        setSnykApiKeyPreview(data.snyk_api_key_preview);
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

  const renderHealthBadge = (snapshot: ScannerHealthSnapshot) => {
    if (!snapshot.configured) {
      return <Badge variant="outline">Not configured</Badge>;
    }

    if (snapshot.healthy) {
      return <Badge>Healthy</Badge>;
    }

    return <Badge variant="destructive">Unhealthy</Badge>;
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
          <CardTitle>Scanner Access and Health</CardTitle>
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

          <form className="space-y-4" onSubmit={onSaveScannerAccessSettings}>
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="text-sm font-medium">Johnny host</div>
                <div className="text-xs text-muted-foreground">
                  {scannerHealth?.johnny.host ?? "Not configured"}
                </div>
              </div>
              {scannerHealth ? renderHealthBadge(scannerHealth.johnny) : <Badge variant="outline">Unknown</Badge>}
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="text-sm font-medium">Snyk runtime</div>
                <div className="text-xs text-muted-foreground">
                  {scannerHealth?.snyk.host ?? "Not configured"}
                </div>
              </div>
              {scannerHealth ? renderHealthBadge(scannerHealth.snyk) : <Badge variant="outline">Unknown</Badge>}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="w-full space-y-2">
                <Label htmlFor="snykApiKey">Snyk API key</Label>
                <Input
                  id="snykApiKey"
                  type="password"
                  placeholder={snykApiKeyAttached ? snykApiKeyPreview ?? "Key attached" : "Paste your Snyk API key"}
                  value={snykApiKey}
                  onChange={(event) => setSnykApiKey(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Stored encrypted at rest. Leave blank to clear the attached key.
                </p>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={onRefreshScannerAccess} disabled={isScannerAccessLoading}>
                  {isScannerAccessLoading ? "Refreshing..." : "Refresh"}
                </Button>
                <Button type="submit" disabled={isScannerAccessLoading}>
                  {isScannerAccessLoading ? "Saving..." : "Save key"}
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

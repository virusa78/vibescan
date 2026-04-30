import { FormEvent, useCallback, useEffect, useState } from "react";
import { useAuth } from "wasp/client/auth";
import { updateUserSettings } from "wasp/client/operations";
import { Alert, AlertDescription } from "../client/components/ui/alert";
import { Button } from "../client/components/ui/button";
import { Badge } from "../client/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../client/components/ui/card";
import { Checkbox } from "../client/components/ui/checkbox";
import { Input } from "../client/components/ui/input";
import { Label } from "../client/components/ui/label";
import { Switch } from "../client/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../client/components/ui/select";
import { useAsyncState } from "../client/hooks/useAsyncState";
import { api } from "../client/utils/api";

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

  // Notification settings UI state
  const [projectKey, setProjectKey] = useState("");
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifSaving, setNotifSaving] = useState(false);
  const [notifSuccess, setNotifSuccess] = useState<string | null>(null);
  const [notifError, setNotifError] = useState<string | null>(null);
  const [emailOnScanComplete, setEmailOnScanComplete] = useState(true);
  const [emailOnVulnerability, setEmailOnVulnerability] = useState(true);
  const [weeklyDigest, setWeeklyDigest] = useState(false);
  const [smsEnabled, setSmsEnabled] = useState(false);

  const projectKeyRegex = /^[a-zA-Z0-9._-]+$/;

  const loadNotificationSettings = async () => {
    setNotifError(null);
    setNotifSuccess(null);
    if (!projectKey || !projectKeyRegex.test(projectKey)) {
      setNotifError("Project key is required and must be alphanumeric, dot, underscore or hyphen.");
      return;
    }

    setNotifLoading(true);
    try {
      const res = await api.get(`/api/v1/settings/notifications?project_key=${encodeURIComponent(projectKey)}`);
      const data = res.data;
      setEmailOnScanComplete(Boolean(data.email_on_scan_complete));
      setEmailOnVulnerability(Boolean(data.email_on_vulnerability));
      setWeeklyDigest(Boolean(data.weekly_digest));
      setSmsEnabled(Boolean(data.sms_enabled));
      setNotifSuccess("Settings loaded.");
    } catch (e: any) {
      setNotifError(e?.message ?? "Failed to load notification settings.");
    } finally {
      setNotifLoading(false);
    }
  };

  const saveNotificationSettings = async () => {
    setNotifError(null);
    setNotifSuccess(null);
    if (!projectKey || !projectKeyRegex.test(projectKey)) {
      setNotifError("Project key is required and must be alphanumeric, dot, underscore or hyphen.");
      return;
    }

    setNotifSaving(true);
    try {
      const body = {
        project_key: projectKey,
        email_on_scan_complete: emailOnScanComplete,
        email_on_vulnerability: emailOnVulnerability,
        weekly_digest: weeklyDigest,
      };
      const res = await api.post(`/api/v1/settings/notifications`, body);
      const data = res.data;
      setNotifSuccess("Notification settings saved.");
      setEmailOnScanComplete(Boolean(data.email_on_scan_complete));
      setEmailOnVulnerability(Boolean(data.email_on_vulnerability));
      setWeeklyDigest(Boolean(data.weekly_digest));
    } catch (e: any) {
      setNotifError(e?.message ?? "Failed to save notification settings.");
    } finally {
      setNotifSaving(false);
    }
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

      {/* Notification Preferences */}
      <Card className="mb-4 lg:m-8">
        <CardHeader>
          <CardTitle>Notification Preferences</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {notifError && (
            <Alert variant="destructive">
              <AlertDescription>{notifError}</AlertDescription>
            </Alert>
          )}
          {notifSuccess && (
            <Alert>
              <AlertDescription>{notifSuccess}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Label htmlFor="projectKey">Project key</Label>
              <Input id="projectKey" placeholder="project-key" value={projectKey} onChange={(e) => setProjectKey(e.target.value)} className="w-48" />
              <Button onClick={loadNotificationSettings} disabled={notifLoading}>{notifLoading ? "Loading..." : "Load"}</Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center justify-between border p-3 rounded">
                <div>
                  <p className="text-sm font-medium">Email on scan complete</p>
                  <p className="text-xs text-muted-foreground">Receive email when a scan finishes</p>
                </div>
                <Switch checked={emailOnScanComplete} onCheckedChange={(v) => setEmailOnScanComplete(Boolean(v))} aria-label="Email on scan complete" />
              </div>

              <div className="flex items-center justify-between border p-3 rounded">
                <div>
                  <p className="text-sm font-medium">Email on vulnerability</p>
                  <p className="text-xs text-muted-foreground">Receive email when new vulnerability found</p>
                </div>
                <Switch checked={emailOnVulnerability} onCheckedChange={(v) => setEmailOnVulnerability(Boolean(v))} aria-label="Email on vulnerability" />
              </div>

              <div className="flex items-center justify-between border p-3 rounded">
                <div>
                  <p className="text-sm font-medium">Weekly digest</p>
                  <p className="text-xs text-muted-foreground">Receive a weekly summary</p>
                </div>
                <Switch checked={weeklyDigest} onCheckedChange={(v) => setWeeklyDigest(Boolean(v))} aria-label="Weekly digest" />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button onClick={saveNotificationSettings} disabled={notifSaving}>{notifSaving ? "Saving..." : "Save notification settings"}</Button>
              <Button variant="ghost" onClick={() => { setProjectKey(''); setNotifError(null); setNotifSuccess(null); }}>Reset</Button>
              <div className="ml-auto text-xs text-muted-foreground">
                {smsEnabled ? "SMS enabled (read-only)" : "SMS disabled"}
              </div>
            </div>

            <p className="text-xs text-muted-foreground">Tip: project key links to the project page.</p>
            {projectKey && (
              <a href={`/projects/${encodeURIComponent(projectKey)}`} className="text-sm text-primary underline">Open project</a>
            )}
          </div>
        </CardContent>
      </Card>

    </div>
  );
}

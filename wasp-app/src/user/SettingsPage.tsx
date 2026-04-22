import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "wasp/client/auth";
import { updateUserSettings } from "wasp/client/operations";
import { api } from "wasp/client/api";
import { Alert, AlertDescription } from "../client/components/ui/alert";
import { Button } from "../client/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../client/components/ui/card";
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

export default function SettingsPage() {
  const { data: user } = useAuth();
  const { isLoading, error, run } = useAsyncState();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [timezone, setTimezone] = useState("");
  const [language, setLanguage] = useState("en");
  const [region, setRegion] = useState<"IN" | "PK" | "OTHER">("OTHER");

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

  const onSave = async (event: FormEvent) => {
    event.preventDefault();
    setSuccessMessage(null);
    await run(
      async () => {
        await updateUserSettings({
          displayName,
          timezone,
          language,
          region,
        });
        setSuccessMessage("Settings saved successfully.");
      },
      { errorMessage: "Failed to save settings." },
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
          <CardTitle>User Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {successMessage && (
            <Alert>
              <AlertDescription>{successMessage}</AlertDescription>
            </Alert>
          )}

          <form className="space-y-4" onSubmit={onSave}>
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
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Saving..." : "Save settings"}
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

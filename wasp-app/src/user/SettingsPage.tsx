import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "wasp/client/auth";
import { useQuery } from "wasp/client/operations";
import { Alert, AlertDescription } from "../client/components/ui/alert";
import { Button } from "../client/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../client/components/ui/card";
import { Input } from "../client/components/ui/input";
import { Label } from "../client/components/ui/label";
import { getUserSettings } from "wasp/client/operations";
import { settingsApi } from "./settingsApi";

export default function SettingsPage() {
  const { data: user } = useAuth();
  const { data: settings, isLoading, refetch } = useQuery(getUserSettings);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [githubUsername, setGithubUsername] = useState("");
  const [githubToken, setGithubToken] = useState("");
  const [defaultRepo, setDefaultRepo] = useState("");
  const [defaultBranch, setDefaultBranch] = useState("main");

  useEffect(() => {
    setDisplayName(settings?.displayName ?? user?.username ?? "");
    setGithubUsername(settings?.githubUsername ?? "");
    setGithubToken(settings?.githubToken ?? "");
    setDefaultRepo(settings?.defaultRepo ?? "");
    setDefaultBranch(settings?.defaultBranch ?? "main");
  }, [settings, user?.username]);

  const onSave = async (event: FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await settingsApi.update({
        displayName,
        githubUsername,
        githubToken,
        defaultRepo,
        defaultBranch,
      });
      setSuccessMessage("Settings saved.");
      await refetch();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to save settings.";
      setErrorMessage(message);
    }
  };

  return (
    <div className="mt-10 px-6">
      <Card className="mb-4 lg:m-8">
        <CardHeader>
          <CardTitle>User Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {errorMessage && (
            <Alert variant="destructive">
              <AlertDescription>{errorMessage}</AlertDescription>
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
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="githubUsername">GitHub username</Label>
              <Input
                id="githubUsername"
                value={githubUsername}
                onChange={(e) => setGithubUsername(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="githubToken">GitHub token (for private repos)</Label>
              <Input
                id="githubToken"
                type="password"
                value={githubToken}
                onChange={(e) => setGithubToken(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="defaultRepo">Default repository (owner/name)</Label>
              <Input
                id="defaultRepo"
                value={defaultRepo}
                onChange={(e) => setDefaultRepo(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="defaultBranch">Default branch</Label>
              <Input
                id="defaultBranch"
                value={defaultBranch}
                onChange={(e) => setDefaultBranch(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <Button type="submit" disabled={isLoading}>
              Save settings
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

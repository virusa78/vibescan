import { useState } from "react";
import { Link as WaspRouterLink, routes } from "wasp/client/router";
import { useAuth } from "wasp/client/auth";
import { getAdminConsoleOverview, useQuery } from "wasp/client/operations";
import { Alert, AlertDescription } from "../client/components/ui/alert";
import { Badge } from "../client/components/ui/badge";
import { Button } from "../client/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../client/components/ui/card";
import { Input } from "../client/components/ui/input";
import { getAdminRoleLabel } from "../client/utils/productVocabulary";

type AdminConsoleSummary = {
  total_users: number;
  total_workspaces: number;
  total_scans: number;
  admin_users: number;
  active_subscriptions: number;
  past_due_subscriptions: number;
  queued_scans: number;
  running_scans: number;
  failed_scans: number;
};

type AdminConsoleUser = {
  id: string;
  email: string;
  username: string | null;
  isAdmin: boolean;
  plan: string;
  subscriptionStatus: string | null;
  monthlyQuotaUsed?: number;
  monthlyQuotaLimit?: number;
  activeWorkspaceId?: string | null;
};

type AdminConsoleWorkspace = {
  id: string;
  name: string;
  slug: string;
  isPersonal: boolean;
  createdAt: string;
  organization: { name: string; slug: string };
  _count: { members: number; scans: number };
};

type AdminConsoleScan = {
  id: string;
  status: string;
  inputType: string;
  inputRef: string;
  planAtSubmission: string;
  workspaceId: string | null;
  userId: string;
  createdAt: string;
  completedAt: string | null;
  user?: { email: string; username: string | null };
  workspace?: { name: string; slug: string } | null;
  _count?: { findings: number; scanResults: number };
};

type AdminConsoleLookup = {
  query: string | null;
  users: AdminConsoleUser[];
  workspaces: AdminConsoleWorkspace[];
  scans: AdminConsoleScan[];
};

type AdminConsoleResponse = {
  summary: AdminConsoleSummary;
  worker_status: {
    free: { isRunning: boolean; isPaused: boolean };
    enterprise: { isRunning: boolean; isPaused: boolean };
    webhook: { isRunning: boolean; isPaused: boolean };
  };
  users: AdminConsoleUser[];
  workspaces: AdminConsoleWorkspace[];
  scans: AdminConsoleScan[];
  lookup: AdminConsoleLookup;
};

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function WorkerBadge({ isRunning, isPaused }: { isRunning: boolean; isPaused: boolean }) {
  const label = isPaused ? "Paused" : isRunning ? "Running" : "Stopped";
  const variant = isPaused ? "secondary" : isRunning ? "default" : "outline";

  return <Badge variant={variant}>{label}</Badge>;
}

export default function AdminPage() {
  const { data: user } = useAuth();
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");

  const { data, error, isLoading } = useQuery(getAdminConsoleOverview, {
    q: submittedQuery || undefined,
  });
  const response = (data ?? null) as AdminConsoleResponse | null;
  const isAdmin = Boolean(user?.isAdmin);

  if (!user) {
    return <div className="p-8 text-sm text-muted-foreground">Loading admin console...</div>;
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto flex min-h-screen max-w-3xl items-center px-6 py-16">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Admin access required</CardTitle>
            <CardDescription>The admin console is reserved for internal operators.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              You can continue using the main product shell from your workspace account.
            </p>
            <Button asChild>
              <WaspRouterLink to={routes.DashboardRoute.to}>Return to dashboard</WaspRouterLink>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const summary = response?.summary ?? null;
  const workerStatus = response?.worker_status ?? null;
  const lookup = response?.lookup ?? { query: null, users: [], workspaces: [], scans: [] };

  return (
    <div className="w-full bg-background">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Internal ops</Badge>
            <Badge variant="outline">Admin only</Badge>
          </div>
          <div className="space-y-1">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">Admin console</h1>
            <p className="text-sm text-muted-foreground">
              Read-heavy workspace, subscription, and scan health views for support and operations.
            </p>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{String(error)}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Support lookup</CardTitle>
            <CardDescription>Search by scan id, repository input, workspace name, or user email.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="flex flex-col gap-3 sm:flex-row"
              onSubmit={(event) => {
                event.preventDefault();
                setSubmittedQuery(query.trim());
              }}
            >
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search scans, users, and workspaces"
              />
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Searching..." : "Search"}
              </Button>
            </form>
            {lookup.query ? (
              <p className="mt-3 text-xs text-muted-foreground">Filtered by "{lookup.query}".</p>
            ) : null}
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Users", value: summary?.total_users ?? 0 },
            { label: "Workspaces", value: summary?.total_workspaces ?? 0 },
            { label: "Scans", value: summary?.total_scans ?? 0 },
            { label: "Admins", value: summary?.admin_users ?? 0 },
            { label: "Active subscriptions", value: summary?.active_subscriptions ?? 0 },
            { label: "Past due", value: summary?.past_due_subscriptions ?? 0 },
            { label: "Queued scans", value: summary?.queued_scans ?? 0 },
            { label: "Running scans", value: summary?.running_scans ?? 0 },
          ].map((item) => (
            <Card key={item.label}>
              <CardContent className="p-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">{item.label}</div>
                <div className="mt-2 text-3xl font-semibold text-foreground">{item.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Worker health</CardTitle>
              <CardDescription>Queue workers and webhook delivery runtime status.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span>Free scan worker</span>
                <WorkerBadge isRunning={workerStatus?.free.isRunning ?? false} isPaused={workerStatus?.free.isPaused ?? false} />
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Enterprise scan worker</span>
                <WorkerBadge isRunning={workerStatus?.enterprise.isRunning ?? false} isPaused={workerStatus?.enterprise.isPaused ?? false} />
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Webhook delivery worker</span>
                <WorkerBadge isRunning={workerStatus?.webhook.isRunning ?? false} isPaused={workerStatus?.webhook.isPaused ?? false} />
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Subscription and quota snapshot</CardTitle>
              <CardDescription>Recent users and their billing state.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {(response?.users ?? []).map((entry) => (
                <div key={entry.id} className="flex flex-col gap-2 rounded-lg border border-border/60 p-3 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-foreground">{entry.email}</span>
                      {entry.username ? <span className="text-xs text-muted-foreground">@{entry.username}</span> : null}
                      {entry.isAdmin ? <Badge variant="secondary">Admin</Badge> : null}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Plan {entry.plan} · Subscription {entry.subscriptionStatus ?? "none"} · Workspace {entry.activeWorkspaceId ?? "unset"}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Usage {entry.monthlyQuotaUsed ?? 0}/{entry.monthlyQuotaLimit ?? 0}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Workspaces</CardTitle>
              <CardDescription>Latest workspaces and membership shape.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {(lookup.workspaces.length > 0 ? lookup.workspaces : response?.workspaces ?? []).map((workspace) => (
                <div key={workspace.id} className="rounded-lg border border-border/60 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-foreground">{workspace.name}</span>
                    <Badge variant="outline">{workspace.slug}</Badge>
                    {workspace.isPersonal ? <Badge variant="secondary">Personal</Badge> : null}
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    Org {workspace.organization?.name ?? "—"} · Members {workspace._count?.members ?? 0} · Scans {workspace._count?.scans ?? 0} · Created {formatDate(workspace.createdAt)}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Scan health and lookup</CardTitle>
              <CardDescription>Most recent scans and support-facing search results.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {(lookup.scans.length > 0 ? lookup.scans : response?.scans ?? []).map((scan) => (
                <div key={scan.id} className="rounded-lg border border-border/60 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{scan.status}</Badge>
                    <span className="font-medium text-foreground">{scan.inputRef}</span>
                    <span className="text-xs text-muted-foreground">{scan.inputType}</span>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    Scan {scan.id.slice(0, 8)} · Plan {scan.planAtSubmission} · User {scan.user?.email ?? scan.userId} · Workspace {scan.workspace?.name ?? scan.workspaceId ?? "—"} · Findings {(scan._count?.findings ?? 0).toString()}
                  </div>
                  <div className="mt-3">
                    <Button asChild variant="outline" size="sm">
                      <WaspRouterLink to={routes.ScanDetailsRoute.build({ params: { scanId: scan.id } }) as any}>
                        Open scan
                      </WaspRouterLink>
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {lookup.query ? (
          <Card>
            <CardHeader>
              <CardTitle>Lookup results</CardTitle>
              <CardDescription>Matched users, workspaces, and scans for the current search term.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 xl:grid-cols-3">
              <div className="space-y-2">
                <div className="text-sm font-medium text-foreground">Users</div>
                {lookup.users.length > 0 ? lookup.users.map((entry) => (
                  <div key={entry.id} className="rounded-lg border border-border/60 p-3 text-sm">
                    <div className="font-medium">{entry.email}</div>
                    <div className="text-xs text-muted-foreground">{entry.username ? `@${entry.username} · ` : ""}{entry.isAdmin ? getAdminRoleLabel("admin") : getAdminRoleLabel("member")}</div>
                  </div>
                )) : <div className="text-sm text-muted-foreground">No matched users.</div>}
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium text-foreground">Workspaces</div>
                {lookup.workspaces.length > 0 ? lookup.workspaces.map((entry) => (
                  <div key={entry.id} className="rounded-lg border border-border/60 p-3 text-sm">
                    <div className="font-medium">{entry.name}</div>
                    <div className="text-xs text-muted-foreground">{entry.slug}</div>
                  </div>
                )) : <div className="text-sm text-muted-foreground">No matched workspaces.</div>}
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium text-foreground">Scans</div>
                {lookup.scans.length > 0 ? lookup.scans.map((entry) => (
                  <div key={entry.id} className="rounded-lg border border-border/60 p-3 text-sm">
                    <div className="font-medium">{entry.inputRef}</div>
                    <div className="text-xs text-muted-foreground">{entry.id.slice(0, 8)} · {entry.status}</div>
                  </div>
                )) : <div className="text-sm text-muted-foreground">No matched scans.</div>}
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

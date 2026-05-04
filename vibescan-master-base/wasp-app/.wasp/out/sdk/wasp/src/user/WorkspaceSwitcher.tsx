import { AlertCircle, Building2, Loader2 } from "lucide-react";
import { routes } from "wasp/client/router";
import { getWorkspaceContext, switchWorkspace, useQuery } from "wasp/client/operations";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../client/components/ui/dropdown-menu";
import { useAsyncState } from "../client/hooks/useAsyncState";

type WorkspaceSummary = {
  id: string;
  name: string;
  slug: string;
  is_personal: boolean;
  role: "admin" | "member" | "viewer";
  organization: {
    id: string;
    name: string;
    slug: string;
    is_personal: boolean;
  };
  team: {
    id: string;
    name: string;
    slug: string;
    is_default: boolean;
  } | null;
};

type WorkspaceContextResponse = {
  active_workspace: WorkspaceSummary;
  workspaces: WorkspaceSummary[];
};

export function WorkspaceSwitcher({
  compact = false,
  onSwitched,
}: {
  compact?: boolean;
  onSwitched?: () => void;
}) {
  const { data, isLoading } = useQuery(getWorkspaceContext);
  const { isLoading: isSwitching, error, run } = useAsyncState();
  const context = (data ?? null) as WorkspaceContextResponse | null;
  const activeWorkspace = context?.active_workspace ?? null;
  const workspaces = context?.workspaces ?? [];

  const handleSwitch = async (workspaceId: string) => {
    if (!activeWorkspace || workspaceId === activeWorkspace.id) {
      return;
    }

    await run(
      async () => {
        await switchWorkspace({
          workspace_id: workspaceId,
        });
        onSwitched?.();
        window.location.assign(routes.DashboardRoute.to);
      },
      { errorMessage: "Failed to switch workspace." },
    );
  };

  if (isLoading || !activeWorkspace) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={`text-muted-foreground hover:text-foreground hover:bg-accent inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition ${
              compact ? "w-full justify-between rounded-md border border-border/60 bg-background px-3 py-2 text-sm" : ""
            }`}
            title={`${activeWorkspace.name} · ${activeWorkspace.organization.name}`}
          >
            <Building2 className="h-3.5 w-3.5 shrink-0" />
            <span className="max-w-[10rem] truncate">
              {activeWorkspace.name}
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-80">
          <DropdownMenuLabel>Switch workspace</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup
            value={activeWorkspace.id}
            onValueChange={(value) => void handleSwitch(value)}
          >
            {workspaces.map((workspace) => (
              <DropdownMenuRadioItem
                key={workspace.id}
                value={workspace.id}
                disabled={isSwitching}
                className="items-start"
              >
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span>{workspace.name}</span>
                    {workspace.is_personal ? (
                      <span className="text-muted-foreground text-[10px] uppercase tracking-wide">
                        Personal
                      </span>
                    ) : null}
                  </div>
                  <span className="text-muted-foreground text-xs">
                    {workspace.organization.name} · {workspace.role}
                  </span>
                </div>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      {isSwitching && (
        <div className="text-muted-foreground flex items-center gap-2 text-xs">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Switching...
        </div>
      )}
      {error && (
        <div className="text-destructive flex items-start gap-2 text-xs">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

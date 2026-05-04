import { useAuth } from "wasp/client/auth";
import { cn } from "../../utils";
import DarkModeSwitcher from "../DarkModeSwitcher";
import { WorkspaceSwitcher } from "../../../user/WorkspaceSwitcher";

export function TopBar({ workspaceLabel }: { workspaceLabel: string | null }) {
  const { data: user, isLoading } = useAuth();

  return (
    <header className="bg-background/80 border-border sticky top-0 z-40 flex h-16 items-center border-b backdrop-blur-lg">
      <div className="flex w-full items-center justify-between px-4 lg:px-6">
        <div className="min-w-0">
          {workspaceLabel ? (
            <div className="text-foreground truncate text-sm font-medium">
              {workspaceLabel}
            </div>
          ) : null}
        </div>
        <div className="flex items-center justify-end gap-3">
          <DarkModeSwitcher />
          <div className={cn(isLoading || !user ? "hidden" : "block")}>
            <WorkspaceSwitcher />
          </div>
        </div>
      </div>
    </header>
  );
}


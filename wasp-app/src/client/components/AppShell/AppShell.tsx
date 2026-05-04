import { ReactNode, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router";
import { useAuth } from "wasp/client/auth";
import { routes } from "wasp/client/router";
import type { NavigationItem } from "../NavBar/NavBar";
import { cn } from "../../utils";
import { SidebarNav } from "./SidebarNav";
import { TopBar } from "./TopBar";

export function AppShell({
  navigationItems,
  children,
}: {
  navigationItems: NavigationItem[];
  children: ReactNode;
}) {
  const { data: user } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("app.sidebar.collapsed");
    setCollapsed(stored === "1");
  }, []);

  useEffect(() => {
    localStorage.setItem("app.sidebar.collapsed", collapsed ? "1" : "0");
  }, [collapsed]);

  const activeWorkspaceLabel = useMemo(() => {
    if (location.pathname === routes.DashboardRoute.to || location.pathname === "/") {
      return "Dashboard";
    }
    return null;
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen">
      <aside
        className={cn(
          "bg-background/80 border-border flex shrink-0 flex-col border-r backdrop-blur-lg",
          collapsed ? "w-[4.5rem]" : "w-72",
        )}
      >
        <SidebarNav
          navigationItems={navigationItems}
          user={user ?? null}
          collapsed={collapsed}
          onToggleCollapsed={() => setCollapsed((prev) => !prev)}
        />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar workspaceLabel={activeWorkspaceLabel} />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}


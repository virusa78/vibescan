import {
  ChevronLeft,
  ChevronRight,
  LogIn,
  LogOut,
} from "lucide-react";
import { useMemo } from "react";
import { useLocation } from "react-router";
import { logout } from "wasp/client/auth";
import { Link as WaspRouterLink, routes } from "wasp/client/router";
import { type User } from "wasp/entities";
import { cn } from "../../utils";
import { Avatar, AvatarFallback } from "../ui/avatar";
import type { NavigationItem } from "../NavBar/NavBar";
import logo from "../../static/logo.webp";

export function SidebarNav({
  navigationItems,
  user,
  collapsed,
  onToggleCollapsed,
}: {
  navigationItems: NavigationItem[];
  user: Partial<User> | null;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  const location = useLocation();

  const items = useMemo(() => {
    const pathname = location.pathname;

    return navigationItems.map((item) => {
      if (item.to.startsWith("http")) {
        return { ...item, isActive: false };
      }

      if (item.to === routes.DashboardRoute.to) {
        return {
          ...item,
          isActive: pathname === "/" || pathname === routes.DashboardRoute.to || pathname.startsWith("/dashboard/"),
        };
      }

      return {
        ...item,
        isActive: pathname === item.to || pathname.startsWith(`${item.to}/`),
      };
    });
  }, [location.pathname, navigationItems]);

  const initials = useMemo(() => {
    const name = (user?.username ?? "").trim();
    if (!name) return "?";
    return name.slice(0, 1).toUpperCase();
  }, [user?.username]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className={cn("border-border flex h-16 items-center border-b px-3", collapsed ? "justify-center" : "justify-between")}>
        <WaspRouterLink
          to={routes.DashboardRoute.to}
          className={cn("text-foreground hover:text-primary flex items-center gap-2 transition-colors", collapsed && "justify-center")}
        >
          <img className="size-8" src={logo} alt="App logo" />
          {!collapsed && (
            <span className="text-foreground text-sm font-semibold tracking-tight">
              VibeScan
            </span>
          )}
        </WaspRouterLink>
        <button
          type="button"
          onClick={onToggleCollapsed}
          className={cn(
            "text-muted-foreground hover:text-foreground hover:bg-accent inline-flex items-center justify-center rounded-md p-2 transition-colors",
            collapsed && "hidden",
          )}
          aria-label="Collapse sidebar"
        >
          <ChevronLeft className="size-4" />
        </button>
        <button
          type="button"
          onClick={onToggleCollapsed}
          className={cn(
            "text-muted-foreground hover:text-foreground hover:bg-accent hidden items-center justify-center rounded-md p-2 transition-colors",
            collapsed && "inline-flex",
          )}
          aria-label="Expand sidebar"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-3" aria-label="Primary">
        <ul className="space-y-1">
          {items.map((item) => {
            const itemStyles = cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              item.isActive
                ? "bg-accent text-accent-foreground"
                : "text-foreground hover:bg-accent/60 hover:text-foreground",
              collapsed && "justify-center px-2",
            );

            return (
              <li key={item.name}>
                <WaspRouterLink
                  to={item.to}
                  className={itemStyles}
                  title={collapsed ? item.name : undefined}
                >
                  {item.icon ? <item.icon className="size-5 shrink-0" aria-hidden="true" /> : null}
                  {!collapsed && <span className="truncate">{item.name}</span>}
                </WaspRouterLink>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-border border-t p-3">
        {!user ? (
          <WaspRouterLink
            to={routes.LoginRoute.to}
            className={cn(
              "text-foreground hover:bg-accent hover:text-foreground flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              collapsed && "justify-center px-2",
            )}
            title={collapsed ? "Log in" : undefined}
          >
            <LogIn className="size-5 shrink-0" aria-hidden="true" />
            {!collapsed && <span>Log in</span>}
          </WaspRouterLink>
        ) : (
          <div className={cn("flex items-center gap-3", collapsed && "flex-col items-stretch gap-2")}>
            <div className={cn("flex min-w-0 flex-1 items-center gap-3", collapsed && "justify-center")}>
              <Avatar className="h-9 w-9">
                <AvatarFallback className="text-xs font-semibold">{initials}</AvatarFallback>
              </Avatar>
              {!collapsed && (
                <div className="min-w-0">
                  <div className="text-foreground truncate text-sm font-medium">
                    {user.username}
                  </div>
                  <WaspRouterLink
                    to={routes.SettingsRoute.to}
                    className="text-muted-foreground hover:text-foreground text-xs transition-colors"
                  >
                    Settings
                  </WaspRouterLink>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => logout()}
              className={cn(
                "text-muted-foreground hover:text-foreground hover:bg-accent inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                collapsed && "w-full px-2",
              )}
              aria-label="Log out"
              title={collapsed ? "Log out" : undefined}
            >
              <LogOut className="size-4" aria-hidden="true" />
              {!collapsed && <span>Logout</span>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

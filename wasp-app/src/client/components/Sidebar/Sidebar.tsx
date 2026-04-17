import { Link as WaspRouterLink, routes } from "wasp/client/router";
import { useAuth } from "wasp/client/auth";
import {
  LayoutDashboard,
  FileText,
  Settings,
  MoreVertical,
} from "lucide-react";
import { cn } from "../../utils";
import logo from "../../static/logo.webp";
import { useLocation } from "react-router";

interface SidebarItem {
  name: string;
  icon: React.ReactNode;
  to: string;
}

export default function Sidebar() {
  const { data: user } = useAuth();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  const sidebarItems: SidebarItem[] = [
    {
      name: "Dashboard",
      icon: <LayoutDashboard size={20} />,
      to: routes.DashboardRoute.to,
    },
    {
      name: "Scans",
      icon: <FileText size={20} />,
      to: routes.NewScanRoute.to,
    },
    {
      name: "Settings",
      icon: <Settings size={20} />,
      to: routes.SettingsRoute.to,
    },
    {
      name: "Pricing",
      icon: <MoreVertical size={20} />,
      to: routes.PricingPageRoute.to,
    },
  ];

  return (
    <aside className="fixed left-0 top-0 h-screen w-56 bg-background border-r border-border/50 flex flex-col overflow-y-auto">
      {/* Logo */}
      <div className="p-6 border-b border-border/30">
        <WaspRouterLink to={routes.DashboardRoute.to} className="flex items-center gap-2">
          <img src={logo} alt="VibeScan" className="w-8 h-8" />
          <span className="text-foreground font-semibold">VibeScan</span>
        </WaspRouterLink>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 p-4 space-y-2">
        {sidebarItems.map((item) => (
          <WaspRouterLink
            key={item.name}
            to={item.to as any}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors duration-200",
              isActive(item.to)
                ? "bg-primary/20 text-primary border-l-2 border-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/10",
            )}
          >
            {item.icon}
            <span className="text-sm font-medium">{item.name}</span>
          </WaspRouterLink>
        ))}
      </nav>

      {/* User Profile */}
      {user && (
        <div className="border-t border-border/30 p-4 space-y-3">
          <div className="px-4 py-2 rounded-lg bg-accent/10">
            <p className="text-sm font-medium text-foreground truncate">
              {user.username || user.email}
            </p>
            <p className="text-xs text-muted-foreground capitalize">
              {user.plan || "Free"} Plan
            </p>
          </div>
        </div>
      )}
    </aside>
  );
}

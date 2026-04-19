import { LayoutDashboard, PlusCircle, Settings, Key } from "lucide-react";
import { routes } from "wasp/client/router";

export const userMenuItems = [
  {
    name: "Dashboard",
    to: routes.DashboardRoute.to,
    icon: LayoutDashboard,
    isAdminOnly: false,
    isAuthRequired: true,
  },
  {
    name: "New Scan",
    to: routes.NewScanRoute.to,
    icon: PlusCircle,
    isAdminOnly: false,
    isAuthRequired: true,
  },
  {
    name: "User Settings",
    to: routes.SettingsRoute.to,
    icon: Settings,
    isAuthRequired: false,
    isAdminOnly: false,
  },
  {
    name: "API Keys",
    to: routes.ApiKeysRoute.to,
    icon: Key,
    isAuthRequired: true,
    isAdminOnly: false,
  },
] as const;

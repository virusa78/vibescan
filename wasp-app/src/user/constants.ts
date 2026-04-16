import { LayoutDashboard, PlusCircle, Settings, Shield } from "lucide-react";
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
    name: "Admin Dashboard",
    to: routes.AdminRoute.to,
    icon: Shield,
    isAuthRequired: false,
    isAdminOnly: true,
  },
] as const;

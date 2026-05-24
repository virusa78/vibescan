import { Settings, Shield } from "lucide-react";
import { routes } from "wasp/client/router";
import { userMenuLabels } from "../client/components/NavBar/navigationConfig";

export const userMenuItems = [
  {
    name: userMenuLabels[0],
    to: routes.SettingsRoute.to,
    icon: Settings,
    isAuthRequired: false,
    isAdminOnly: false,
  },
  {
    name: userMenuLabels[1],
    to: routes.AdminPageRoute.to,
    icon: Shield,
    isAuthRequired: true,
    isAdminOnly: true,
  },
] as const;

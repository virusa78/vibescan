import { Settings } from "lucide-react";
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
] as const;

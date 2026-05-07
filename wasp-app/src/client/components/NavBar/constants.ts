import { LayoutDashboard, PlusCircle, Key, FileText, Newspaper, Settings } from "lucide-react";
import { routes } from "wasp/client/router";
import { BlogUrl, DocsUrl } from "../../../shared/common";
import type { NavigationItem } from "./NavBar";
import { appNavigationLabels } from "./navigationConfig";

const appNavigationSource: NavigationItem[] = [
  { name: appNavigationLabels[0], to: routes.DashboardRoute.to, icon: LayoutDashboard },
  { name: appNavigationLabels[1], to: routes.NewScanRoute.to, icon: PlusCircle },
  { name: appNavigationLabels[2], to: routes.ApiKeysRoute.to, icon: Key },
  { name: appNavigationLabels[3], to: routes.SettingsRoute.to, icon: Settings },
];

const staticNavigationItems: NavigationItem[] = [
  { name: "Documentation", to: DocsUrl, icon: FileText },
  { name: "Blog", to: BlogUrl, icon: Newspaper },
];

export const appNavigationItems: NavigationItem[] = appNavigationSource;

export const marketingNavigationItems: NavigationItem[] = [
  { name: "Features", to: "/#features" },
  { name: "Pricing", to: routes.PricingPageRoute.to },
  ...staticNavigationItems,
] as const;

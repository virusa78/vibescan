import { routes } from "wasp/client/router";
import { BlogUrl, DocsUrl } from "../../../shared/common";
import type { NavigationItem } from "./NavBar";
import { appNavigationLabels } from "./navigationConfig";
import { KeyRound, LayoutDashboard, ScanSearch } from "lucide-react";

const appNavigationSource: NavigationItem[] = [
  { name: appNavigationLabels[0], to: routes.DashboardRoute.to, icon: LayoutDashboard },
  { name: appNavigationLabels[1], to: routes.NewScanRoute.to, icon: ScanSearch },
  { name: appNavigationLabels[2], to: routes.ApiKeysRoute.to, icon: KeyRound },
];

const staticNavigationItems: NavigationItem[] = [
  { name: "Documentation", to: DocsUrl },
  { name: "Blog", to: BlogUrl },
];

export const appNavigationItems: NavigationItem[] = appNavigationSource;

export const marketingNavigationItems: NavigationItem[] = [
  { name: "Features", to: "/#features" },
  { name: "Pricing", to: routes.PricingPageRoute.to },
  ...staticNavigationItems,
] as const;

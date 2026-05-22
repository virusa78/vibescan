import { routes } from "wasp/client/router";
import { BlogUrl, DocsUrl } from "../../../shared/common";
import { appNavigationLabels } from "./navigationConfig";
const appNavigationSource = [
    { name: appNavigationLabels[0], to: routes.DashboardRoute.to },
    { name: appNavigationLabels[1], to: routes.NewScanRoute.to },
    { name: appNavigationLabels[2], to: routes.ApiKeysRoute.to },
];
const staticNavigationItems = [
    { name: "Documentation", to: DocsUrl },
    { name: "Blog", to: BlogUrl },
];
export const appNavigationItems = appNavigationSource;
export const marketingNavigationItems = [
    { name: "Features", to: "/#features" },
    { name: "Pricing", to: routes.PricingPageRoute.to },
    ...staticNavigationItems,
];
//# sourceMappingURL=constants.js.map
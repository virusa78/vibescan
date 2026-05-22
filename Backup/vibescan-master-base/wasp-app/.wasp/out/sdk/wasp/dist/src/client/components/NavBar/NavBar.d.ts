import { type LucideIcon } from "lucide-react";
export interface NavigationItem {
    name: string;
    to: string;
    icon?: LucideIcon;
}
export default function NavBar({ navigationItems, }: {
    navigationItems: NavigationItem[];
}): import("react").JSX.Element;
//# sourceMappingURL=NavBar.d.ts.map
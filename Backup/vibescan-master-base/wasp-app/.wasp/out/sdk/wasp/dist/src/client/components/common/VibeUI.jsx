import * as React from "react";
import { SquareArrowOutUpRight } from "lucide-react";
import { cn } from "../../utils";
export function Link({ children, className, withIcon = true, rel, target, ...props }) {
    const resolvedTarget = target ?? "_blank";
    const resolvedRel = rel ?? "noopener noreferrer";
    return (<a {...props} target={resolvedTarget} rel={resolvedRel} className={cn("inline-flex items-center gap-1 rounded-sm transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-1 focus-visible:ring-offset-background", className)}>
      <span>{children}</span>
      {withIcon ? <SquareArrowOutUpRight className="h-3 w-3" aria-hidden="true"/> : null}
    </a>);
}
//# sourceMappingURL=VibeUI.jsx.map
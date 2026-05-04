import * as React from "react";
import { cn } from "../../utils";
function Skeleton({ className, ...props }) {
    return (<div data-slot="skeleton" className={cn("animate-pulse rounded-md bg-muted/70", className)} {...props}/>);
}
export { Skeleton };
//# sourceMappingURL=skeleton.jsx.map
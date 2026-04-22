import * as React from "react";
import { SquareArrowOutUpRight } from "lucide-react";
import { cn } from "../../utils";

type ExternalLinkProps = React.ComponentProps<"a"> & {
  withIcon?: boolean;
};

export function Link({
  children,
  className,
  withIcon = true,
  rel,
  target,
  ...props
}: ExternalLinkProps) {
  const resolvedTarget = target ?? "_blank";
  const resolvedRel = rel ?? "noopener noreferrer";

  return (
    <a
      {...props}
      target={resolvedTarget}
      rel={resolvedRel}
      className={cn("inline-flex items-center gap-1 hover:underline", className)}
    >
      <span>{children}</span>
      {withIcon ? <SquareArrowOutUpRight className="h-3 w-3" aria-hidden="true" /> : null}
    </a>
  );
}

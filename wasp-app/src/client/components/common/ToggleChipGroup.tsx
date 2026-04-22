import { Button } from "../ui/button";
import { cn } from "../../utils";

type ToggleChipOption = {
  value: string;
  label: string;
  count?: number;
};

interface ToggleChipGroupProps {
  options: ToggleChipOption[];
  value: string;
  onChange: (next: string) => void;
  className?: string;
}

export function ToggleChipGroup({
  options,
  value,
  onChange,
  className,
}: ToggleChipGroupProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Button
            key={option.value}
            type="button"
            size="sm"
            variant={active ? "default" : "outline"}
            onClick={() => onChange(option.value)}
            className={cn("h-7 rounded-full px-3 text-xs", active && "shadow-sm")}
          >
            {option.label}
            {typeof option.count === "number" ? ` (${option.count})` : ""}
          </Button>
        );
      })}
    </div>
  );
}

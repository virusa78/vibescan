import { Button } from '../ui/button';
import { cn } from '../../utils';
export function ToggleChipGroup({ options, value, onChange, className, ariaLabel, }) {
    return (<div className={cn('flex flex-wrap items-center gap-2', className)} role="group" aria-label={ariaLabel}>
      {options.map((option) => {
            const active = option.value === value;
            const countSuffix = typeof option.count === 'number' ? ` (${option.count})` : '';
            return (<Button key={option.value} type="button" size="sm" variant={active ? 'default' : 'outline'} onClick={() => onChange(option.value)} className={cn('h-7 rounded-full px-3 text-xs', active && 'shadow-sm')} aria-pressed={active} aria-label={`${option.label}${countSuffix}`}>
            {option.label}
            {countSuffix}
          </Button>);
        })}
    </div>);
}
//# sourceMappingURL=ToggleChipGroup.jsx.map
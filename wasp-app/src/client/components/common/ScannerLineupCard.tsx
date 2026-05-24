import { Badge } from '../ui/badge';
import { Checkbox } from '../ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import {
  getScannerLineupEntry,
  type ScannerSource,
} from '../../utils/scannerLineup';
import {
  getScannerResultLabel,
  getScannerSelectionLabel,
} from '../../utils/scannerStatusVocabulary';
import { CheckCircle2, Circle, Clock, XCircle } from 'lucide-react';
import type { ScannerLineupStatus } from '../../../dashboard/scanLineupStatus';

interface ScannerLineupCardProps {
  sources: ScannerSource[];
  statusBySource?: Partial<Record<ScannerSource, ScannerLineupStatus>>;
  selectionMode?: boolean;
  selectedBySource?: Partial<Record<ScannerSource, boolean>>;
  selectableBySource?: Partial<Record<ScannerSource, boolean>>;
  disabledReasonBySource?: Partial<Record<ScannerSource, string | null>>;
  onToggleSource?: (source: ScannerSource) => void;
  title?: string;
  subtitle?: string;
  className?: string;
}

export function ScannerLineupCard({
  sources,
  statusBySource,
  selectionMode = false,
  selectedBySource,
  selectableBySource,
  disabledReasonBySource,
  onToggleSource,
  title = 'Parallel scanners',
  subtitle = 'The backend fans this scan out across independent lanes.',
  className,
}: ScannerLineupCardProps) {
  if (sources.length === 0) {
    return null;
  }

  return (
    <Card className={className ?? 'border-border/70 bg-card/90 shadow-sm'}>
      <CardHeader className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <CardTitle>{title}</CardTitle>
          <Badge variant="secondary" className="rounded-full">
            {selectionMode
              ? `${sources.filter((source) => selectedBySource?.[source]).length} selected`
              : `${sources.length} lanes`}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </CardHeader>
      <CardContent>
        <div className={`grid gap-3 ${sources.length > 4 ? 'lg:grid-cols-5' : 'sm:grid-cols-2 lg:grid-cols-4'}`}>
          {sources.map((source) => {
            const entry = getScannerLineupEntry(source);
            const status = statusBySource?.[source] ?? 'planned';
            const selected = selectedBySource?.[source] ?? false;
            const selectable = selectableBySource?.[source] ?? true;
            const disabledReason = disabledReasonBySource?.[source] ?? null;
            const isCoolingDown = !selectable && !!disabledReason?.toLowerCase().includes('cool');
            const statusLabel = selectionMode
              ? getScannerSelectionLabel({
                selected,
                status: isCoolingDown
                  ? 'cooling_down'
                  : selectable
                    ? 'available'
                    : 'unavailable',
              })
              : getScannerResultLabel(status);
            const StatusIcon = selectionMode
              ? selected
                ? CheckCircle2
                : isCoolingDown
                  ? Clock
                  : selectable
                    ? Circle
                    : XCircle
                : status === 'completed'
                  ? CheckCircle2
                  : status === 'failed'
                    ? XCircle
                    : Clock;
            const statusClassName = selectionMode
              ? selected
                ? 'border-primary/30 bg-primary/10 text-primary'
                : isCoolingDown
                  ? 'border-amber-500/30 bg-amber-500/10 text-amber-700'
                  : selectable
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700'
                    : 'border-slate-500/30 bg-slate-500/10 text-slate-700'
              : status === 'completed'
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700'
                : status === 'failed'
                  ? 'border-red-500/30 bg-red-500/10 text-red-700'
                  : status === 'missing'
                    ? 'border-amber-500/30 bg-amber-500/10 text-amber-700'
                    : 'border-slate-500/30 bg-slate-500/10 text-slate-700';
            const cardClassName = selectionMode
              ? selected
                ? 'rounded-xl border border-primary/30 bg-primary/5 p-3'
                : isCoolingDown
                  ? 'rounded-xl border p-3 border-amber-500/30 bg-amber-500/10 text-amber-700'
                  : selectable
                    ? 'rounded-xl border border-border/70 bg-background p-3'
                    : 'rounded-xl border p-3 border-slate-500/30 bg-slate-500/10 text-slate-700'
              : status === 'missing'
                ? 'rounded-xl border p-3 border-amber-500/30 bg-amber-500/10 text-amber-700'
                : status === 'failed'
                  ? 'rounded-xl border p-3 border-red-500/30 bg-red-500/10 text-red-700'
                  : `rounded-xl border p-3 ${entry.badgeClassName}`;

            return (
              <div
                key={source}
                className={cardClassName}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {selectionMode ? (
                        <Checkbox
                          checked={selected}
                          disabled={!selectable}
                          onCheckedChange={() => onToggleSource?.(source)}
                          aria-label={`${selected ? 'Deselect' : 'Select'} ${entry.label}`}
                        />
                      ) : null}
                      <span className="truncate text-sm font-semibold">{entry.label}</span>
                    </div>
                    {selectionMode && disabledReason ? (
                      <p className="mt-2 text-xs leading-5 opacity-80">{disabledReason}</p>
                    ) : null}
                  </div>
                  <Badge variant="outline" className={`inline-flex items-center gap-1 whitespace-nowrap text-[10px] uppercase tracking-wide ${statusClassName}`}>
                    <StatusIcon className="size-3" aria-hidden="true" />
                    <span>{statusLabel}</span>
                  </Badge>
                </div>
                <p className="mt-2 text-xs leading-5 opacity-80">{entry.description}</p>
                <p className="mt-2 text-[10px] uppercase tracking-wide opacity-70">{entry.source}</p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

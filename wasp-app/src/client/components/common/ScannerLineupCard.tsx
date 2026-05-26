import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import {
  getScannerLineupEntry,
  type ScannerSource,
} from '../../utils/scannerLineup';
import {
  getScannerResultLabel,
  getScannerSelectionLabel,
} from '../../utils/scannerStatusVocabulary';
import { CheckCircle2, Circle, Clock, XCircle, Check } from 'lucide-react';
import type { ScannerLineupStatus } from '../../../dashboard/scanLineupStatus';
import {
  getScannerBadgeClass,
  getScannerCardClass,
  getScannerLetter,
  getScannerSelectionAriaLabel,
  getScannerConfig,
  STRIPE_THICKNESS_CLASS,
} from '../../utils/scannerColors';

interface ScannerLineupCardProps {
  sources: ScannerSource[];
  statusBySource?: Partial<Record<ScannerSource, ScannerLineupStatus>>;
  selectionMode?: boolean;
  selectedBySource?: Partial<Record<ScannerSource, boolean>>;
  selectableBySource?: Partial<Record<ScannerSource, boolean>>;
  disabledReasonBySource?: Partial<Record<ScannerSource, string | null>>;
  // which sources are recommended for the current input type (used to highlight stripe)
  recommendedBySource?: Partial<Record<ScannerSource, boolean>>;
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
  recommendedBySource,
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
        <div className={`grid gap-4 ${sources.length > 3 ? 'lg:grid-cols-4' : 'sm:grid-cols-2 lg:grid-cols-3'}`}>
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

            // Use centralized scanner color classes when available
            const scannerBadgeClass = getScannerBadgeClass(entry.source);
            const scannerConfig = getScannerConfig(entry.source);

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
                    : 'border-border/60 bg-background text-muted-foreground';

            // Shared config for stripe
            const recommended = recommendedBySource?.[entry.source] ?? false;
            const baseStripe = scannerConfig?.bgColor ?? 'bg-slate-200';
            const stripeEnhance = recommended ? 'ring-2 ring-offset-1 ring-primary/20' : '';
            const stripeClass = `${baseStripe} ${stripeEnhance}`;

            if (selectionMode) {
              const selectionCardClass = !selectable
                ? 'rounded-xl border border-border/40 bg-muted/30 p-0 text-muted-foreground opacity-70 min-h-[140px]'
                : selected
                  ? 'rounded-xl border border-primary/30 bg-primary/5 p-0 text-left transition min-h-[140px]'
                  : 'rounded-xl border border-border/30 bg-background p-0 text-left transition hover:border-border hover:bg-accent/6 min-h-[140px]';

              // compact, consistent card: small colored stripe on the left, content on the right
              return (
                <button
                  key={source}
                  type="button"
                  onClick={() => selectable && onToggleSource?.(source)}
                  disabled={!selectable}
                  aria-pressed={selected}
                  aria-label={getScannerSelectionAriaLabel({ scanner: entry.source, selected })}
                  title={`${entry.label}${disabledReason ? ` — ${disabledReason}` : ''}`}
                  className={`group flex items-stretch gap-0 overflow-hidden ${selectionCardClass}`}
                >
                  {/* left color stripe: thicker when selected */}
                  <span className={`${selected ? STRIPE_THICKNESS_CLASS : 'w-3 md:w-4'} ${stripeClass} mr-0 hidden sm:block rounded-l-xl`} aria-hidden="true" />

                  <div className="flex flex-col flex-1 p-4 gap-2">
                    <div className="flex items-start justify-between gap-2 w-full">
                      <div className="flex items-center gap-3">
                        <span className={`inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md border text-sm font-semibold ${scannerBadgeClass}`}>
                          {getScannerLetter(entry.source)}
                        </span>
                        <div className="text-sm font-semibold text-foreground text-left">{entry.label}</div>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* only show status badge for unavailable or cooling states; hide "SELECTED" badge to reduce clutter */}
                        {(!selectable || isCoolingDown) ? (
                          <Badge variant="outline" className={`inline-flex items-center gap-1 whitespace-nowrap text-[10px] uppercase tracking-wide ${statusClassName}`}>
                            <StatusIcon className="size-3" aria-hidden="true" />
                            <span>{statusLabel}</span>
                          </Badge>
                        ) : null}

                        <div className={`inline-flex items-center justify-center h-6 w-6 rounded-full border flex-shrink-0 ${selected ? 'bg-emerald-600 text-white border-emerald-600' : 'border-border bg-background text-transparent'}`}>
                          {selected ? <Check className="h-3 w-3" /> : null}
                        </div>
                      </div>
                    </div>

                    <div className="text-left w-full mt-1">
                      <p className="text-xs leading-5 text-muted-foreground">{entry.description}</p>
                      {disabledReason ? (
                        <p className="mt-1 text-xs leading-5 text-muted-foreground font-medium">{disabledReason}</p>
                      ) : null}
                    </div>
                  </div>
                </button>
              );
            }

            const cardClassName = status === 'missing'
              ? 'rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-700 p-0 flex items-stretch overflow-hidden min-h-[140px]'
              : status === 'failed'
                ? 'rounded-xl border border-red-500/30 bg-red-500/10 text-red-700 p-0 flex items-stretch overflow-hidden min-h-[140px]'
                : `rounded-xl border border-border/30 bg-background p-0 flex items-stretch overflow-hidden min-h-[140px]`;

            return (
              <div
                key={source}
                className={cardClassName}
              >
                {/* left color stripe for read-only view */}
                <span className={`${STRIPE_THICKNESS_CLASS} ${stripeClass} mr-0 hidden sm:block rounded-l-xl`} aria-hidden="true" />

                <div className="flex flex-col flex-1 p-4 gap-2">
                  <div className="flex items-start justify-between gap-2 w-full">
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md border text-sm font-semibold ${scannerBadgeClass}`}>
                        {getScannerLetter(entry.source)}
                      </span>
                      <span className="text-sm font-semibold text-foreground">{entry.label}</span>
                    </div>

                    <Badge variant="outline" className={`inline-flex items-center gap-1 whitespace-nowrap text-[10px] uppercase tracking-wide flex-shrink-0 ${statusClassName}`}>
                      <StatusIcon className="size-3" aria-hidden="true" />
                      <span>{statusLabel}</span>
                    </Badge>
                  </div>

                  <div className="text-left w-full mt-1 flex-1">
                    <p className="text-xs leading-5 text-muted-foreground">{entry.description}</p>
                  </div>

                  <p className="mt-auto text-[10px] uppercase tracking-wide opacity-70 pt-2">{entry.source}</p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

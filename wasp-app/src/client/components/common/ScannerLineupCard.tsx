import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import {
  getScannerLineupEntry,
  type ScannerSource,
} from '../../utils/scannerLineup';

type ScannerLineupStatus = 'planned' | 'completed' | 'missing';

interface ScannerLineupCardProps {
  sources: ScannerSource[];
  statusBySource?: Partial<Record<ScannerSource, ScannerLineupStatus>>;
  title?: string;
  subtitle?: string;
  className?: string;
}

export function ScannerLineupCard({
  sources,
  statusBySource,
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
            {sources.length} lanes
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </CardHeader>
      <CardContent>
        <div className={`grid gap-3 ${sources.length > 4 ? 'lg:grid-cols-5' : 'sm:grid-cols-2 lg:grid-cols-4'}`}>
          {sources.map((source) => {
            const entry = getScannerLineupEntry(source);
            const status = statusBySource?.[source] ?? 'planned';
            const statusLabel = status === 'completed' ? 'Completed' : status === 'missing' ? 'Missing' : 'Planned';
            const statusClassName =
              status === 'completed'
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700'
                : status === 'missing'
                  ? 'border-red-500/30 bg-red-500/10 text-red-700'
                  : 'border-slate-500/30 bg-slate-500/10 text-slate-700';
            const cardClassName =
              status === 'missing'
                ? 'rounded-xl border p-3 border-red-500/30 bg-red-500/10 text-red-700'
                : `rounded-xl border p-3 ${entry.badgeClassName}`;

            return (
              <div
                key={source}
                className={cardClassName}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">{entry.label}</span>
                  <Badge variant="outline" className={`text-[10px] uppercase tracking-wide ${statusClassName}`}>
                    {statusLabel}
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

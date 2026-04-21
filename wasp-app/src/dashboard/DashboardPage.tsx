import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Bug, TrendingUp, Zap } from 'lucide-react';
import { MetricCard } from '../client/components/common/MetricCard';
import { ScanTable } from '../client/components/common/ScanTable';
import { SeverityChart } from '../client/components/common/SeverityChart';
import { EmptyState } from '../client/components/common/EmptyState';
import { Card, CardContent, CardHeader, CardTitle } from '../client/components/ui/card';
import { useAsyncState } from '../client/hooks/useAsyncState';
import { api } from 'wasp/client/api';

interface Scan {
  id: string;
  status: string;
  inputType: string;
  inputRef: string;
  createdAt: Date;
  completedAt?: Date | null;
  findingsCount?: number;
  planAtSubmission?: string;
}

interface SeverityBreakdown {
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
  total: number;
}

type DashboardTimeRange = '7d' | '30d' | 'all';

interface TrendBucket {
  bucket_start: string;
  scans: number;
  findings: number;
  delta: number;
}

interface TrendSeriesResponse {
  time_range: DashboardTimeRange;
  granularity: 'day' | 'week';
  buckets: TrendBucket[];
  totals: {
    scans: number;
    findings: number;
    delta: number;
  };
}

export default function DashboardPage() {
  const [scans, setScans] = useState<Scan[]>([]);
  const { isLoading, error, run } = useAsyncState(true);
  const [timeRange, setTimeRange] = useState<DashboardTimeRange>('30d');
  const [severity, setSeverity] = useState<SeverityBreakdown>({
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
    total: 0,
  });
  const [quota, setQuota] = useState<{
    used: number;
    limit: number;
    percentage: number;
    monthly_reset_date?: string;
  } | null>(null);
  const [trends, setTrends] = useState<TrendSeriesResponse | null>(null);

  // Load data from API
  useEffect(() => {
    run(
      async () => {
        // Fetch scans from API
        const scansRes = await api.get('/api/v1/dashboard/recent-scans?limit=10');
        const scansData = scansRes.data;
        const formattedScans = (scansData.scans || []).map((scan: any) => {
          const createdAtValue = scan.createdAt ?? scan.created_at ?? Date.now();
          const completedAtValue = scan.completedAt ?? scan.completed_at;

          return {
          id: scan.id,
          status: scan.status,
          inputType: scan.inputType,
          inputRef: scan.inputRef,
          createdAt: new Date(createdAtValue),
          completedAt: completedAtValue ? new Date(completedAtValue) : null,
          findingsCount: scan.vulnerability_count ?? scan.findingsCount ?? 0,
          planAtSubmission: scan.planAtSubmission ?? scan.plan_at_submission,
          };
        });

        setScans(formattedScans);

        // Fetch additional data from API
        const [quotaRes, severityRes, trendsRes] = await Promise.all([
          api.get('/api/v1/dashboard/quota'),
          api.get('/api/v1/dashboard/severity-breakdown', {
            params: { time_range: timeRange },
          }),
          api.get('/api/v1/dashboard/trends', {
            params: { time_range: timeRange },
          }),
        ]);

        setQuota(quotaRes.data);

        setSeverity(severityRes.data);
        setTrends(trendsRes.data);
      },
      {
        errorMessage: 'Failed to load dashboard',
        onError: (err) => {
          console.error('Dashboard error:', err);
        },
      },
    );
  }, [run, timeRange]);

  // Calculate metrics
  const metrics = useMemo(() => {
    const completed = scans.filter(s => s.status === 'done' || s.status === 'completed');
    const totalVulnerabilities = completed.reduce((sum, s) => sum + (s.findingsCount || 0), 0);
    const running = scans.filter(s =>
      ['pending', 'scanning', 'running', 'queued'].includes(s.status.toLowerCase())
    ).length;

    const avgSeverity =
      severity.critical > 0
        ? 'Critical'
        : severity.high > 0
        ? 'High'
        : severity.medium > 0
        ? 'Medium'
        : 'Low';

    return {
      totalScans: completed.length,
      totalVulnerabilities,
      avgSeverity,
      runningScans: running,
    };
  }, [scans, severity]);

  // Format scans for table
  const tableScans = useMemo(
    () =>
      scans.map(scan => ({
        id: scan.id,
        status: scan.status,
        inputType: scan.inputType,
        inputRef: scan.inputRef,
        created_at: scan.createdAt.toISOString(),
        vulnerability_count: scan.findingsCount || 0,
      })),
    [scans]
  );

  const statCards = [
    {
      label: 'TOTAL SCANS',
      value: metrics.totalScans,
      subtext: 'Completed scans',
      icon: <BarChart3 className="text-primary" size={24} />,
      trend: {
        direction: 'up' as const,
        text: `${scans.length} total`,
      },
    },
    {
      label: 'VULNERABILITIES',
      value: metrics.totalVulnerabilities,
      subtext: `Avg: ${metrics.avgSeverity}`,
      icon: <Bug className="text-red-500" size={24} />,
      trend: severity.critical > 0
        ? {
            direction: 'up' as const,
            text: `${severity.critical} critical`,
          }
        : undefined,
    },
    {
      label: 'CRITICAL FINDINGS',
      value: severity.critical,
      subtext: `High: ${severity.high}`,
      icon: <TrendingUp className="text-red-500" size={24} />,
    },
    {
      label: 'ACTIVE SCANS',
      value: metrics.runningScans,
      subtext: 'Running/pending',
      icon: <Zap className="text-yellow-500" size={24} />,
    },
  ];

  const visibleTrendBuckets = useMemo(
    () => (trends?.buckets ?? []).slice(-12),
    [trends],
  );
  const maxTrendValue = useMemo(() => {
    return visibleTrendBuckets.reduce((max, bucket) => {
      return Math.max(max, bucket.scans, bucket.findings, bucket.delta);
    }, 1);
  }, [visibleTrendBuckets]);

  return (
    <div className="p-8 lg:p-10">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-foreground text-4xl font-bold tracking-tight mb-2">Dashboard</h1>
          <p className="text-muted-foreground">Monitor your vulnerability scans and security metrics</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-md border border-border/60 bg-card/40 p-1">
          {(['7d', '30d', 'all'] as DashboardTimeRange[]).map((range) => (
            <button
              key={range}
              type="button"
              className={`rounded px-3 py-1 text-xs font-medium transition ${
                timeRange === range
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setTimeRange(range)}
            >
              {range.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="mb-6 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-600">
          {error}
          <button
            onClick={() => window.location.reload()}
            className="ml-3 underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map(stat => (
          <MetricCard
            key={stat.label}
            label={stat.label}
            value={stat.value}
            subtext={stat.subtext}
            icon={stat.icon}
            trend={stat.trend}
            loading={isLoading}
          />
        ))}
      </div>

      {/* Trend Series */}
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm mb-8">
        <CardHeader>
          <CardTitle className="text-sm">
            Security Trends ({(trends?.granularity ?? 'day').toUpperCase()} buckets)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <div className="h-4 bg-muted rounded animate-pulse" />
              <div className="h-4 bg-muted rounded animate-pulse" />
              <div className="h-4 bg-muted rounded animate-pulse" />
            </div>
          ) : visibleTrendBuckets.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No trend data available for selected range.
            </p>
          ) : (
            <div className="space-y-3">
              {visibleTrendBuckets.map((bucket) => {
                const label = new Date(bucket.bucket_start).toLocaleDateString();
                const scansWidth = Math.round((bucket.scans / maxTrendValue) * 100);
                const findingsWidth = Math.round((bucket.findings / maxTrendValue) * 100);
                const deltaWidth = Math.round((bucket.delta / maxTrendValue) * 100);

                return (
                  <div key={bucket.bucket_start} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="text-foreground">
                        scans {bucket.scans} · findings {bucket.findings} · delta {bucket.delta}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="h-2 rounded bg-border/30">
                        <div className="h-2 rounded bg-blue-500/80" style={{ width: `${scansWidth}%` }} />
                      </div>
                      <div className="h-2 rounded bg-border/30">
                        <div className="h-2 rounded bg-red-500/80" style={{ width: `${findingsWidth}%` }} />
                      </div>
                      <div className="h-2 rounded bg-border/30">
                        <div className="h-2 rounded bg-amber-500/80" style={{ width: `${deltaWidth}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Charts & Sidebar Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Severity Chart */}
        <div className="lg:col-span-2">
          <SeverityChart data={severity} loading={isLoading} />
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          {/* Quota Card */}
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-sm">Quota Usage</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoading ? (
                <div className="space-y-2">
                  <div className="h-4 bg-muted rounded animate-pulse"></div>
                  <div className="h-2 bg-muted rounded animate-pulse"></div>
                </div>
              ) : quota ? (
                <>
                  <div>
                    <div className="flex justify-between text-xs mb-2">
                      <span className="text-foreground">
                        {quota.used} / {quota.limit} scans
                      </span>
                      <span className="text-primary font-medium">
                        {Math.max(quota.limit - quota.used, 0)} left
                      </span>
                    </div>
                    <div className="w-full bg-border/30 rounded-full h-2">
                      <div
                        className="bg-primary rounded-full h-2 transition-all"
                        style={{ width: `${Math.min(quota.percentage, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                  {quota.monthly_reset_date && (
                    <p className="text-xs text-muted-foreground">
                      Resets {new Date(quota.monthly_reset_date).toLocaleDateString()}
                    </p>
                  )}
                </>
              ) : null}
            </CardContent>
          </Card>

          {/* Severity Summary Card */}
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-sm">Severity Counts</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-primary mb-3">{severity.total}</p>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs">
                  <span className="px-2 py-1 border border-red-500/50 text-red-500 rounded bg-red-500/5">
                    {severity.critical} Critical
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="px-2 py-1 border border-orange-500/50 text-orange-500 rounded bg-orange-500/5">
                    {severity.high} High
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="px-2 py-1 border border-yellow-500/50 text-yellow-500 rounded bg-yellow-500/5">
                    {severity.medium} Medium
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="px-2 py-1 border border-green-500/50 text-green-500 rounded bg-green-500/5">
                    {severity.low} Low
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recent Scans Table or Empty State */}
      {scans.length === 0 && !isLoading ? (
        <EmptyState
          title="No scans yet"
          description="Submit your first vulnerability scan to see results here"
          actionLabel="Create First Scan"
          actionRoute="/new-scan"
        />
      ) : (
        <ScanTable
          scans={tableScans}
          loading={isLoading}
          onRefresh={() => window.location.reload()}
        />
      )}
    </div>
  );
}

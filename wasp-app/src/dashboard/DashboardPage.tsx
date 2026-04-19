import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { BarChart3, Bug, TrendingUp, Zap } from 'lucide-react';
import { MetricCard } from '../client/components/common/MetricCard';
import { ScanTable } from '../client/components/common/ScanTable';
import { SeverityChart } from '../client/components/common/SeverityChart';
import { EmptyState } from '../client/components/common/EmptyState';
import { Card, CardContent, CardHeader, CardTitle } from '../client/components/ui/card';
import { useAsyncState } from '../client/hooks/useAsyncState';
import { api } from 'wasp/client/api';
import {
  getStatusBadge,
  getScanTypeDisplay,
  formatRelativeTime,
} from '../client/utils/severity';

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

export default function DashboardPage() {
  const navigate = useNavigate();
  const [scans, setScans] = useState<Scan[]>([]);
  const { isLoading, error, run } = useAsyncState(true);
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
        const [quotaRes, severityRes] = await Promise.all([
          api.get('/api/v1/dashboard/quota'),
          api.get('/api/v1/dashboard/severity-breakdown'),
        ]);

        setQuota(quotaRes.data);

        setSeverity(severityRes.data);
      },
      {
        errorMessage: 'Failed to load dashboard',
        onError: (err) => {
          console.error('Dashboard error:', err);
        },
      },
    );
  }, [run]);

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

  return (
    <div className="p-8 lg:p-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-foreground text-4xl font-bold tracking-tight mb-2">Dashboard</h1>
        <p className="text-muted-foreground">Monitor your vulnerability scans and security metrics</p>
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

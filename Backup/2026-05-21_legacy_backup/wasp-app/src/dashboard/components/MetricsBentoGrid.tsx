'use client';

import React from 'react';
import { Shield, AlertTriangle, Zap, GitCompare, Activity, Lock, type LucideIcon } from 'lucide-react';
import type { DashboardSummary } from '@/lib/apiClient';

interface MetricItem {
  id: string;
  hero: boolean;
  label: string;
  value: string;
  unit: string;
  trend: string;
  trendUp: boolean;
  trendNeutral: boolean;
  icon: LucideIcon;
  iconBg: string;
  detail: string;
  subValue: string;
  subColor: string;
  barPct?: number;
  barColor?: string;
  alert?: boolean;
  locked?: boolean;
}

interface MetricsBentoGridProps {
  metrics?: DashboardSummary['metrics'];
}

export default function MetricsBentoGrid({ metrics }: MetricsBentoGridProps) {
  const quotaPct = metrics?.quotaLimit ? Math.round((metrics.quotaUsed / metrics.quotaLimit) * 100) : 0;
  const averageDuration = metrics?.avgScanDurationSeconds || 0;
  const avgDurationLabel = averageDuration >= 60
    ? `${Math.floor(averageDuration / 60)}m ${averageDuration % 60}s`
    : `${averageDuration}s`;

  const cards: MetricItem[] = [
    {
      id: 'metric-quota',
      hero: true,
      label: 'Monthly Quota Used',
      value: String(metrics?.quotaUsed || 0),
      unit: `/ ${metrics?.quotaLimit || 0} scans`,
      trend: `${quotaPct}% utilized`,
      trendUp: false,
      trendNeutral: true,
      icon: Activity,
      iconBg: 'bg-cyan-500/15 text-cyan-400',
      detail: `${Math.max(0, (metrics?.quotaLimit || 0) - (metrics?.quotaUsed || 0))} remaining`,
      subValue: `${metrics?.scansToday || 0} submitted today`,
      subColor: 'text-cyan-400',
      barPct: Math.min(100, Math.max(0, quotaPct)),
      barColor: 'bg-cyan-400',
    },
    {
      id: 'metric-critical',
      hero: false,
      label: 'Critical Vulnerabilities',
      value: String(metrics?.criticalVulns || 0),
      unit: 'recent findings',
      trend: `${metrics?.exploitableVulns || 0} exploitable`,
      trendUp: true,
      trendNeutral: false,
      icon: AlertTriangle,
      iconBg: 'bg-red-500/15 text-red-400',
      detail: 'Across recent scan results',
      subValue: 'Needs attention',
      subColor: 'text-red-400',
      alert: true,
    },
    {
      id: 'metric-delta',
      hero: false,
      label: 'Delta Vulnerabilities',
      value: String(metrics?.deltaVulns || 0),
      unit: 'enterprise minus free',
      trend: `${metrics?.enterpriseVulns || 0} enterprise total`,
      trendUp: false,
      trendNeutral: true,
      icon: GitCompare,
      iconBg: 'bg-purple-500/15 text-purple-400',
      detail: `${metrics?.freeVulns || 0} free total`,
      subValue: 'Coverage gap view',
      subColor: 'text-purple-400',
      locked: false,
    },
    {
      id: 'metric-scans-today',
      hero: false,
      label: 'Scans Today',
      value: String(metrics?.scansToday || 0),
      unit: 'submitted',
      trend: `${metrics?.completedScans || 0} completed total`,
      trendUp: false,
      trendNeutral: true,
      icon: Shield,
      iconBg: 'bg-emerald-500/15 text-emerald-400',
      detail: `${metrics?.scanningScans || 0} currently scanning`,
      subValue: `${metrics?.failedScans || 0} failed`,
      subColor: 'text-emerald-400',
    },
    {
      id: 'metric-exploitable',
      hero: false,
      label: 'Exploitable CVEs',
      value: String(metrics?.exploitableVulns || 0),
      unit: 'confirmed',
      trend: 'Known exploit paths',
      trendUp: true,
      trendNeutral: false,
      icon: Zap,
      iconBg: 'bg-amber-500/15 text-amber-400',
      detail: 'Prioritize patching',
      subValue: 'High operational risk',
      subColor: 'text-amber-400',
      alert: true,
    },
    {
      id: 'metric-avg-duration',
      hero: false,
      label: 'Avg Scan Duration',
      value: avgDurationLabel,
      unit: 'across results',
      trend: `${metrics?.pendingScans || 0} pending · ${metrics?.cancelledScans || 0} cancelled`,
      trendUp: false,
      trendNeutral: false,
      icon: Activity,
      iconBg: 'bg-blue-500/15 text-blue-400',
      detail: `${metrics?.totalScans || 0} total scans`,
      subValue: `${metrics?.completedScans || 0} completed`,
      subColor: 'text-emerald-400',
    },
  ];

  const heroMetric = cards[0];
  const HeroIcon = heroMetric.icon;

  return (
    <div className="pt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-4 gap-4">
      {/* Hero card — spans 2 cols */}
      <div
        key={heroMetric.id}
        className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-zinc-700 transition-all duration-200"
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500 mb-1">{heroMetric.label}</p>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold tabular-nums text-zinc-100">{heroMetric.value}</span>
              <span className="text-sm text-zinc-500">{heroMetric.unit}</span>
            </div>
          </div>
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center ${heroMetric.iconBg}`}
          >
            <HeroIcon size={18} />
          </div>
        </div>

        {heroMetric.barPct !== undefined && (
          <div className="mb-3">
            <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${heroMetric.barColor}`}
                style={{ width: `${heroMetric.barPct}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-500">{heroMetric.detail}</span>
          <span className={`text-xs font-semibold ${heroMetric.subColor}`}>{heroMetric.subValue}</span>
        </div>
      </div>

      {/* Regular cards */}
      {cards.slice(1).map((m) => {
        const CardIcon = m.icon;
        return (
          <div
            key={m.id}
            className={`bg-zinc-900 border rounded-xl p-4 hover:border-zinc-700 transition-all duration-200 ${
              m.alert ? 'border-red-500/20 bg-red-500/5' : 'border-zinc-800'
            }`}
          >
            <div className="flex items-start justify-between mb-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 leading-tight">{m.label}</p>
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${m.iconBg}`}
              >
                <CardIcon size={18} />
              </div>
            </div>

            <div className="flex items-baseline gap-1.5 mb-1">
              <span className="text-2xl font-bold tabular-nums text-zinc-100">{m.value}</span>
              {m.locked && <Lock size={12} className="text-purple-400 mb-1" />}
            </div>
            <p className="text-[10px] text-zinc-500 mb-2">{m.unit}</p>

            <div className="flex items-center justify-between border-t border-zinc-800 pt-2">
              <span className="text-[10px] text-zinc-600 truncate">{m.trend}</span>
              <span className={`text-[10px] font-semibold ${m.subColor} shrink-0 ml-2`}>{m.subValue}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

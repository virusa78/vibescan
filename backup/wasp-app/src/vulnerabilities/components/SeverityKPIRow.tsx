'use client';

import React from 'react';
import { AlertCircle, CheckCircle2, Clock } from 'lucide-react';

interface KPIItem {
  label: string;
  value: string;
  unit: string;
  icon: React.ReactNode;
  color: string;
  trend?: string;
  trendColor?: string;
}

const kpis: KPIItem[] = [
  {
    label: 'Total Vulnerabilities',
    value: '106',
    unit: 'findings',
    icon: <AlertCircle size={20} />,
    color: 'text-red-400 bg-red-500/10',
    trend: '+12 this week',
    trendColor: 'text-red-400',
  },
  {
    label: 'Critical CVEs',
    value: '14',
    unit: 'active',
    icon: <AlertCircle size={20} />,
    color: 'text-red-500 bg-red-500/10',
    trend: '+3 vs last scan',
    trendColor: 'text-red-500',
  },
  {
    label: 'Fixed Vulnerabilities',
    value: '75',
    unit: 'remediated',
    icon: <CheckCircle2 size={20} />,
    color: 'text-emerald-400 bg-emerald-500/10',
    trend: '70% fix rate',
    trendColor: 'text-emerald-400',
  },
  {
    label: 'Open Items',
    value: '31',
    unit: 'pending',
    icon: <Clock size={20} />,
    color: 'text-amber-400 bg-amber-500/10',
    trend: 'Requires attention',
    trendColor: 'text-amber-400',
  },
];

export default function SeverityKPIRow() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {kpis.map((kpi, i) => (
        <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${kpi.color}`}>
              {kpi.icon}
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{kpi.label}</p>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-zinc-100">{kpi.value}</span>
                <span className="text-xs text-zinc-500">{kpi.unit}</span>
              </div>
            </div>
          </div>
          {kpi.trend && (
            <div className="flex items-center gap-1.5">
              <span className={`text-[10px] font-medium ${kpi.trendColor}`}>{kpi.trend}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

"use client";

import React from 'react';
import dynamic from 'next/dynamic';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';

// Dynamic import to avoid SSR issues with ResponsiveContainer in Next.js 15.5 + React 19
const ResponsiveContainer = dynamic(
  () => import('recharts').then(mod => mod.ResponsiveContainer),
  { ssr: false }
);

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: '#ef4444',
  HIGH: '#f97316',
  MEDIUM: '#f59e0b',
  LOW: '#22c55e',
};

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { dataKey: string; name: string; value: number }[]; label: string }) => {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-3 shadow-xl text-xs">
      <p className="font-semibold mb-2" style={{ color: SEVERITY_COLORS[label] }}>
        {label}
      </p>
      {payload.map((p: { dataKey: string; name: string; value: number }) => (
        <div key={`stt-${p.dataKey}`} className="flex justify-between gap-4 mb-1">
          <span className="text-zinc-400">{p.name}</span>
          <span className="font-mono font-semibold text-zinc-200">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

interface SeverityPoint {
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  free: number;
  enterprise: number;
  delta: number;
}

interface SeverityDistributionChartProps {
  data: SeverityPoint[];
  loading?: boolean;
}

export default function SeverityDistributionChart({ data, loading = false }: SeverityDistributionChartProps) {
  const hasData = data.length > 0;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 h-full">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-zinc-200">Severity Distribution</h2>
        <p className="text-[11px] text-zinc-500 mt-0.5">Free vs Enterprise findings{loading ? ' · loading…' : ''}</p>
      </div>

      {hasData ? (
        <ResponsiveContainer width="100%" height={190}>
          <BarChart
            data={data}
            margin={{ top: 4, right: 4, left: -24, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={true} vertical={false} />
            <XAxis
              dataKey="severity"
              tick={{ fontSize: 9, fill: '#71717a' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#71717a' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip label="" />} />
            <Bar dataKey="free" name="Free" radius={[3, 3, 0, 0]} maxBarSize={18}>
              {data.map((entry) => (
                <Cell
                  key={`cell-free-${entry.severity}`}
                  fill={SEVERITY_COLORS[entry.severity]}
                  fillOpacity={0.5}
                />
              ))}
            </Bar>
            <Bar dataKey="enterprise" name="Enterprise" radius={[3, 3, 0, 0]} maxBarSize={18}>
              {data.map((entry) => (
                <Cell
                  key={`cell-enterprise-${entry.severity}`}
                  fill={SEVERITY_COLORS[entry.severity]}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-[190px] w-full flex items-center justify-center text-xs text-zinc-500">
          No severity data yet.
        </div>
      )}
    </div>
  );
}

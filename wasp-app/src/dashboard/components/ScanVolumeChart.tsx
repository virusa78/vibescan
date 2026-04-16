"use client";

import React from 'react';
import dynamic from 'next/dynamic';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

// Dynamic import to avoid SSR issues with ResponsiveContainer in Next.js 15.5 + React 19
const ResponsiveContainer = dynamic(
  () => import('recharts').then(mod => mod.ResponsiveContainer),
  { ssr: false }
);

interface TooltipPayload {
  dataKey: string;
  color: string;
  name: string;
  value: number;
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: TooltipPayload[]; label: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-3 shadow-xl text-xs">
      <p className="font-semibold text-zinc-300 mb-2">{label}</p>
      {payload.map((p: TooltipPayload) => (
        <div key={`tt-${p.dataKey}`} className="flex items-center justify-between gap-4 mb-1">
          <span className="flex items-center gap-1.5 text-zinc-400">
            <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            {p.name}
          </span>
          <span className="font-mono font-semibold text-zinc-200">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

interface ScanVolumePoint {
  date: string;
  scans: number;
  freeVulns: number;
  enterpriseVulns: number;
}

interface ScanVolumeChartProps {
  data: ScanVolumePoint[];
  loading?: boolean;
}

export default function ScanVolumeChart({ data, loading = false }: ScanVolumeChartProps) {
  const hasData = data.length > 0;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-zinc-200">Scan Volume & Vulnerability Trend</h2>
          <p className="text-[11px] text-zinc-500 mt-0.5">Last 14 days · Free vs Enterprise scanner{loading ? ' · loading…' : ''}</p>
        </div>
      </div>

      {hasData ? (
        <div className="h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              <defs>
                <linearGradient id="colorFree" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorEnterprise" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: '#71717a' }}
                dy={10}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: '#71717a' }}
              />
              <Tooltip content={<CustomTooltip label="" />} />
              <Area
                type="monotone"
                dataKey="freeVulns"
                name="Free Scanner Findings"
                stroke="#22c55e"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorFree)"
              />
              <Area
                type="monotone"
                dataKey="enterpriseVulns"
                name="Enterprise Scanner Findings"
                stroke="#06b6d4"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorEnterprise)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-[220px] w-full flex items-center justify-center text-xs text-zinc-500">
          No scan trend data yet.
        </div>
      )}
    </div>
  );
}

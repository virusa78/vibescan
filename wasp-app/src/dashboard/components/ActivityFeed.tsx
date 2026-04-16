'use client';

import React from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Info,
  XCircle,
  Clock,
  type LucideIcon,
} from 'lucide-react';

interface FeedItem {
  id: string;
  type: string;
  icon: LucideIcon;
  iconColor: string;
  title: string;
  detail: string;
  time: string;
  severity: string;
}

interface ActivityFeedProps {
  items: Array<{ id: string; type: string; title: string; detail: string; severity: 'info' | 'success' | 'warning' | 'error'; time: string }>;
  loading?: boolean;
}

export default function ActivityFeed({ items, loading = false }: ActivityFeedProps) {
  const iconBySeverity: Record<string, LucideIcon> = {
    success: CheckCircle2,
    error: XCircle,
    warning: AlertTriangle,
    info: Info,
  };
  const colorBySeverity: Record<string, string> = {
    success: 'text-emerald-400',
    error: 'text-red-400',
    warning: 'text-amber-400',
    info: 'text-cyan-400',
  };

  const renderedItems: FeedItem[] = items.map((item, idx) => ({
    id: item.id || `event-${idx}`,
    type: item.type || 'event',
    icon: iconBySeverity[item.severity] || Info,
    iconColor: colorBySeverity[item.severity] || 'text-zinc-400',
    title: item.title,
    detail: item.detail,
    time: item.time,
    severity: item.severity,
  }));

  return (
    <div className="bg-zinc-900/40 rounded-xl border border-zinc-800 p-4 h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between mb-4 shrink-0">
        <h3 className="text-sm font-medium text-zinc-300 flex items-center gap-2">
          <Clock size={16} className="text-zinc-500" />
          Live Activity{loading ? ' (loading...)' : ''}
        </h3>
        <span className="flex h-2 w-2 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar">
        {renderedItems.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-zinc-500">
            No activity yet.
          </div>
        ) : (
          renderedItems.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.id} className="relative pl-6 pb-2 last:pb-0">
                <div className="absolute left-0 top-1 bottom-0 w-0.5 bg-zinc-800 last:hidden" />
                <div className="absolute left-[-3px] top-1 h-2 w-2 rounded-full border border-zinc-700 bg-zinc-900" />

                <div className="flex gap-3">
                  <div className={`shrink-0 mt-0.5 ${item.iconColor}`}>
                    <Icon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-zinc-200 truncate">
                        {item.title}
                      </p>
                      <span className="text-[10px] text-zinc-500 whitespace-nowrap">
                        {item.time}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-500 mt-0.5 truncate italic">
                      {item.detail}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <button className="w-full mt-4 py-2 text-[11px] font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors border border-zinc-800 shrink-0">
        View System Logs
      </button>
    </div>
  );
}


'use client';

import React from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import { Toaster } from 'sonner';

interface DashboardHeaderProps {
  lastUpdated?: string;
  onRefresh: () => void;
  onOpenScan: () => void;
}

export default function DashboardHeader({ lastUpdated, onRefresh, onOpenScan }: DashboardHeaderProps) {
  const formattedTime = lastUpdated
    ? new Date(lastUpdated).toLocaleString()
    : 'Loading...';

  return (
    <>
      <Toaster position="top-right" richColors />
      <div className="sticky top-0 z-20 bg-zinc-950/90 backdrop-blur-sm border-b border-zinc-800 px-6 lg:px-8 xl:px-10 2xl:px-12">
        <div className="max-w-screen-2xl mx-auto flex items-center justify-between h-16">
          <div>
            <h1 className="text-lg font-semibold text-zinc-100">Scan Dashboard</h1>
            <p className="text-xs text-zinc-500 font-mono">
              Last updated: <span className="text-zinc-400">{formattedTime}</span>
              <span className="ml-2 inline-flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-emerald-400">Live</span>
              </span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onRefresh}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-100 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg transition-all duration-150 active:scale-95"
            >
              <RefreshCw size={13} />
              Refresh
            </button>
            <button
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-zinc-900 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-all duration-150 active:scale-95"
              onClick={onOpenScan}
            >
              <Plus size={13} />
              New Scan
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

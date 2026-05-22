'use client';

import React from 'react';

type StatusType = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'done' | 'pro' | 'starter' | 'ongoing' | 'error' | 'pending' | 'scanning' | 'cancelled';

interface StatusBadgeProps {
  status: StatusType;
  size?: 'sm' | 'md';
  className?: string;
}

const statusConfig: Record<StatusType, { label: string; colors: string }> = {
  CRITICAL: { label: 'Critical', colors: 'bg-red-500/10 text-red-400 border-red-500/20' },
  HIGH: { label: 'High', colors: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
  MEDIUM: { label: 'Medium', colors: 'bg-amber-400/10 text-amber-500 border-amber-400/20' },
  LOW: { label: 'Low', colors: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
  done: { label: 'Finished', colors: 'bg-zinc-800 text-emerald-400 border-emerald-400/20' },
  pro: { label: 'PRO', colors: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' },
  starter: { label: 'STARTER', colors: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  ongoing: { label: 'In Progress', colors: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20 animate-pulse' },
  error: { label: 'Failed', colors: 'bg-red-500/10 text-red-400 border-red-500/20' },
  pending: { label: 'Pending', colors: 'bg-zinc-700/30 text-zinc-400 border-zinc-600/30' },
  scanning: { label: 'Scanning', colors: 'bg-blue-500/10 text-blue-400 border-blue-500/20 animate-pulse' },
  cancelled: { label: 'Cancelled', colors: 'bg-zinc-700/30 text-zinc-500 border-zinc-600/30' },
};

export default function StatusBadge({ status, size = 'md', className = '' }: StatusBadgeProps) {
  const config = statusConfig[status];
  const sizeClasses = size === 'sm' ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-1 text-[10px]';

  return (
    <span className={`inline-flex items-center font-bold tracking-wider uppercase border rounded ${config.colors} ${sizeClasses} ${className}`}>
      {config.label}
    </span>
  );
}

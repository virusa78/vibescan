'use client';

import React from 'react';
import Link from 'next/link';
import {
  GitBranch,
  Upload,
  ExternalLink,
  RotateCcw,
  X,
  Lock,
} from 'lucide-react';
import StatusBadge from '@/components/ui/StatusBadge';
import { toast, Toaster } from 'sonner';
import { useCancelScan } from '@/lib/hooks';
import type { ScanSummary } from '@/lib/apiClient';

interface RecentScansTableProps {
  scans: ScanSummary[];
  loading?: boolean;
}

export default function RecentScansTable({ scans, loading = false }: RecentScansTableProps) {
  const [hoveredRow, setHoveredRow] = React.useState<string | null>(null);
  const cancelScan = useCancelScan();

  const handleRetry = (id: string) => {
    toast.success(`Retrying scan ${id}...`);
  };

  const handleCancel = async (id: string) => {
    try {
      await cancelScan(id);
      toast.success(`Scan ${id} cancelled`);
    } catch {
      toast.error('Failed to cancel scan');
    }
  };

  return (
    <>
      <Toaster position="top-right" richColors />
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-800/50 text-zinc-400 font-medium">
              <tr>
                <th className="px-4 py-3">Scan Name & Source</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Vulnerabilities</th>
                <th className="px-4 py-3">Delta</th>
                <th className="px-4 py-3">Duration</th>
                <th className="px-4 py-3 text-zinc-500 font-mono">Submitted</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {scans.slice(0, 10).map((scan: ScanSummary) => (
                <tr
                  key={scan.id}
                  className="hover:bg-zinc-800/30 transition-colors group"
                  onMouseEnter={() => setHoveredRow(scan.id)}
                  onMouseLeave={() => setHoveredRow(null)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-zinc-800 flex items-center justify-center text-zinc-400 group-hover:text-cyan-400 transition-colors">
                        {scan.inputType === 'github' ? (
                          <GitBranch size={16} />
                        ) : (
                          <Upload size={16} />
                        )}
                      </div>
                      <div>
                        <div className="font-medium text-zinc-100 flex items-center gap-2">
                          {scan.label}
                          {scan.locked && (
                            <Lock size={12} className="text-zinc-500" />
                          )}
                        </div>
                        <div className="text-xs text-zinc-500 flex items-center gap-1 mt-0.5">
                          <span className="text-zinc-400">{scan.repo}</span>
                          <span>•</span>
                          <span>{scan.ref}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={scan.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <span className="text-red-400 font-semibold">
                          {scan.criticalCount}
                        </span>
                      </div>
                      <div className="h-3 w-[1px] bg-zinc-700 mx-1" />
                      <div className="text-zinc-300">
                        {scan.planAtSubmission === 'enterprise'
                          ? scan.enterpriseVulns
                          : scan.freeVulns}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {scan.status === 'done' ? (
                      <div
                        className={`flex items-center gap-1 font-medium ${
                          scan.deltaCount > 0
                            ? 'text-red-400'
                            : scan.deltaCount < 0
                            ? 'text-green-400'
                            : 'text-zinc-500'
                        }`}
                      >
                        {scan.deltaCount > 0 ? '+' : ''}
                        {scan.deltaCount}
                      </div>
                    ) : (
                      <span className="text-zinc-600">--</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-zinc-500 whitespace-nowrap">
                    {scan.duration}
                  </td>
                  <td className="px-4 py-3 font-mono text-zinc-600 whitespace-nowrap">
                    {scan.submittedAt}
                  </td>
                  <td className="px-4 py-3">
                    <div
                      className={`flex items-center gap-1 transition-opacity duration-150 ${
                        hoveredRow === scan.id ? 'opacity-100' : 'opacity-0'
                      }`}
                    >
                      {scan.status === 'done' && (
                        <Link
                          href={`/vulnerabilities?scanId=${scan.id}`}
                          className="p-1 rounded text-zinc-500 hover:text-cyan-400 hover:bg-zinc-700 transition-all"
                          title="View vulnerability report"
                        >
                          <ExternalLink size={13} />
                        </Link>
                      )}
                      {scan.status === 'error' && (
                        <button
                          onClick={() => handleRetry(scan.id)}
                          className="p-1 rounded text-zinc-500 hover:text-amber-400 hover:bg-zinc-700 transition-all"
                          title="Retry scan"
                        >
                          <RotateCcw size={13} />
                        </button>
                      )}
                      {(scan.status === 'pending' ||
                        scan.status === 'scanning') && (
                        <button
                          onClick={() => handleCancel(scan.id)}
                          className="p-1 rounded text-zinc-500 hover:text-red-400 hover:bg-zinc-700 transition-all"
                          title="Cancel scan — refunds quota"
                        >
                          <X size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {scans.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-xs text-zinc-500">
                    No scans yet. Start your first scan to populate this table.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {loading && (
            <div className="px-4 py-3 text-xs text-zinc-500 border-t border-zinc-800">Loading scans...</div>
          )}
        </div>
      </div>
    </>
  );
}

'use client';

import React from 'react';
import { Download, Share2, ChevronDown, GitBranch, Clock, CheckCircle2 } from 'lucide-react';
import { toast, Toaster } from 'sonner';
import StatusBadge from '@/components/ui/StatusBadge';

export default function ReportHeader() {
  const [exporting, setExporting] = React.useState(false);

  const handleExport = async (format: string) => {
    setExporting(true);
    // Backend: GET /api/v1/scans/{id}/report?format={format}
    await new Promise(r => setTimeout(r, 800));
    setExporting(false);
    if (format === 'pdf') {
      toast.success('PDF generation queued', { description: 'You will receive an email when ready' });
    } else {
      toast.success(`Exported as ${format.toUpperCase()}`, { description: 'Download started' });
    }
  };

  const exportOptions = [
    { id: 'pdf', label: 'PDF Report', fmt: 'pdf' },
    { id: 'json', label: 'Raw JSON', fmt: 'json' },
    { id: 'csv', label: 'CSV Export', fmt: 'csv' },
  ];

  return (
    <>
      <Toaster position="top-right" richColors />
      <div className="sticky top-0 z-20 bg-zinc-950/90 backdrop-blur-sm border-b border-zinc-800 px-6 lg:px-8 xl:px-10 2xl:px-12">
        <div className="max-w-screen-2xl mx-auto py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h1 className="text-base font-semibold text-zinc-100">Vulnerability Report</h1>
                <StatusBadge status="done" size="sm" />
                <StatusBadge status="pro" size="sm" />
              </div>
              <div className="flex items-center gap-4 text-[11px] text-zinc-500 flex-wrap">
                <span className="flex items-center gap-1 font-mono">
                  <span className="text-zinc-600">scan</span>
                  <span className="text-zinc-400">scan-a3f9b2c1</span>
                </span>
                <span className="flex items-center gap-1">
                  <GitBranch size={10} className="text-purple-400" />
                  finstack/payments-api · main @ a3f9b2c
                </span>
                <span className="flex items-center gap-1">
                  <Clock size={10} />
                  Apr 1, 2026 · 14:32 UTC · 2m 41s
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle2 size={10} className="text-emerald-400" />
                  <span className="text-emerald-400">CI: BLOCKED</span>
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => toast.info('Report link copied')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-100 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg transition-all duration-150 active:scale-95"
              >
                <Share2 size={12} />
                Share
              </button>
              <div className="relative group">
                <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-zinc-900 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-all duration-150 active:scale-95">
                  <Download size={12} />
                  Export
                  <ChevronDown size={12} />
                </button>
                <div className="absolute right-0 top-full mt-1.5 w-40 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl opacity-0 translate-y-1 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto transition-all z-30 overflow-hidden">
                  {exportOptions.map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => handleExport(opt.fmt)}
                      className="w-full text-left px-4 py-2.5 text-[11px] text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700/50 transition-colors border-b border-zinc-700/50 last:border-0 flex items-center justify-between group/opt"
                    >
                      {opt.label}
                      {exporting && <Clock size={10} className="animate-spin text-cyan-400" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

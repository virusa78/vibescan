'use client';

import React from 'react';
import { GitCompare, Lock, ArrowUpRight, ChevronDown, ChevronUp } from 'lucide-react';
import StatusBadge from '@/components/ui/StatusBadge';

// This panel shows locked state for starter plan users
// Backend: GET /api/v1/scans/{id}/delta — returns locked view for starter plan
const planAtSubmission = 'pro'; // Change to 'starter' to see locked state

const deltaVulns = [
  { id: 'delta-CVE-2026-3452', cveId: 'CVE-2026-3452', pkg: 'log4j-core', severity: 'CRITICAL' as const, cvss: 10.0 },
  { id: 'delta-CVE-2026-1471', cveId: 'CVE-2026-1471', pkg: 'snakeyaml', severity: 'HIGH' as const, cvss: 9.0 },
  { id: 'delta-CVE-2025-29927', cveId: 'CVE-2025-29927', pkg: 'next', severity: 'HIGH' as const, cvss: 7.5 },
  { id: 'delta-CVE-2024-57699', cveId: 'CVE-2024-57699', pkg: 'netty-codec-http2', severity: 'MEDIUM' as const, cvss: 5.9 },
  { id: 'delta-CVE-2025-23184', cveId: 'CVE-2025-23184', pkg: 'cxf-core', severity: 'LOW' as const, cvss: 3.1 },
];

const deltaSeverityBreakdown = { CRITICAL: 2, HIGH: 8, MEDIUM: 9, LOW: 4 };

const isLocked = (planAtSubmission as 'starter' | 'free_trial' | 'pro' | 'enterprise') === 'starter' || (planAtSubmission as 'starter' | 'free_trial' | 'pro' | 'enterprise') === 'free_trial';

export default function DeltaPanel() {
  const [expanded, setExpanded] = React.useState(true);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 border-b border-zinc-800 hover:bg-zinc-800/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          <GitCompare size={14} className="text-purple-400" />
          <span className="text-xs font-semibold text-zinc-200">Delta Analysis</span>
          <span className="text-[9px] font-mono bg-purple-500/15 text-purple-400 border border-purple-500/25 px-1.5 py-0.5 rounded">
            23 delta findings
          </span>
        </div>
        {expanded ? <ChevronUp size={13} className="text-zinc-500" /> : <ChevronDown size={13} className="text-zinc-500" />}
      </button>

      {expanded && (
        <div className="p-4 space-y-4 animate-fade-in">
          {/* Severity breakdown — always visible */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">Delta by Severity</p>
            <div className="space-y-1.5">
              {Object.entries(deltaSeverityBreakdown).map(([sev, count]) => {
                const colors: Record<string, string> = {
                  CRITICAL: 'bg-red-500',
                  HIGH: 'bg-orange-500',
                  MEDIUM: 'bg-amber-400',
                  LOW: 'bg-emerald-500',
                };
                const total = Object.values(deltaSeverityBreakdown).reduce((a, b) => a + b, 0);
                const pct = Math.round((count / total) * 100);
                return (
                  <div key={`delta-sev-${sev}`} className="flex items-center gap-2">
                    <span className="text-[10px] font-mono w-16 text-zinc-500">{sev}</span>
                    <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${colors[sev]}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[10px] font-mono tabular-nums text-zinc-400 w-4 text-right">
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Delta vuln list */}
          <div className="relative">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">
                Delta Findings
              </p>

            {isLocked ? (
              <div className="relative mt-2">
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-zinc-900/80 rounded-lg backdrop-blur-[1px] border border-zinc-800/50">
                  <Lock size={18} className="text-purple-400 mb-2" />
                  <p className="text-xs font-semibold text-zinc-300 mb-1">Upgrade plan for faster queue priority</p>
                  <p className="text-[10px] text-zinc-500 text-center px-4 mb-3 leading-relaxed">
                    All plans receive full report depth. Higher plans prioritize execution and enterprise request throughput.
                  </p>
                  <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-zinc-900 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-all active:scale-95">
                    View Plans
                    <ArrowUpRight size={11} />
                  </button>
                </div>

                <div className="space-y-1.5 filter blur-sm pointer-events-none select-none opacity-20">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-zinc-800/40">
                      <div className="h-2 w-24 bg-zinc-700 rounded animate-pulse" />
                      <div className="h-2 w-8 bg-zinc-700 rounded animate-pulse" />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                {deltaVulns.map(v => (
                  <div key={v.id} className="flex items-center justify-between py-1.5 px-3 bg-zinc-800/40 rounded-lg group cursor-pointer hover:bg-zinc-800/60 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[10px] text-zinc-400 group-hover:text-zinc-200 transition-colors">{v.cveId}</span>
                      <span className="text-[10px] text-zinc-500 truncate max-w-[120px]">{v.pkg}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-mono text-zinc-500">{v.cvss.toFixed(1)}</span>
                      <StatusBadge status={v.severity} size="sm" />
                      <ArrowUpRight size={12} className="text-zinc-600 group-hover:text-zinc-400" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {!isLocked && (
            <button className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-medium rounded-lg transition-colors mt-2">
              View Full Comparison
            </button>
          )}
        </div>
      )}
    </div>
  );
}

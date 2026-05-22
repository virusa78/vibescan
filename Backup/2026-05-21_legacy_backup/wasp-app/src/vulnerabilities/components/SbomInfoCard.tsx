'use client';

import React from 'react';
import { FileJson, GitBranch, Clock, Download } from 'lucide-react';

interface SBOMInfo {
  scanId: string;
  inputType: string;
  source: string;
  ref: string;
  sbomVersion: string;
  generatedAt: string;
  components: number;
  dependencies: number;
}

const sbomInfo: SBOMInfo = {
  scanId: 'scan-a3f9b2c1',
  inputType: 'source_zip',
  source: 'release-v2.4.1.zip',
  ref: 'main@a3f9b2c',
  sbomVersion: '1.5',
  generatedAt: 'Apr 1, 2026 · 14:32 UTC',
  components: 127,
  dependencies: 89,
};

export default function SbomInfoCard() {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <FileJson size={14} className="text-cyan-400" />
        <span className="text-xs font-semibold text-zinc-200">SBOM Information</span>
      </div>

      <div className="space-y-2 text-xs">
        <div className="flex items-center justify-between py-1.5 border-b border-zinc-800/50">
          <span className="text-zinc-500">Scan ID</span>
          <span className="font-mono text-zinc-300">{sbomInfo.scanId}</span>
        </div>
        <div className="flex items-center justify-between py-1.5 border-b border-zinc-800/50">
          <span className="text-zinc-500">Input Type</span>
          <span className="text-zinc-300 capitalize">{sbomInfo.inputType.replace('_', ' ')}</span>
        </div>
        <div className="flex items-center justify-between py-1.5 border-b border-zinc-800/50">
          <span className="text-zinc-500">Source File</span>
          <span className="text-zinc-300 truncate max-w-[100px]">{sbomInfo.source}</span>
        </div>
        <div className="flex items-center justify-between py-1.5 border-b border-zinc-800/50">
          <GitBranch size={12} className="text-zinc-500 shrink-0" />
          <span className="text-zinc-300 font-mono">{sbomInfo.ref}</span>
        </div>
        <div className="flex items-center justify-between py-1.5 border-b border-zinc-800/50">
          <span className="text-zinc-500">SBOM Version</span>
          <span className="text-zinc-300 font-mono">v{sbomInfo.sbomVersion}</span>
        </div>
        <div className="flex items-center justify-between py-1.5 border-b border-zinc-800/50">
          <Clock size={12} className="text-zinc-500 shrink-0" />
          <span className="text-zinc-300">{sbomInfo.generatedAt}</span>
        </div>
        <div className="flex items-center justify-between py-1.5 border-b border-zinc-800/50">
          <span className="text-zinc-500">Components</span>
          <span className="text-zinc-300 font-semibold">{sbomInfo.components}</span>
        </div>
        <div className="flex items-center justify-between py-1.5">
          <span className="text-zinc-500">Dependencies</span>
          <span className="text-zinc-300 font-semibold">{sbomInfo.dependencies}</span>
        </div>
      </div>

      <button className="w-full py-2 text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 border border-zinc-700 rounded-lg transition-colors flex items-center justify-center gap-2">
        <Download size={12} />
        Download SBOM
      </button>
    </div>
  );
}

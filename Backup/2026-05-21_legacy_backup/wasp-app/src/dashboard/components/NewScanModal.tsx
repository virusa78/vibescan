import React from 'react';
import { X, Upload, GitBranch, FileJson, Loader2 } from 'lucide-react';
import { toast, Toaster } from 'sonner';
import { useSubmitScan } from '@/lib/hooks';

interface NewScanModalProps {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

type ScanType = 'source_zip' | 'sbom_upload' | 'github';

export default function NewScanModal({ open, onClose, onCreated }: NewScanModalProps) {
  const [scanType, setScanType] = React.useState<ScanType>('source_zip');
  const [loading, setLoading] = React.useState(false);
  const [repo, setRepo] = React.useState('');
  const [ref, setRef] = React.useState('main');
  const [sbomText, setSbomText] = React.useState('{\n  "bomFormat": "CycloneDX",\n  "specVersion": "1.6",\n  "version": 1,\n  "components": []\n}');
  const submitScan = useSubmitScan();

  if (!open) return null;

  const onSubmit = async () => {
    setLoading(true);
    try {
      if (scanType === 'source_zip') {
        throw new Error('Source ZIP flow in UI is not wired yet. Use SBOM or GitHub.');
      }

      let result: any;
      if (scanType === 'github') {
        if (!repo.trim()) throw new Error('Repository is required (owner/repo).');
        result = await submitScan('github', { repo: repo.trim(), ref: ref.trim() || 'main' });
      } else {
        const parsedSbom = JSON.parse(sbomText);
        result = await submitScan('sbom', {
          sbom: parsedSbom,
          meta: { repo: 'manual/sbom', ref: 'upload' }
        });
      }

      toast.success('Scan queued', {
        description: `${result?.data?.id || result?.id || 'New scan'} is pending`,
      });
      onCreated?.();
      onClose();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to queue scan');
    } finally {
      setLoading(false);
    }
  };

  const scanTypes = [
    { id: 'source_zip' as ScanType, label: 'Source ZIP', icon: <Upload size={15} />, desc: 'Upload .zip archive ≤ 50MB' },
    { id: 'sbom_upload' as ScanType, label: 'SBOM Upload', icon: <FileJson size={15} />, desc: 'CycloneDX JSON v1.4–1.6' },
    { id: 'github' as ScanType, label: 'GitHub Repo', icon: <GitBranch size={15} />, desc: 'Requires GitHub App install' },
  ];

  return (
    <>
      <Toaster position="top-right" richColors />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between p-5 border-b border-zinc-800">
            <h2 className="text-lg font-semibold text-zinc-100">Initiate New Scan</h2>
            <button onClick={onClose} className="p-1 hover:bg-zinc-800 rounded-lg transition-colors">
              <X size={18} className="text-zinc-400" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            <div className="space-y-3">
              <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Storage & Source</label>
              <div className="grid grid-cols-1 gap-2">
                {scanTypes.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setScanType(t.id)}
                    className={`flex items-start gap-3 p-3 rounded-xl border transition-all text-left ${
                      scanType === t.id
                        ? 'bg-cyan-500/10 border-cyan-500/50 ring-1 ring-cyan-500/20'
                        : 'bg-zinc-800/50 border-zinc-700/50 hover:bg-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <div className={`mt-0.5 p-2 rounded-lg ${scanType === t.id ? 'bg-cyan-500/20 text-cyan-400' : 'bg-zinc-800 text-zinc-400'}`}>
                      {t.icon}
                    </div>
                    <div>
                      <div className={`text-sm font-medium ${scanType === t.id ? 'text-zinc-100' : 'text-zinc-300'}`}>{t.label}</div>
                      <div className="text-xs text-zinc-500 mt-0.5">{t.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

             {scanType === 'github' && (
               <div className="space-y-4 animate-in slide-in-from-top-2 duration-200">
                 <div>
                   <label className="text-xs font-medium text-zinc-400 mb-1.5 block">Repository URL</label>
                   <input
                     type="text"
                     placeholder="owner/repository"
                     value={repo}
                     onChange={(e) => setRepo(e.target.value)}
                     className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm font-mono text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all"
                   />
                 </div>

                 <div>
                   <label className="text-xs font-medium text-zinc-400 mb-1.5 block">Branch / Ref</label>
                   <input
                     type="text"
                     placeholder="main"
                     value={ref}
                     onChange={(e) => setRef(e.target.value)}
                     className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm font-mono text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all"
                   />
                 </div>
               </div>
             )}

             {scanType === 'sbom_upload' && (
               <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
                 <label className="text-xs font-medium text-zinc-400 block">CycloneDX JSON</label>
                 <textarea
                   value={sbomText}
                   onChange={(e) => setSbomText(e.target.value)}
                   rows={8}
                   className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs font-mono text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all"
                 />
               </div>
             )}

             {scanType === 'source_zip' && (
               <div className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                 Source ZIP upload UI is not wired yet. Use SBOM Upload or GitHub Repo.
               </div>
             )}

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2 text-sm font-medium text-zinc-400 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg transition-all duration-150"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onSubmit}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 py-2 text-sm font-semibold text-zinc-900 bg-cyan-400 hover:bg-cyan-300 disabled:opacity-60 disabled:cursor-not-allowed rounded-lg transition-all duration-150 active:scale-95"
                style={{ minWidth: 120 }}
              >
                {loading ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Queuing…</span>
                  </>
                ) : (
                  'Start Scan'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

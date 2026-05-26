import { ReactNode } from "react";
import Logo from "../client/components/common/Logo";

export function AuthPageLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[calc(100vh-5rem)] flex-col justify-center px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-md">
        <div className="from-slate-900 to-slate-800 border-slate-700/50 rounded-2xl border bg-gradient-to-b px-5 py-8 shadow-2xl shadow-black/50 backdrop-blur-sm sm:px-10">
          {/* VibeScan Logo & Branding */}
          <div className="flex flex-col items-center mb-6 text-center select-none border-b border-slate-800/80 pb-5">
            <div className="bg-slate-950/60 p-2.5 rounded-2xl border border-slate-800/50 shadow-inner mb-3">
              <Logo className="size-10 text-success hover:scale-105 transition-transform duration-300" />
            </div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">VibeScan</h1>
            <p className="text-slate-400 text-xs mt-1">SaaS Vulnerability Scanning Platform</p>
          </div>

          <div className="text-white">{children}</div>
        </div>
      </div>
    </div>
  );
}


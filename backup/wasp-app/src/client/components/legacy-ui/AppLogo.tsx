import React from 'react';
import { Shield } from 'lucide-react';

export default function AppLogo({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="bg-cyan-400 p-1.5 rounded-lg">
        <Shield size={20} className="text-zinc-950 fill-zinc-950" />
      </div>
      <span className="font-bold text-xl tracking-tight text-white italic">VibeScan</span>
    </div>
  );
}

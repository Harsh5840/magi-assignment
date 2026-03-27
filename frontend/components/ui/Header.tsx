"use client";

import { Zap } from "lucide-react";

export function Header() {
  return (
    <header className="h-12 flex items-center justify-between px-5 border-b border-white/6 bg-zinc-950/80 backdrop-blur-sm flex-shrink-0">
      <div className="flex items-center gap-2.5">
        <div className="w-6 h-6 bg-amber-400 rounded-md flex items-center justify-center">
          <Zap size={13} className="text-zinc-950" fill="currentColor" />
        </div>
        <span className="text-sm font-bold text-zinc-100 tracking-tight">
          magi
        </span>
        <span className="text-xs text-zinc-600 font-normal ml-1">
          content editor
        </span>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-xs text-zinc-600">Engineering Intern — Demo</span>
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="Backend connected" />
      </div>
    </header>
  );
}

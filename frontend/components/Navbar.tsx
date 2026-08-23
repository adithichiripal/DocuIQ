import React from "react";
import { ShieldCheck } from "lucide-react";

export default function Navbar() {
  return (
    <header className="border-b border-zinc-800 bg-[#09090b]/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-lime-500/20 border border-lime-500/40 flex items-center justify-center text-lime-400 font-bold">
            ⚡
          </div>
          <span className="text-lg font-bold tracking-tight text-white">
            DOCU<span className="text-lime-400">IQ</span>
          </span>
        </div>

        <div className="hidden md:flex items-center space-x-6 text-sm text-zinc-400">
          <span className="flex items-center gap-1.5 text-xs bg-zinc-900 border border-zinc-700 px-3 py-1 rounded-full text-zinc-300">
            <ShieldCheck className="w-3.5 h-3.5 text-lime-400" />
            30-Day Encrypted Retention
          </span>
        </div>

        <div className="flex items-center space-x-3">
          <span className="text-xs text-lime-400 bg-lime-500/10 border border-lime-500/30 px-3 py-1.5 rounded-lg font-mono">
            ● System Ready
          </span>
        </div>
      </div>
    </header>
  );
}

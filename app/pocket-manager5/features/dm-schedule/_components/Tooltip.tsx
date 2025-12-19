"use client";

import { ReactNode } from "react";

type TooltipProps = {
  content: ReactNode;
  children: ReactNode;
  className?: string;
};

export function Tooltip({ content, children, className }: TooltipProps) {
  return (
    <div className={`group relative inline-block ${className ?? ""}`}>
      {children}
      <div className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 w-[280px] max-w-[90vw] -translate-x-1/2 rounded-2xl border border-white/15 bg-slate-950/95 p-3 text-sm text-white opacity-0 shadow-2xl shadow-black/40 transition group-hover:opacity-100">
        {content}
      </div>
    </div>
  );
}


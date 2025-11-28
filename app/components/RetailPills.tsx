"use client";

import { useEffect, useState } from "react";
import { fetchRetailContext, type RetailContext } from "@/lib/retailCalendar";

export function RetailPills() {
  const [data, setData] = useState<RetailContext | null>(null);

  useEffect(() => {
    const run = async () => {
      const context = await fetchRetailContext();
      if (context) {
        setData(context);
      }
    };

    run();
  }, []);

  const q = data?.quarterLabel ?? "Q?";
  const p = data?.periodLabel ?? "P?";
  const w = data?.weekLabel ?? "Wk?";
  const d = data?.dateLabel ?? new Date().toISOString().slice(0, 10);

  const pillBase = "rounded-full px-2.5 py-0.5 text-[10px] font-semibold tracking-wide text-white shadow-sm";

  return (
    <div className="flex items-center gap-1.5 text-[11px] text-slate-200">
      <span className={`${pillBase} bg-blue-500/90`}>{q}</span>
      <span className={`${pillBase} bg-emerald-500/90`}>{p}</span>
      <span className={`${pillBase} bg-amber-500/90`}>{w}</span>
      <span className="text-[10px] uppercase tracking-wide text-slate-400">{d}</span>
    </div>
  );
}

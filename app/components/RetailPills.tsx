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

  return (
    <div className="flex items-center gap-2 text-xs font-medium">
      <span className="rounded-full bg-blue-600/90 px-3 py-1 text-white shadow-sm">
        {q}
      </span>
      <span className="rounded-full bg-emerald-600/90 px-3 py-1 text-white shadow-sm">
        {p}
      </span>
      <span className="rounded-full bg-amber-500/90 px-3 py-1 text-white shadow-sm">
        {w}
      </span>
      <span className="text-slate-200">{d}</span>
    </div>
  );
}

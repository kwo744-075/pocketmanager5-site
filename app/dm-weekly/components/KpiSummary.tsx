"use client";
import React, { useEffect, useState } from "react";

type WeeklyApi = {
  slides: string[];
  slideFolder: string;
  excel: { headers: string[]; rows: Record<string, unknown>[] } | null;
  excelName?: string;
};

const KNOWN_KPIS = [
  "Sales", "Cars", "ARO", "CSI", "Labor %", "Net Profit", "Big 4 %", "Mobil 1 %",
];

export default function KpiSummary() {
  const [data, setData] = useState<WeeklyApi | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const res = await fetch("/api/samples/weekly");
      if (!res.ok) return;
      const payload = (await res.json()) as WeeklyApi;
      if (!cancelled) setData(payload);
    }
    load();
    return () => { cancelled = true; };
  }, []);

  if (!data) return <div className="text-sm text-slate-400">Loading KPIs...</div>;
  if (!data.excel) return <div className="text-sm text-slate-400">No KPI file available.</div>;

  const row = data.excel.rows[0] ?? {};

  // auto-map using substring match against known KPIs
  const mapped = KNOWN_KPIS.map((kpi) => {
    const foundKey = data.excel!.headers.find((h) => h.toLowerCase().includes(kpi.toLowerCase())) ?? null;
    return { kpi, key: foundKey, value: foundKey ? row[foundKey] : null };
  });

  return (
    <div className="grid grid-cols-2 gap-3">
      {mapped.map((m) => (
        <div key={m.kpi} className="rounded-md border border-slate-800/60 bg-slate-950 p-3">
          <div className="text-xs text-slate-400">{m.kpi}</div>
          <div className="mt-1 text-lg font-semibold text-white">{String(m.value ?? "—")}</div>
          <div className="mt-1 text-[11px] text-slate-500">{m.key ?? "(not mapped)"}</div>
        </div>
      ))}
    </div>
  );
}

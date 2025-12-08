"use client";
import React, { useEffect, useState } from "react";

type ExcelShape = { headers: string[]; rows: Record<string, unknown>[] } | null;

const REQUIRED_KPIS = ["Sales", "Cars", "ARO", "CSI"];

export default function KpiMapper() {
  const [excel, setExcel] = useState<ExcelShape>(null);
  const [mapping, setMapping] = useState<Record<string, string | null>>(() => {
    try {
      const raw = localStorage.getItem("dm_weekly_mapping");
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const res = await fetch("/api/samples/weekly");
      if (!res.ok) return;
      const payload = await res.json();
      if (!cancelled) setExcel(payload.excel ?? null);
    }
    load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    // persist mapping
    try {
      localStorage.setItem("dm_weekly_mapping", JSON.stringify(mapping));
    } catch {}
  }, [mapping]);

  const headers = excel?.headers ?? [];

  function update(kpi: string, col: string) {
    setMapping((m) => ({ ...m, [kpi]: col || null }));
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-400">Auto-fill mapping where possible, then adjust manually.</p>
      {REQUIRED_KPIS.map((k) => (
        <div key={k} className="flex items-center gap-2">
          <div className="w-24 text-sm text-slate-300">{k}</div>
          <select
            value={mapping[k] ?? ""}
            onChange={(e) => update(k, e.target.value)}
            className="flex-1 rounded border bg-slate-950 px-2 py-1 text-sm text-white"
          >
            <option value="">(unmapped)</option>
            {headers.map((h) => (
              <option key={h} value={h}>{h}</option>
            ))}
          </select>
        </div>
      ))}

      <div className="flex items-center gap-2">
        <button className="rounded bg-emerald-600 px-3 py-1 text-sm font-semibold text-white" onClick={() => alert('Mapping saved locally.')}>Save</button>
        <button className="rounded border px-3 py-1 text-sm text-slate-200" onClick={() => { localStorage.removeItem('dm_weekly_mapping'); setMapping({}); }}>Reset</button>
      </div>
    </div>
  );
}

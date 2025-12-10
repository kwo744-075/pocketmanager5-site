"use client";

import { useMemo, useState } from "react";
import type { RecognitionDatasetRow } from "@/lib/recognition-captain/types";

export default function ColumnMapperPill({ previewRow }: { previewRow?: RecognitionDatasetRow | null }) {
  const available = useMemo(() => {
    if (!previewRow) return [] as string[];
    const keys = Object.keys(previewRow).filter((k) => k !== "metrics");
    if (previewRow.metrics && typeof previewRow.metrics === "object") {
      const mkeys = Object.keys(previewRow.metrics as any);
      return [...keys, ...mkeys];
    }
    return keys;
  }, [previewRow]);

  // Only include fields relevant to the one-pager KPIs (use NPS instead of CSI)
  const expected = ["shopNumber", "managerName", "carCount", "ticket", "nps", "donations"];
  const [open, setOpen] = useState(false);
  const [mapping, setMapping] = useState<Record<string, string>>(() => {
    try {
      const raw = window.localStorage.getItem("pocketmanager-award-mapper");
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  });

  const save = (next: Record<string, string>) => {
    setMapping(next);
    try {
      window.localStorage.setItem("pocketmanager-award-mapper", JSON.stringify(next));
    } catch (e) {
      // ignore
    }
  };

  return (
    <div className="mt-4">
      <div className="inline-flex items-center gap-2">
        <button type="button" onClick={() => setOpen((s) => !s)} className="rounded-full border px-3 py-1 text-sm">
          Column mapper
        </button>
        <span className="text-xs text-slate-400">{Object.keys(mapping).length ? 'Mapped' : 'Not mapped'}</span>
      </div>
      {open ? (
        <div className="mt-2 rounded-xl border border-slate-800/60 bg-slate-950/60 p-3">
          <p className="text-xs text-slate-400">Select a source column for each expected field.</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {expected.map((field) => (
              <label key={field} className="text-xs">
                <div className="text-slate-400">{field}</div>
                <select className="mt-1 w-full rounded-xl bg-slate-900/40 p-2 text-sm" value={mapping[field] ?? ""} onChange={(e) => save({ ...mapping, [field]: e.target.value })}>
                  <option value="">-- none --</option>
                  {available.map((col) => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

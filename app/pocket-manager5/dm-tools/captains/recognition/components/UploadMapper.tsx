"use client";

import React, { useMemo, useState } from "react";

type UploadMapperProps = {
  visible: boolean;
  onClose: () => void;
  headers: string[];
  sampleRows?: Record<string, any>[];
  existingMapping?: Record<string, string> | null;
  onSave: (mapping: Record<string, string>) => void;
};

const REQUIRED_FIELDS = ["name", "shop", "metric"];

export default function UploadMapper({ visible, onClose, headers, sampleRows = [], existingMapping = null, onSave }: UploadMapperProps) {
  const [mapping, setMapping] = useState<Record<string, string>>(() => existingMapping ?? {});

  const suggestions = useMemo(() => {
    const lower = headers.map((h) => String(h || "").toLowerCase());
    const map: Record<string, string | undefined> = {};
    for (const field of REQUIRED_FIELDS) {
      // simple fuzzy match: look for header containing keyword
      const idx = lower.findIndex((h) => h.includes(field));
      if (idx >= 0) map[field] = headers[idx];
      else map[field] = undefined;
    }
    return map;
  }, [headers]);

  const missing = REQUIRED_FIELDS.filter((f) => !mapping[f] && !suggestions[f]);

  if (!visible) return null;

  return (
    <div className="flex justify-center">
      <div className="w-full max-w-2xl rounded-lg border border-slate-700/60 bg-slate-900/40 p-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium text-slate-200">Upload Mapper</div>
          <div className="text-xs text-slate-400">Map uploaded columns to the canonical schema</div>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {REQUIRED_FIELDS.map((field) => (
            <label key={field} className="text-xs text-slate-300">
              {field}
              <select
                value={mapping[field] ?? suggestions[field] ?? ""}
                onChange={(e) => setMapping((m) => ({ ...m, [field]: e.target.value }))}
                className="mt-1 w-full rounded border bg-slate-800 px-2 py-1 text-sm text-slate-200"
              >
                <option value="">(not mapped)</option>
                {headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
              <div className="mt-1 text-[11px] text-slate-400">Suggestion: {suggestions[field] ?? "—"}</div>
            </label>
          ))}
        </div>

        <div className="mt-4 text-sm text-slate-300">Preview (first 10 rows)</div>
        <div className="mt-2 max-h-48 overflow-auto rounded border border-slate-800/50">
          <table className="w-full text-xs">
            <thead className="bg-slate-900/40">
              <tr>
                {headers.map((h) => (
                  <th key={h} className="px-2 py-1 text-left text-slate-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sampleRows.slice(0, 10).map((r, i) => (
                <tr
                  key={`sr-${i}-${headers.map((h) => String(r[h] ?? '')).join('-').slice(0, 40)}`}
                  className="odd:bg-slate-950/30 even:bg-transparent"
                >
                  {headers.map((h) => (
                    <td key={h} className="px-2 py-1 text-slate-200">{String(r[h] ?? "")}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <div className="text-xs text-slate-400 mr-auto">{missing.length ? `${missing.length} required mappings missing` : 'All required mappings set ✅'}</div>
          <button
            className="rounded-md border border-slate-600 px-3 py-1 text-sm text-slate-200 hover:bg-slate-800/40"
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className="rounded-md bg-emerald-600 px-3 py-1 text-sm font-semibold text-white disabled:opacity-50"
            onClick={() => onSave(mapping)}
            disabled={missing.length > 0}
            type="button"
          >
            Save Mapping
          </button>
        </div>
      </div>
    </div>
  );
}

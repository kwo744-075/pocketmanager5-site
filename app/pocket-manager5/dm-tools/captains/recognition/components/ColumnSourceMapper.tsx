"use client";

import React, { useState } from "react";

type SourceKey = "employee" | "powerRanker" | "customRegion" | "nps" | "donations" | "none";

type PerSourceColumns = {
  nameCol?: string;
  shopCol?: string;
  metricCol?: string;
  sampleHeaders?: string[];
};

type MapperState = {
  perKpi: Record<string, SourceKey>;
  columns: Record<SourceKey, PerSourceColumns>;
};

const SOURCE_LABELS: Record<SourceKey, string> = {
  employee: "Employee performance upload",
  powerRanker: "Power Ranker upload",
  customRegion: "Custom region report",
  nps: "NPS / Email Collection",
  donations: "Donations report",
  none: "(none)",
};

export default function ColumnSourceMapper({ mapper, onChange }: { mapper: MapperState; onChange: (next: MapperState) => void }) {
  const [activeSource, setActiveSource] = useState<SourceKey>('employee');

  const handleFile = async (file: File | null) => {
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase();
    let headers: string[] = [];
    try {
      if (ext === 'csv' || ext === 'txt') {
        const text = await file.text();
        const first = text.split(/\r?\n/).find((l) => l.trim().length > 0) ?? '';
        headers = first.split(',').map((h) => h.trim());
      } else if (ext === 'xlsx' || ext === 'xls') {
        const XLSX = await import('xlsx');
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const range = XLSX.utils.sheet_to_json(sheet, { header: 1, range: 0, raw: false }) as any[];
        const first = Array.isArray(range) && range.length ? range[0] : [];
        headers = (first as string[]).map((h) => String(h ?? '').trim());
      }
    } catch (err) {
      // ignore
    }
    const next = { ...mapper };
    next.columns = { ...next.columns, [activeSource]: { ...(next.columns[activeSource] ?? {}), sampleHeaders: headers } };
    onChange(next);
  };

  const cols = mapper.columns[activeSource] ?? {};
  const headers = cols.sampleHeaders ?? [];

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {(['employee','powerRanker','customRegion','nps','donations'] as SourceKey[]).map((s) => (
          <button key={s} onClick={() => setActiveSource(s)} className={`rounded px-3 py-1 text-xs ${activeSource===s? 'bg-slate-700 text-white':'bg-slate-900/30 text-slate-300'}`}>
            {SOURCE_LABELS[s]}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input type="file" accept=".csv,.xlsx,.xls,.txt" onChange={(e) => handleFile(e.target.files?.[0] ?? null)} />
        <div style={{ color: '#94a3b8', fontSize: 12 }}>{headers.length ? `Detected ${headers.length} columns` : 'No sample loaded'}</div>
      </div>

      {headers.length ? (
        <div style={{ display: 'grid', gap: 8 }}>
          <label className="text-sm text-slate-300">Employee name column</label>
          <select value={cols.nameCol ?? ''} onChange={(e) => { onChange({ ...mapper, columns: { ...mapper.columns, [activeSource]: { ...cols, nameCol: e.target.value } } }); }} className="rounded border bg-slate-900/40 p-2 text-sm">
            <option value="">(not set)</option>
            {headers.map((h) => <option key={h} value={h}>{h}</option>)}
          </select>

          <label className="text-sm text-slate-300">Shop # column</label>
          <select value={cols.shopCol ?? ''} onChange={(e) => { onChange({ ...mapper, columns: { ...mapper.columns, [activeSource]: { ...cols, shopCol: e.target.value } } }); }} className="rounded border bg-slate-900/40 p-2 text-sm">
            <option value="">(not set)</option>
            {headers.map((h) => <option key={h} value={h}>{h}</option>)}
          </select>

          <label className="text-sm text-slate-300">KPI value column (if applicable)</label>
          <select value={cols.metricCol ?? ''} onChange={(e) => { onChange({ ...mapper, columns: { ...mapper.columns, [activeSource]: { ...cols, metricCol: e.target.value } } }); }} className="rounded border bg-slate-900/40 p-2 text-sm">
            <option value="">(not set)</option>
            {headers.map((h) => <option key={h} value={h}>{h}</option>)}
          </select>
        </div>
      ) : null}
    </div>
  );
}

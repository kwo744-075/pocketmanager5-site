"use client";

import { useEffect, useState } from "react";
import { RECOGNITION_METRICS } from "@/lib/recognition-captain/config";

type SourceKey = "employee" | "powerRanker" | "customRegion" | "nps" | "donations" | "none";

const SOURCE_LABELS: Record<SourceKey, string> = {
  employee: "Employee performance upload",
  powerRanker: "Power Ranker upload",
  customRegion: "Custom region report",
  nps: "NPS / Email Collection",
  donations: "Donations report",
  none: "(none)",
};

  const DEFAULT_KEY = "pocketmanager-award-mapper";

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

const defaultPerKpi: Record<string, SourceKey> = {
  overAll: "employee",
  powerRanker1: "powerRanker",
  powerRanker2: "powerRanker",
  powerRanker3: "powerRanker",
  carsVsBudget: "customRegion",
  carsVsComp: "customRegion",
  salesVsBudget: "customRegion",
  salesVsComp: "customRegion",
  nps: "nps",
  emailCollection: "nps",
  pmix: "customRegion",
  big4: "customRegion",
  fuelFilters: "customRegion",
  netAro: "customRegion",
  coolants: "customRegion",
  discounts: "customRegion",
  differentials: "customRegion",
  donations: "donations",
};

const defaultColumns: Record<SourceKey, PerSourceColumns> = {
  employee: {},
  powerRanker: {},
  customRegion: {},
  nps: {},
  donations: {},
  none: {},
};

export default function AwardFilesMapperPill() {
  const [open, setOpen] = useState(false);
  const [mapper, setMapper] = useState<MapperState>({ perKpi: defaultPerKpi, columns: defaultColumns });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DEFAULT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // backward-compat: if stored a simple per-kpi mapping
        if (parsed && typeof parsed === "object" && !parsed.perKpi) {
          setMapper({ perKpi: parsed as Record<string, SourceKey>, columns: defaultColumns });
        } else if (parsed && parsed.perKpi) {
          setMapper(parsed as MapperState);
        } else {
          setMapper({ perKpi: defaultPerKpi, columns: defaultColumns });
        }
        return;
      }
    } catch (e) {
      // ignore parse errors
    }
    setMapper({ perKpi: defaultPerKpi, columns: defaultColumns });
  }, []);

  const save = () => {
    try {
      localStorage.setItem(DEFAULT_KEY, JSON.stringify(mapper));
      alert("Mapper saved to localStorage.");
    } catch (e) {
      alert("Failed to save mapping.");
    }
  };

  const reset = () => {
    setMapper({ perKpi: defaultPerKpi, columns: defaultColumns });
    localStorage.removeItem(DEFAULT_KEY);
  };

  // Limit KPI options to the fixed one-pager KPI set (avoid showing safety/retention/etc.)
  const ONE_PAGER_KPI_KEYS = [
    'overAll',
    'powerRanker1',
    'powerRanker2',
    'powerRanker3',
    'carsVsBudget',
    'carsVsComp',
    'salesVsBudget',
    'salesVsComp',
    'nps',
    'emailCollection',
    'pmix',
    'big4',
    'fuelFilters',
    'netAro',
    'coolants',
    'discounts',
    'differentials',
    'donations',
  ];

  const metrics = (RECOGNITION_METRICS || []).filter((m) => ONE_PAGER_KPI_KEYS.includes(m.key)).length
    ? RECOGNITION_METRICS.filter((m) => ONE_PAGER_KPI_KEYS.includes(m.key))
    : ONE_PAGER_KPI_KEYS.map((k) => ({ key: k, label: k }));

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-full border border-slate-700/70 px-3 py-1 text-xs font-semibold text-slate-200 bg-slate-800/30"
      >
        Mapper
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            zIndex: 60,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div style={{ width: "100%", maxWidth: 900, maxHeight: "96vh", overflow: "auto", padding: 16, background: '#0f172a', borderRadius: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h3 style={{ color: '#fff', fontSize: 16, fontWeight: 700 }}>KPI File Mapper</h3>
              <div>
                <button onClick={() => setOpen(false)} className="rounded bg-rose-600/80 px-3 py-1 text-xs font-semibold text-white">Close</button>
              </div>
            </div>

            <p style={{ color: '#94a3b8', marginBottom: 12 }}>Map each KPI to the source report type. These mappings are used to determine which uploaded file provides the KPI data.</p>

            <div style={{ color: '#cbd5e1' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: '#94a3b8', fontSize: 12 }}>
                    <th style={{ padding: 8 }}>KPI</th>
                    <th style={{ padding: 8 }}>Mapped Source</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.map((m) => (
                    <tr key={m.key} style={{ borderTop: '1px solid rgba(255,255,255,0.03)' }}>
                      <td style={{ padding: 8, verticalAlign: 'middle' }}>{m.label}</td>
                      <td style={{ padding: 8 }}>
                        <select
                          value={mapper.perKpi[m.key] ?? 'none'}
                          onChange={(e) => setMapper({ ...mapper, perKpi: { ...mapper.perKpi, [m.key]: e.target.value as SourceKey } })}
                          className="rounded border bg-slate-900/40 p-2 text-sm"
                        >
                          <option value="none">(none)</option>
                          <option value="employee">{SOURCE_LABELS.employee}</option>
                          <option value="powerRanker">{SOURCE_LABELS.powerRanker}</option>
                          <option value="customRegion">{SOURCE_LABELS.customRegion}</option>
                          <option value="nps">{SOURCE_LABELS.nps}</option>
                          <option value="donations">{SOURCE_LABELS.donations}</option>
                        </select>
                        <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 6 }}>{mapper.perKpi[m.key] ? SOURCE_LABELS[mapper.perKpi[m.key]] : ''}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ marginTop: 12 }}>
                <h4 style={{ color: '#e6eef8', marginBottom: 8 }}>Column mapper (per source)</h4>
                <p style={{ color: '#94a3b8', marginBottom: 8 }}>Upload a sample file per source or enter which columns map to employee name, shop #, and KPI value.</p>
                <ColumnSourceMapper
                  mapper={mapper}
                  onChange={(next) => setMapper(next)}
                />

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                  <button onClick={reset} className="rounded border px-3 py-1 text-xs text-slate-200">Reset Defaults</button>
                  <button onClick={save} className="rounded bg-emerald-600 px-3 py-1 text-xs font-semibold text-white">Save Mapper</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ColumnSourceMapper({ mapper, onChange }: { mapper: MapperState; onChange: (next: MapperState) => void }) {
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

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

const DEFAULT_KEY = "pocketmanager-upload-mapper";

type PerSourceColumns = {
  nameCol?: string;
  shopCol?: string;
  metricCol?: string;
  sampleHeaders?: string[];
  surveyCol?: string;
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

export default function UploadFilesMapperPill() {
  const [open, setOpen] = useState(false);
  const [mapper, setMapper] = useState<MapperState>({ perKpi: defaultPerKpi, columns: defaultColumns });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DEFAULT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
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
      // ignore
    }
    setMapper({ perKpi: defaultPerKpi, columns: defaultColumns });
  }, []);

  const save = () => {
    try {
      localStorage.setItem(DEFAULT_KEY, JSON.stringify(mapper));
      alert("Upload mapper saved to localStorage.");
    } catch (e) {
      alert("Failed to save upload mapper.");
    }
  };

  const reset = () => {
    setMapper({ perKpi: defaultPerKpi, columns: defaultColumns });
    localStorage.removeItem(DEFAULT_KEY);
  };

  const ONE_PAGER_KPI_KEYS = Object.keys(defaultPerKpi);
  const metrics = (RECOGNITION_METRICS || []).filter((m) => ONE_PAGER_KPI_KEYS.includes(m.key)).length
    ? RECOGNITION_METRICS.filter((m) => ONE_PAGER_KPI_KEYS.includes(m.key))
    : ONE_PAGER_KPI_KEYS.map((k) => ({ key: k, label: k }));

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-full border border-slate-700/70 px-3 py-1 text-xs font-semibold text-slate-200 bg-slate-800/30"
      >
        Upload Mapper
      </button>

      {open ? (
        <div role="dialog" aria-modal style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ width: "100%", maxWidth: 900, maxHeight: "96vh", overflow: "auto", padding: 16, background: '#0f172a', borderRadius: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h3 style={{ color: '#fff', fontSize: 16, fontWeight: 700 }}>Upload Mapper</h3>
              <div>
                <button onClick={() => setOpen(false)} className="rounded bg-rose-600/80 px-3 py-1 text-xs font-semibold text-white">Close</button>
              </div>
            </div>

            <p style={{ color: '#94a3b8', marginBottom: 12 }}>Map each KPI to the uploaded file source that should provide the KPI values.</p>

            <div style={{ color: '#cbd5e1' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {(() => {
                  const left: typeof metrics = [] as any;
                  const right: typeof metrics = [] as any;
                  metrics.forEach((m, i) => (i % 2 === 0 ? left : right).push(m));
                  return (
                    <>
                      <div style={{ display: 'grid', gap: 8 }}>
                        {left.map((m) => (
                          <div key={m.key} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.01)' }}>
                            <div style={{ flex: '0 0 42%', color: '#e6eef8', fontSize: 13 }}>{m.label}</div>
                            <div style={{ flex: '1 1 auto' }}>
                              <select
                                value={mapper.perKpi[m.key] ?? 'none'}
                                onChange={(e) => setMapper({ ...mapper, perKpi: { ...mapper.perKpi, [m.key]: e.target.value as SourceKey } })}
                                className="rounded border bg-slate-900/40 p-2 text-sm"
                                style={{ width: '100%' }}
                              >
                                <option value="none">(none)</option>
                                <option value="employee">{SOURCE_LABELS.employee}</option>
                                <option value="powerRanker">{SOURCE_LABELS.powerRanker}</option>
                                <option value="customRegion">{SOURCE_LABELS.customRegion}</option>
                                <option value="nps">{SOURCE_LABELS.nps}</option>
                                <option value="donations">{SOURCE_LABELS.donations}</option>
                              </select>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div style={{ display: 'grid', gap: 8 }}>
                        {right.map((m) => (
                          <div key={m.key} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.01)' }}>
                            <div style={{ flex: '0 0 42%', color: '#e6eef8', fontSize: 13 }}>{m.label}</div>
                            <div style={{ flex: '1 1 auto' }}>
                              <select
                                value={mapper.perKpi[m.key] ?? 'none'}
                                onChange={(e) => setMapper({ ...mapper, perKpi: { ...mapper.perKpi, [m.key]: e.target.value as SourceKey } })}
                                className="rounded border bg-slate-900/40 p-2 text-sm"
                                style={{ width: '100%' }}
                              >
                                <option value="none">(none)</option>
                                <option value="employee">{SOURCE_LABELS.employee}</option>
                                <option value="powerRanker">{SOURCE_LABELS.powerRanker}</option>
                                <option value="customRegion">{SOURCE_LABELS.customRegion}</option>
                                <option value="nps">{SOURCE_LABELS.nps}</option>
                                <option value="donations">{SOURCE_LABELS.donations}</option>
                              </select>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  );
                })()}
              </div>

              <div style={{ marginTop: 12 }}>
                <h4 style={{ color: '#e6eef8', marginBottom: 8 }}>Column mapper (per source)</h4>
                <p style={{ color: '#94a3b8', marginBottom: 8 }}>Upload a sample file per source or enter which columns map to employee name, shop #, and KPI value.</p>
                <ColumnSourceMapper
                  mapper={mapper}
                  onChange={(next) => setMapper(next)}
                />

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                  <button onClick={reset} className="rounded border px-3 py-1 text-xs text-slate-200">Reset Defaults</button>
                  <button onClick={save} className="rounded bg-emerald-600 px-3 py-1 text-xs font-semibold text-white">Save Upload Mapper</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ColumnSourceMapper({ mapper, onChange }: { mapper: any; onChange: (next: any) => void }) {
  const [activeSource, setActiveSource] = useState<"employee" | "powerRanker" | "customRegion" | "nps" | "donations">('employee');

  const handleFile = async (file: File | null) => {
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase();
    let headers: string[] = [];
    let sheetRange: any[] | undefined = undefined;
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
        sheetRange = XLSX.utils.sheet_to_json(sheet, { header: 1, range: 0, raw: false }) as any[];
        const first = Array.isArray(sheetRange) && sheetRange.length ? sheetRange[0] : [];
        headers = (first as string[]).map((h: any) => String(h ?? '').trim());
      }
    } catch (err) {
      // ignore
    }
    const next = { ...mapper };
    // also capture first 3 rows as sampleRows for debugging
    const sampleRows: any[] = (Array.isArray(sheetRange) && sheetRange.length ? (sheetRange as any[]).slice(1, 4).map((r: any) => r) : []) as any[];
    next.columns = { ...next.columns, [activeSource]: { ...(next.columns[activeSource] ?? {}), sampleHeaders: headers, sampleRows } };
    onChange(next);
  };

  const cols = mapper.columns[activeSource] ?? {};
  const headers = cols.sampleHeaders ?? [];
  const sampleRows = cols.sampleRows ?? [];

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {(['employee','powerRanker','customRegion','nps','donations'] as const).map((s) => (
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
            {headers.map((h: string) => <option key={h} value={h}>{h}</option>)}
          </select>

          <label className="text-sm text-slate-300">Shop # column</label>
          <select value={cols.shopCol ?? ''} onChange={(e) => { onChange({ ...mapper, columns: { ...mapper.columns, [activeSource]: { ...cols, shopCol: e.target.value } } }); }} className="rounded border bg-slate-900/40 p-2 text-sm">
            <option value="">(not set)</option>
            {headers.map((h: string) => <option key={h} value={h}>{h}</option>)}
          </select>

          <label className="text-sm text-slate-300">KPI value column (if applicable)</label>
          <select value={cols.metricCol ?? ''} onChange={(e) => { onChange({ ...mapper, columns: { ...mapper.columns, [activeSource]: { ...cols, metricCol: e.target.value } } }); }} className="rounded border bg-slate-900/40 p-2 text-sm">
            <option value="">(not set)</option>
            {headers.map((h: string) => <option key={h} value={h}>{h}</option>)}
          </select>

          <label className="text-sm text-slate-300">Survey count column (NPS uploads)</label>
          <select value={cols.surveyCol ?? ''} onChange={(e) => { onChange({ ...mapper, columns: { ...mapper.columns, [activeSource]: { ...cols, surveyCol: e.target.value } } }); }} className="rounded border bg-slate-900/40 p-2 text-sm">
            <option value="">(not set)</option>
            {headers.map((h: string) => <option key={h} value={h}>{h}</option>)}
          </select>
        </div>
      ) : null}

      {sampleRows && sampleRows.length ? (
        <div style={{ marginTop: 8 }}>
          <p className="text-xs text-slate-400">Sample rows (first {sampleRows.length})</p>
          <div style={{ overflowX: 'auto', border: '1px solid rgba(255,255,255,0.03)', borderRadius: 6, marginTop: 6 }}>
            <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {headers.map((h: string) => (
                    <th key={h} style={{ padding: 6, textAlign: 'left', fontSize: 11, color: '#94a3b8' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sampleRows.map((r: any, i: number) => (
                  <tr key={i} style={{ borderTop: '1px solid rgba(255,255,255,0.02)' }}>
                    {headers.map((h: string) => (
                      <td key={h} style={{ padding: 6, color: '#e6eef8' }}>{String(r[h] ?? '')}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { RECOGNITION_METRICS } from "@/lib/recognition-captain/config";
import styles from './UploadFilesMapperPill.module.css';

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
    <div className={styles.root}>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-full border border-slate-700/70 px-3 py-1 text-xs font-semibold text-slate-200 bg-slate-800/30"
      >
        Upload Mapper
      </button>

      {open ? (
        <div role="dialog" aria-modal className={styles.overlay}>
          <div className={styles.modal}>
            <div className={styles.header}>
              <h3 className={styles.title}>Upload Mapper</h3>
              <div>
                <button onClick={() => setOpen(false)} className="rounded bg-rose-600/80 px-3 py-1 text-xs font-semibold text-white">Close</button>
              </div>
            </div>

            <p className={styles.muted}>Map each KPI to the uploaded file source that should provide the KPI values.</p>

            <div className={styles.content}>
              <div className={styles.twoColGrid}>
                {(() => {
                  const left: typeof metrics = [] as any;
                  const right: typeof metrics = [] as any;
                  metrics.forEach((m, i) => (i % 2 === 0 ? left : right).push(m));
                  return (
                    <>
                      <div className={styles.columnStack}>
                        {left.map((m) => (
                          <div key={m.key} className={styles.metricItem}>
                            <div className={styles.metricLabel}>{m.label}</div>
                            <div className={styles.metricSelectWrap}>
                              <select
                                aria-label={`Select source for ${m.label}`}
                                title={`Select source for ${m.label}`}
                                value={mapper.perKpi[m.key] ?? 'none'}
                                onChange={(e) => setMapper({ ...mapper, perKpi: { ...mapper.perKpi, [m.key]: e.target.value as SourceKey } })}
                                className={`rounded border bg-slate-900/40 p-2 text-sm ${styles.selectFull}`}
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
                      <div className={styles.columnStack}>
                        {right.map((m) => (
                          <div key={m.key} className={styles.metricItem}>
                            <div className={styles.metricLabel}>{m.label}</div>
                            <div className={styles.metricSelectWrap}>
                              <select
                                aria-label={`Select source for ${m.label}`}
                                title={`Select source for ${m.label}`}
                                value={mapper.perKpi[m.key] ?? 'none'}
                                onChange={(e) => setMapper({ ...mapper, perKpi: { ...mapper.perKpi, [m.key]: e.target.value as SourceKey } })}
                                className={`rounded border bg-slate-900/40 p-2 text-sm ${styles.selectFull}`}
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

              <div className={styles.spacedTop}>
                <h4 className={styles.columnHeader}>Column mapper (per source)</h4>
                <p className={styles.columnDesc}>Upload a sample file per source or enter which columns map to employee name, shop #, and KPI value.</p>
                <ColumnSourceMapper
                  mapper={mapper}
                  onChange={(next) => setMapper(next)}
                />

                <div className={styles.buttonRow}>
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
    <div className={styles.columnStack}>
      <div className={styles.flexRowWrap}>
        {(['employee','powerRanker','customRegion','nps','donations'] as const).map((s) => (
          <button key={s} onClick={() => setActiveSource(s)} className={`rounded px-3 py-1 text-xs ${activeSource===s? 'bg-slate-700 text-white':'bg-slate-900/30 text-slate-300'}`}>
            {SOURCE_LABELS[s]}
          </button>
        ))}
      </div>
      <div className={styles.rowCenter}>
        <input aria-label={`Upload sample file for ${SOURCE_LABELS[activeSource]}`} type="file" accept=".csv,.xlsx,.xls,.txt" onChange={(e) => handleFile(e.target.files?.[0] ?? null)} />
        <div className={styles.infoText}>{headers.length ? `Detected ${headers.length} columns` : 'No sample loaded'}</div>
      </div>

      {headers.length ? (
        <div className={styles.columnStack}>
          <label className="text-sm text-slate-300">Employee name column</label>
          <select aria-label="Employee name column" value={cols.nameCol ?? ''} onChange={(e) => { onChange({ ...mapper, columns: { ...mapper.columns, [activeSource]: { ...cols, nameCol: e.target.value } } }); }} className="rounded border bg-slate-900/40 p-2 text-sm">
            <option value="">(not set)</option>
            {headers.map((h: string, idx: number) => <option key={`${h}-${idx}`} value={h}>{h}</option>)}
          </select>

          <label className="text-sm text-slate-300">Shop # column</label>
          <select aria-label="Shop number column" value={cols.shopCol ?? ''} onChange={(e) => { onChange({ ...mapper, columns: { ...mapper.columns, [activeSource]: { ...cols, shopCol: e.target.value } } }); }} className="rounded border bg-slate-900/40 p-2 text-sm">
            <option value="">(not set)</option>
            {headers.map((h: string, idx: number) => <option key={`${h}-${idx}`} value={h}>{h}</option>)}
          </select>

          <label className="text-sm text-slate-300">KPI value column (if applicable)</label>
          <select aria-label="KPI value column" value={cols.metricCol ?? ''} onChange={(e) => { onChange({ ...mapper, columns: { ...mapper.columns, [activeSource]: { ...cols, metricCol: e.target.value } } }); }} className="rounded border bg-slate-900/40 p-2 text-sm">
            <option value="">(not set)</option>
            {headers.map((h: string, idx: number) => <option key={`${h}-${idx}`} value={h}>{h}</option>)}
          </select>

          <label className="text-sm text-slate-300">Survey count column (NPS uploads)</label>
          <select aria-label="Survey count column" value={cols.surveyCol ?? ''} onChange={(e) => { onChange({ ...mapper, columns: { ...mapper.columns, [activeSource]: { ...cols, surveyCol: e.target.value } } }); }} className="rounded border bg-slate-900/40 p-2 text-sm">
            <option value="">(not set)</option>
            {headers.map((h: string) => <option key={h} value={h}>{h}</option>)}
          </select>
        </div>
      ) : null}

      {sampleRows && sampleRows.length ? (
        <div className={styles.spacedTop}>
          <p className="text-xs text-slate-400">Sample rows (first {sampleRows.length})</p>
          <div className={styles.tableWrapper}>
            <table className={styles.sampleTable}>
              <thead>
                <tr>
                  {headers.map((h: string, idx: number) => (
                    <th key={`${h}-${idx}`} className={styles.sampleTh}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                  {sampleRows.map((r: any, i: number) => (
                    <tr key={`sr-${i}-${headers.map((h: string) => String(r[h] ?? '')).join('-').slice(0,40)}`} className={styles.sampleTr}>
                      {headers.map((h: string, idx: number) => (
                        <td key={`${h}-${idx}`} className={styles.sampleTd}>{String(r[h] ?? '')}</td>
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

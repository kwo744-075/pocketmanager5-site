"use client";

import React, { useEffect, useState } from "react";
import ColumnSourceMapper from "./ColumnSourceMapper";
import { RECOGNITION_METRICS } from "@/lib/recognition-captain/config";
import styles from './AwardFilesMapperPill.module.css';

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
    <div className={styles.root}>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-full border border-slate-700/70 px-3 py-1 text-xs font-semibold text-slate-200 bg-slate-800/30"
      >
        Mapper
      </button>

      {open ? (
        <div role="dialog" aria-modal className={styles.overlay}>
          <div className={styles.modal}>
            <div className={styles.header}>
              <h3 className={styles.title}>KPI File Mapper</h3>
              <div>
                <button onClick={() => setOpen(false)} className="rounded bg-rose-600/80 px-3 py-1 text-xs font-semibold text-white">Close</button>
              </div>
            </div>

            <p className={styles.muted}>Map each KPI to the source report type. These mappings are used to determine which uploaded file provides the KPI data.</p>

            <div className={styles.content}>
              <div className={styles.twoColGrid}>
                {/** split metrics into two columns for a denser layout */}
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
                                value={mapper.perKpi[m.key] ?? 'none'}
                                onChange={(e) => setMapper({ ...mapper, perKpi: { ...mapper.perKpi, [m.key]: e.target.value as SourceKey } })}
                                className={`rounded border bg-slate-900/40 p-2 text-sm ${styles.selectFull}`}
                                aria-label={`Select source for ${m.label}`}
                                title={`Select source for ${m.label}`}
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
                                value={mapper.perKpi[m.key] ?? 'none'}
                                onChange={(e) => setMapper({ ...mapper, perKpi: { ...mapper.perKpi, [m.key]: e.target.value as SourceKey } })}
                                className={`rounded border bg-slate-900/40 p-2 text-sm ${styles.selectFull}`}
                                aria-label={`Select source for ${m.label}`}
                                title={`Select source for ${m.label}`}
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



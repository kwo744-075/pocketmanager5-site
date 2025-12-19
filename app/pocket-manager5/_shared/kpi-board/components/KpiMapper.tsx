"use client";

import { useEffect, useMemo } from "react";
import { BookmarkPlus, CheckSquare, Map, Save, Upload } from "lucide-react";
import { CANONICAL_KPIS } from "../types";
import type { CanonicalKpiKey, KpiBoardPreset, KpiColumnMapping, PresetKind } from "../types";

type KpiMapperProps = {
  columns: string[];
  mapping: KpiColumnMapping;
  onMappingChange: (mapping: KpiColumnMapping) => void;
  selectedKpis: CanonicalKpiKey[];
  onSelectedKpisChange: (kpis: CanonicalKpiKey[]) => void;
  presetKind: PresetKind;
  presets?: KpiBoardPreset[];
  loadingPresets?: boolean;
  savingPreset?: boolean;
  onLoadPreset?: (presetId: string) => void;
  onSavePreset?: () => void;
};

const SHOP_CANDIDATES = ["shop", "store", "location", "site"];
const DISTRICT_CANDIDATES = ["district", "dm", "area"];

export function KpiMapper({
  columns,
  mapping,
  onMappingChange,
  selectedKpis,
  onSelectedKpisChange,
  presetKind,
  presets = [],
  loadingPresets,
  savingPreset,
  onLoadPreset,
  onSavePreset,
}: KpiMapperProps) {
  const guessedShop = useMemo(() => findBestMatch(columns, SHOP_CANDIDATES), [columns]);
  const guessedDistrict = useMemo(() => findBestMatch(columns, DISTRICT_CANDIDATES), [columns]);

  useEffect(() => {
    if (!mapping.shopNumber && guessedShop) {
      onMappingChange({ ...mapping, shopNumber: guessedShop });
    }
    if (!mapping.districtName && guessedDistrict) {
      onMappingChange({ ...mapping, districtName: guessedDistrict });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guessedDistrict, guessedShop]);

  const toggleKpi = (key: CanonicalKpiKey) => {
    const next = selectedKpis.includes(key)
      ? selectedKpis.filter((item) => item !== key)
      : [...selectedKpis, key];
    onSelectedKpisChange(next);
  };

  const handleMappingChange = (field: keyof KpiColumnMapping, value: string) => {
    onMappingChange({ ...mapping, [field]: value || undefined });
  };

  return (
    <div className="space-y-4 rounded-3xl border border-white/10 bg-slate-950/70 p-5 shadow-lg shadow-black/30">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.4em] text-slate-500">Step 2 • Map</p>
          <h3 className="text-xl font-semibold text-white">Map columns to canonical KPIs</h3>
          <p className="text-sm text-slate-300">Pick once. We save per preset (Daily / Weekly / Monthly / Period).</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 px-3 py-2 text-[11px] uppercase tracking-[0.3em] text-slate-400">
          Preset • {presetKind.toUpperCase()}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_1.1fr]">
        <div className="space-y-3 rounded-2xl border border-white/5 bg-slate-900/60 p-4">
          <div className="flex items-center gap-2 text-sm text-white">
            <Map className="h-4 w-4 text-emerald-200" />
            <span>Location columns</span>
          </div>
          <label className="text-xs uppercase tracking-[0.35em] text-slate-500">
            Shop / Store number
            <select
              value={mapping.shopNumber ?? ""}
              onChange={(event) => handleMappingChange("shopNumber", event.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white"
            >
              <option value="">Select a column</option>
              {columns.map((col) => (
                <option key={col} value={col}>
                  {col}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs uppercase tracking-[0.35em] text-slate-500">
            District (optional)
            <select
              value={mapping.districtName ?? ""}
              onChange={(event) => handleMappingChange("districtName", event.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white"
            >
              <option value="">Select a column</option>
              {columns.map((col) => (
                <option key={col} value={col}>
                  {col}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs uppercase tracking-[0.35em] text-slate-500">
            Date / Period (optional)
            <select
              value={mapping.date ?? ""}
              onChange={(event) => handleMappingChange("date", event.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white"
            >
              <option value="">Select a column</option>
              {columns.map((col) => (
                <option key={col} value={col}>
                  {col}
                </option>
              ))}
            </select>
          </label>
          <div className="rounded-xl border border-dashed border-white/10 bg-slate-950/80 p-3 text-xs text-slate-300">
            <p className="text-[10px] uppercase tracking-[0.35em] text-slate-500">Hints</p>
            <p className="mt-1">We look for column names that mention Shop, Store, or District to auto-fill these picks.</p>
          </div>
        </div>

        <div className="space-y-3 rounded-2xl border border-white/5 bg-slate-900/60 p-4">
          <div className="flex items-center gap-2 text-sm text-white">
            <CheckSquare className="h-4 w-4 text-emerald-200" />
            <span>KPIs to show</span>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {CANONICAL_KPIS.map((kpi) => (
              <div key={kpi.key} className="rounded-xl border border-slate-800/70 bg-slate-950/70 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-white">{kpi.label}</p>
                    <p className="text-[11px] text-slate-400">Default: {kpi.defaultDirection === "higher" ? "Higher" : "Lower"} is better</p>
                  </div>
                  <input
                    type="checkbox"
                    aria-label={`Include ${kpi.label}`}
                    checked={selectedKpis.includes(kpi.key)}
                    onChange={() => toggleKpi(kpi.key)}
                    className="h-4 w-4 rounded border border-slate-700 bg-slate-900 accent-emerald-400"
                  />
                </div>
                <label className="mt-2 block text-[11px] uppercase tracking-[0.3em] text-slate-500">
                  Column
                  <select
                    value={mapping[kpi.key] ?? ""}
                    onChange={(event) => handleMappingChange(kpi.key, event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-2 py-2 text-sm text-white"
                  >
                    <option value="">Not mapped</option>
                    {columns.map((col) => (
                      <option key={`${kpi.key}-${col}`} value={col}>
                        {col}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/5 bg-slate-900/60 p-4">
        <div className="space-y-1 text-xs text-slate-300">
          <p className="font-semibold text-white">Save or reuse mappings</p>
          <p>Presets store mapping + goals per cadence so Real Mode stays clean.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2">
            <Upload className="h-4 w-4 text-slate-400" />
            <select
              aria-label="Load saved mapping preset"
              className="rounded-full border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white"
              onChange={(event) => {
                const id = event.target.value;
                if (id && onLoadPreset) onLoadPreset(id);
              }}
            >
              <option value="">{loadingPresets ? "Loading presets..." : "Load preset"}</option>
              {presets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.title}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={() => onSavePreset && onSavePreset()}
            className="inline-flex items-center gap-2 rounded-full border border-emerald-400/50 bg-emerald-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-emerald-100 transition hover:border-emerald-300"
            disabled={savingPreset}
          >
            <Save className="h-4 w-4" />
            {savingPreset ? "Saving..." : "Save mapping"}
          </button>
          <div className="flex items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-[11px] uppercase tracking-[0.35em] text-slate-400">
            <BookmarkPlus className="h-4 w-4" />
            {presets.length ? `${presets.length} presets` : "No presets yet"}
          </div>
        </div>
      </div>
    </div>
  );
}

function findBestMatch(columns: string[], needles: string[]) {
  const lower = columns.map((col) => col.toLowerCase());
  for (const needle of needles) {
    const hitIndex = lower.findIndex((col) => col.includes(needle));
    if (hitIndex >= 0) {
      return columns[hitIndex];
    }
  }
  return undefined;
}

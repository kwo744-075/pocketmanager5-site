"use client";

import { useMemo } from "react";
import { AlertCircle, BadgeCheck, Flame, Plus } from "lucide-react";
import { CANONICAL_KPIS } from "../types";
import type { CanonicalKpiKey, GoalMap, NormalizedRow, UploadSectionKind } from "../types";
import { formatKpiValue } from "../data";

type KpiBoardGridProps = {
  rows: NormalizedRow[];
  goals: GoalMap;
  selectedKpis: CanonicalKpiKey[];
  trainingMode: boolean;
  sectionKind: UploadSectionKind;
  district?: string | null;
  onSelectTip?: (kpi: CanonicalKpiKey) => void;
};

type StatusTone = "hit" | "miss" | "missing";

const SUM_KEYS = new Set<CanonicalKpiKey>(["cars", "sales"]);

export function KpiBoardGrid({ rows, goals, selectedKpis, trainingMode, sectionKind, district, onSelectTip }: KpiBoardGridProps) {
  const filteredRows = useMemo(
    () => rows.filter((row) => row.sectionKind === sectionKind && (!district || row.districtName === district)),
    [district, rows, sectionKind],
  );

  const aggregates = useMemo(() => {
    const rollup: Record<CanonicalKpiKey, number | null> = {} as Record<CanonicalKpiKey, number | null>;
    selectedKpis.forEach((key) => {
      const values = filteredRows
        .map((row) => row.values[key])
        .filter((value): value is number => typeof value === "number" && !Number.isNaN(value));
      if (!values.length) {
        rollup[key] = null;
        return;
      }
      if (SUM_KEYS.has(key)) {
        rollup[key] = values.reduce((sum, value) => sum + value, 0);
      } else {
        rollup[key] = values.reduce((sum, value) => sum + value, 0) / values.length;
      }
    });
    return rollup;
  }, [filteredRows, selectedKpis]);

  const tiles = useMemo(() => {
    const metaLookup = new Map(CANONICAL_KPIS.map((item) => [item.key, item]));
    return selectedKpis.map((key) => {
      const actual = aggregates[key] ?? null;
      const goalConfig = goals[key];
      const goalValue = goalConfig?.goal ?? null;
      const direction = goalConfig?.direction ?? metaLookup.get(key)?.defaultDirection ?? "higher";
      const status: StatusTone =
        actual == null || goalValue == null
          ? "missing"
          : direction === "higher"
          ? actual >= goalValue
            ? "hit"
            : "miss"
          : actual <= goalValue
          ? "hit"
          : "miss";
      return { key, actual, goalValue, direction, status, meta: metaLookup.get(key) };
    });
  }, [aggregates, goals, selectedKpis]);

  const grouped = useMemo(() => {
    const groups: Record<string, typeof tiles> = {};
    tiles.forEach((tile) => {
      const groupName = tile.meta?.group ?? "other";
      if (!groups[groupName]) groups[groupName] = [];
      groups[groupName].push(tile);
    });
    return groups;
  }, [tiles]);

  if (!rows.length) {
    return (
      <div className="rounded-3xl border border-dashed border-white/10 bg-slate-950/70 p-6 text-center text-sm text-slate-300">
        <p>Upload a workbook to render the KPI board.</p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-5 shadow-lg shadow-black/40">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.4em] text-slate-500">Step 4 • Review board</p>
          <h3 className="text-xl font-semibold text-white">KPI board view</h3>
          <p className="text-sm text-slate-300">Lightweight tiles for the selected section and district.</p>
        </div>
        <div className="rounded-full border border-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.35em] text-slate-400">
          {filteredRows.length ? `${filteredRows.length} rows` : "No rows"}
        </div>
      </div>

      <div className="mt-4 grid gap-5 lg:grid-cols-3">
        {Object.entries(grouped).map(([group, groupTiles]) => (
          <div key={group} className="rounded-2xl border border-slate-800/70 bg-slate-900/60 p-4">
            <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.35em] text-slate-500">
              <BadgeCheck className="h-4 w-4 text-emerald-200" />
              <span>{groupLabel(group)}</span>
            </div>
            <div className="grid gap-3">
              {groupTiles.map((tile) => (
                <div
                  key={tile.key}
                  className={`relative overflow-hidden rounded-xl border px-4 py-3 transition ${
                    toneClass(tile.status)
                  }`}
                >
                  {trainingMode ? (
                    <button
                      type="button"
                      onClick={() => onSelectTip?.(tile.key)}
                      className="absolute right-3 top-3 inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition hover:border-emerald-300 hover:text-emerald-100"
                      aria-label={`Training tips for ${tile.meta?.label ?? tile.key}`}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-white">{tile.meta?.label ?? tile.key}</p>
                      <p className="text-[11px] uppercase tracking-[0.35em] text-slate-400">
                        {tile.direction === "higher" ? "Higher is better" : "Lower is better"}
                      </p>
                    </div>
                    <span className={`h-2 w-2 rounded-full ${dotClass(tile.status)}`} aria-hidden />
                  </div>
                  <div className="mt-3 grid grid-cols-[1.1fr_1fr_0.8fr] items-center gap-3 text-sm text-slate-200">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.35em] text-slate-500">Actual</p>
                      <p className="text-lg font-semibold text-white">{formatKpiValue(tile.key, tile.actual)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.35em] text-slate-500">Goal</p>
                      <p className="text-lg text-slate-200">{formatKpiValue(tile.key, tile.goalValue)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.35em] text-slate-500">Variance</p>
                      <Variance value={variance(tile.actual, tile.goalValue)} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {!filteredRows.length ? (
        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          <AlertCircle className="h-4 w-4" />
          <span>Upload data or switch section to see tiles.</span>
        </div>
      ) : null}
    </div>
  );
}

function variance(actual: number | null, goal: number | null): number | null {
  if (actual == null || goal == null) return null;
  return actual - goal;
}

function toneClass(status: StatusTone) {
  switch (status) {
    case "hit":
      return "border-emerald-500/40 bg-emerald-500/10";
    case "miss":
      return "border-rose-500/40 bg-rose-500/10";
    default:
      return "border-white/10 bg-slate-900/60";
  }
}

function dotClass(status: StatusTone) {
  switch (status) {
    case "hit":
      return "bg-emerald-300 shadow-[0_0_0_6px_rgba(16,185,129,0.12)]";
    case "miss":
      return "bg-rose-300 shadow-[0_0_0_6px_rgba(244,63,94,0.12)]";
    default:
      return "bg-slate-500";
  }
}

function groupLabel(value: string) {
  const lookup: Record<string, string> = {
    traffic: "Traffic & Sales",
    controllables: "Controllables",
    addOns: "Add-ons",
    experience: "Experience",
    discounts: "Discounts",
  };
  return lookup[value] ?? "KPIs";
}

function Variance({ value }: { value: number | null }) {
  if (value == null) {
    return <span className="text-slate-500">--</span>;
  }
  const positive = value >= 0;
  const tone = positive ? "text-emerald-100" : "text-rose-100";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-sm ${positive ? "border-emerald-400/50 bg-emerald-500/10" : "border-rose-400/50 bg-rose-500/10"} ${tone}`}>
      {positive ? "+" : "-"}
      {Math.abs(value).toFixed(1)}
      <Flame className="h-4 w-4 opacity-60" aria-hidden />
    </span>
  );
}

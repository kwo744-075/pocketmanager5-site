"use client";

import React, { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import type { CanonicalKpiKey, GoalDirection, GoalMap, NormalizedRow, UploadSectionKind } from "../types";
import { CANONICAL_KPIS } from "../types";

const DAY_COLUMNS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "WTD"] as const;

type BoardCell = { actual: string; goal: string };
type BoardValues = Record<string, Record<(typeof DAY_COLUMNS)[number], BoardCell>>;

type FallbackAggregate = {
  actual: number | null;
  goal: number | null;
  direction: GoalDirection;
};

type KpiBoardGridProps = {
  rows: NormalizedRow[];
  goals: GoalMap;
  selectedKpis: CanonicalKpiKey[];
  trainingMode: boolean;
  snipMode?: boolean;
  sectionKind: UploadSectionKind;
  district?: string | null;
  boardValues: BoardValues;
  onChangeCell: (kpi: string, day: (typeof DAY_COLUMNS)[number], field: "goal" | "actual", value: string) => void;
  fallbackAggregates: Record<string, FallbackAggregate>;
  onSelectTip?: (kpi: CanonicalKpiKey) => void;
};

export function KpiBoardGrid({
  goals,
  selectedKpis,
  trainingMode,
  snipMode = false,
  district,
  boardValues,
  onChangeCell,
  fallbackAggregates,
  onSelectTip,
}: KpiBoardGridProps) {
  const [notes, setNotes] = useState({ recognition: "", huddle: "", newsletter: "" });

  const metaLookup = useMemo(() => new Map(CANONICAL_KPIS.map((item) => [item.key, item])), []);

  const resolvedRows = useMemo(
    () =>
      selectedKpis.map((key) => {
        const cells = boardValues[key] ?? {};
        const wtdCell = cells.WTD ?? { actual: "", goal: "" };
        const actual = parseNumber(wtdCell.actual, fallbackAggregates[key]?.actual);
        const goalValue = parseNumber(wtdCell.goal, fallbackAggregates[key]?.goal ?? goals[key]?.goal ?? null);
        const direction = goals[key]?.direction ?? fallbackAggregates[key]?.direction ?? metaLookup.get(key)?.defaultDirection ?? "higher";
        const status = resolveStatus(actual, goalValue, direction);
        return { key, cells, meta: metaLookup.get(key), status, direction };
      }),
    [boardValues, fallbackAggregates, goals, metaLookup, selectedKpis],
  );

  return (
    <div
      className={`space-y-4 rounded-3xl border border-white/10 bg-slate-950/80 ${snipMode ? "p-2 shadow-none" : "p-4 shadow-lg shadow-black/40"}`}
    >
      {!snipMode ? (
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-full border border-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.35em] text-slate-400">KPI board</div>
            {district ? <span className="text-xs text-slate-300">District: {district}</span> : null}
          </div>
          <div className="text-[10px] uppercase tracking-[0.35em] text-slate-500">Inline editable</div>
        </div>
      ) : null}

      <div className={`overflow-x-auto rounded-2xl border border-slate-900 bg-slate-950/90 ${snipMode ? "shadow-none" : ""}`}>
        <table className={`min-w-full ${snipMode ? "text-[11px]" : "text-[12px]"} text-slate-100`}>
          <thead>
            <tr className="bg-slate-900 text-[11px] uppercase tracking-[0.3em] text-slate-400">
              <th className="border border-slate-800 px-3 py-2 text-left">KPI</th>
              <th className="border border-slate-800 px-3 py-2 text-left">Budget</th>
              {DAY_COLUMNS.map((day) => (
                <th key={`${day}-header`} className="border border-slate-800 px-3 py-2 text-center" colSpan={2}>
                  {day}
                </th>
              ))}
              <th className="border border-slate-800 px-3 py-2 text-left">WTD vs Goal</th>
            </tr>
            <tr className="bg-slate-900/80 text-[10px] uppercase tracking-[0.3em] text-slate-500">
              <th className="border border-slate-900 px-3 py-2 text-left" />
              <th className="border border-slate-900 px-3 py-2 text-left" />
              {DAY_COLUMNS.map((day) => (
                <React.Fragment key={`${day}-sub`}>
                  <th className="border border-slate-900 px-2 py-1 text-left">Goal</th>
                  <th className="border border-slate-900 px-2 py-1 text-left">Actual</th>
                </React.Fragment>
              ))}
              <th className="border border-slate-900 px-3 py-2 text-left" />
            </tr>
          </thead>
          <tbody>
            {resolvedRows.map((row) => (
              <tr key={row.key} className={row.status === "hit" ? "bg-emerald-500/5" : row.status === "miss" ? "bg-rose-500/5" : "bg-slate-950"}>
                <td className="relative border border-slate-900 px-3 py-2 font-semibold">
                  <div className="flex items-center gap-2">
                    <span>{row.meta?.label ?? row.key}</span>
                    {trainingMode ? (
                      <button
                        type="button"
                        onClick={() => onSelectTip?.(row.key)}
                        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition hover:border-emerald-300 hover:text-emerald-100"
                        aria-label={`Training tips for ${row.meta?.label ?? row.key}`}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </div>
                </td>
                <td className="border border-slate-900 px-2 py-2">
                  <input
                    value={row.cells.WTD?.goal ?? ""}
                    onChange={(event) => onChangeCell(row.key, "WTD", "goal", event.target.value)}
                    className="w-full rounded-md border border-slate-800 bg-slate-900 px-2 py-1 text-xs text-white"
                    aria-label={`${row.meta?.label ?? row.key} budget`}
                  />
                </td>
                {DAY_COLUMNS.map((day) => {
                  const cell = row.cells[day] ?? { actual: "", goal: "" };
                  const isWtd = day === "WTD";
                  return (
                    <React.Fragment key={`${row.key}-${day}`}>
                      <td className="border border-slate-900 px-2 py-2">
                        <input
                          value={cell.goal}
                          onChange={(event) => onChangeCell(row.key, day, "goal", event.target.value)}
                          className={`w-full rounded-md border ${isWtd ? "border-amber-300/50 bg-amber-500/10" : "border-slate-800 bg-slate-900"} px-2 py-1 text-xs text-white`}
                          aria-label={`${row.meta?.label ?? row.key} ${day} goal`}
                        />
                      </td>
                      <td className="border border-slate-900 px-2 py-2">
                        <input
                          value={cell.actual}
                          onChange={(event) => onChangeCell(row.key, day, "actual", event.target.value)}
                          className={`w-full rounded-md border ${isWtd ? "border-emerald-300/50 bg-emerald-500/10" : "border-slate-800 bg-slate-900"} px-2 py-1 text-xs text-white`}
                          aria-label={`${row.meta?.label ?? row.key} ${day} actual`}
                        />
                      </td>
                    </React.Fragment>
                  );
                })}
                <td className="border border-slate-900 px-3 py-2 text-sm font-semibold">
                  <StatusPill status={row.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-3">
          <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.3em] text-slate-500">
            <span>Labor</span>
            <span>Daily</span>
          </div>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {["Budget", "Actual", "Variance", "Notes"].map((label) => (
              <input
                key={label}
                placeholder={label}
                className="rounded-md border border-slate-800 bg-slate-950 px-2 py-2 text-xs text-white placeholder:text-slate-500"
              />
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-3">
          <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.3em] text-slate-500">
            <span>NPS / Email</span>
            <span>Touchpoints</span>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {["NPS", "Email %", "Bay Time"].map((label) => (
              <input
                key={label}
                placeholder={label}
                className="rounded-md border border-slate-800 bg-slate-950 px-2 py-2 text-xs text-white placeholder:text-slate-500"
              />
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {[
          { key: "recognition", label: "Recognition" },
          { key: "huddle", label: "Daily Huddle" },
          { key: "newsletter", label: "Newsletter Topics" },
        ].map((item) => (
          <div key={item.key} className="rounded-2xl border border-amber-500/40 bg-amber-500/5 p-3">
            <div className="text-[11px] uppercase tracking-[0.35em] text-amber-200">{item.label}</div>
            <textarea
              value={notes[item.key as keyof typeof notes]}
              onChange={(event) => setNotes((prev) => ({ ...prev, [item.key]: event.target.value }))}
              className="mt-2 h-24 w-full rounded-lg border border-amber-500/40 bg-slate-950 px-3 py-2 text-sm text-white"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: "hit" | "miss" | "missing" }) {
  if (status === "missing") return <span className="rounded-full border border-white/20 px-3 py-1 text-[11px] uppercase tracking-[0.3em] text-slate-300">--</span>;
  if (status === "hit") return <span className="rounded-full border border-emerald-400/60 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-emerald-100">Hit</span>;
  return <span className="rounded-full border border-rose-400/60 bg-rose-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-rose-100">Miss</span>;
}

function resolveStatus(actual: number | null, goal: number | null, direction: GoalDirection) {
  if (actual == null || goal == null) return "missing" as const;
  if (direction === "higher") return actual >= goal ? ("hit" as const) : ("miss" as const);
  return actual <= goal ? ("hit" as const) : ("miss" as const);
}

function parseNumber(value: string, fallback: number | null): number | null {
  if (value === undefined || value === null || value === "") return fallback ?? null;
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return fallback ?? null;
  return parsed;
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Camera, ToggleLeft, ToggleRight, Upload, Cog } from "lucide-react";
import { KpiBoardGrid } from "../../_shared/kpi-board/components/KpiBoardGrid";
import { KpiMapper } from "../../_shared/kpi-board/components/KpiMapper";
import { TrainingTipOverlay } from "../../_shared/kpi-board/components/TrainingTipOverlay";
import { UploadBox } from "../../_shared/kpi-board/components/UploadBox";
import {
  DEFAULT_GOALS,
  DEFAULT_SELECTED_KPIS,
  PRESET_OPTIONS,
  SAMPLE_ROWS,
  TRAINING_TIPS,
  deriveDistricts,
  normalizeNumber,
} from "../../_shared/kpi-board/data";
import type {
  CanonicalKpiKey,
  GoalDirection,
  GoalMap,
  KpiColumnMapping,
  NormalizedRow,
  PresetKind,
  UploadParseResult,
  UploadSectionKind,
} from "../../_shared/kpi-board/types";
import { CANONICAL_KPIS } from "../../_shared/kpi-board/types";

type ToastState = { message: string; tone: "info" | "error" | "success" } | null;

const DAY_COLUMNS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "WTD"] as const;

export default function KpiBoardPage() {
  const [presetKind, setPresetKind] = useState<PresetKind>("daily");
  const [sectionKind, setSectionKind] = useState<UploadSectionKind>("daily");
  const [trainingMode, setTrainingMode] = useState(false);
  const [snipMode, setSnipMode] = useState(false);
  const [mapperOpen, setMapperOpen] = useState(false);
  const [mapping, setMapping] = useState<KpiColumnMapping>({});
  const [selectedKpis, setSelectedKpis] = useState<CanonicalKpiKey[]>(DEFAULT_SELECTED_KPIS);
  const [goals, setGoals] = useState<GoalMap>(DEFAULT_GOALS);
  const [rows, setRows] = useState<NormalizedRow[]>(SAMPLE_ROWS);
  const [boardValues, setBoardValues] = useState<Record<string, Record<(typeof DAY_COLUMNS)[number], { actual: string; goal: string }>>>({});
  const [activeDistrict, setActiveDistrict] = useState<string | null>(deriveDistricts(SAMPLE_ROWS)[0] ?? null);
  const [activeTip, setActiveTip] = useState<CanonicalKpiKey | null>(null);
  const [uploadResult, setUploadResult] = useState<UploadParseResult | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [showUploadBox, setShowUploadBox] = useState(false);

  useEffect(() => {
    if (activeDistrict) return;
    const districts = deriveDistricts(rows);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (districts.length) setActiveDistrict(districts[0]);
  }, [activeDistrict, rows]);

  const handleUploadParsed = (result: UploadParseResult) => {
    setUploadResult(result);
    setSectionKind(result.sectionKind);
    setToast({ message: `Parsed ${result.columns.length} columns from ${result.sheetName}`, tone: "success" });
    const stored = { ...result, mapping };
    window.localStorage.setItem("kpi-board-last-upload", JSON.stringify(stored));
  };

  const applyMappingToRows = useCallback(() => {
    if (!uploadResult) {
      setRows(SAMPLE_ROWS);
      return;
    }
    const normalized = buildNormalizedRows(uploadResult.rows, mapping, selectedKpis, uploadResult.sectionKind);
    if (normalized.length) {
      setRows(normalized);
      setActiveDistrict(deriveDistricts(normalized)[0] ?? null);
    } else {
      setRows(SAMPLE_ROWS);
    }
  }, [uploadResult, mapping, selectedKpis]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    applyMappingToRows();
  }, [applyMappingToRows]);

  const boardAggregates = useMemo(
    () => aggregateForExport(rows, selectedKpis, goals, sectionKind, activeDistrict),
    [rows, selectedKpis, goals, sectionKind, activeDistrict],
  );

  const resolvedBoardValues = useMemo(() => {
    const next = { ...boardValues };
    const ensureKey = (key: string, actualDefault: number | null, goalDefault: number | null) => {
      const existing = next[key] ?? {};
      const filled: Record<(typeof DAY_COLUMNS)[number], { actual: string; goal: string }> = {} as Record<
        (typeof DAY_COLUMNS)[number],
        { actual: string; goal: string }
      >;
      DAY_COLUMNS.forEach((day) => {
        const cell = existing[day] ?? { actual: "", goal: "" };
        if (day === "WTD") {
          if (!cell.actual && actualDefault != null) cell.actual = String(actualDefault);
          if (!cell.goal && goalDefault != null) cell.goal = String(goalDefault);
        }
        filled[day] = cell;
      });
      next[key] = filled;
    };
    selectedKpis.forEach((key) => {
      const aggregate = boardAggregates.find((item) => item.key === key);
      const goalDefault = goals[key]?.goal ?? aggregate?.goal ?? null;
      ensureKey(key, aggregate?.actual ?? null, goalDefault);
    });
    return next;
  }, [boardAggregates, goals, selectedKpis, boardValues]);

  const handleCellChange = useCallback(
    (kpi: string, day: (typeof DAY_COLUMNS)[number], field: "goal" | "actual", value: string) => {
      const keyAsCanonical = kpi as CanonicalKpiKey;
      setBoardValues((prev) => {
        const next = { ...prev };
        const entry = next[kpi] ?? ({} as Record<(typeof DAY_COLUMNS)[number], { actual: string; goal: string }>);
        const cell = entry[day] ?? { actual: "", goal: "" };
        next[kpi] = { ...entry, [day]: { ...cell, [field]: value } };
        return next;
      });
      if (day === "WTD" && field === "goal") {
        const numeric = value === "" ? null : Number(value);
        setGoals((prev) => ({
          ...prev,
          [keyAsCanonical]: { goal: Number.isNaN(numeric) ? null : numeric, direction: prev[keyAsCanonical]?.direction ?? "higher" },
        }));
      }
    },
    [],
  );

  const fallbackAggregates = useMemo(() => {
    const lookup: Record<string, { actual: number | null; goal: number | null; direction: GoalDirection }> = {};
    boardAggregates.forEach((item) => {
      lookup[item.key] = {
        actual: item.actual,
        goal: item.goal ?? null,
        direction: goals[item.key]?.direction ?? "higher",
      };
    });
    return lookup;
  }, [boardAggregates, goals]);

  const districts = useMemo(() => deriveDistricts(rows), [rows]);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-10 space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-800/80 bg-slate-900/70 px-4 py-3">
          <div className="flex items-center gap-3">
            <Link
              href="/pocket-manager5"
              className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-sm font-semibold text-emerald-200 transition hover:border-emerald-300"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
            <div className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">KPI Board</div>
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <span className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 font-semibold uppercase tracking-[0.35em] text-emerald-100">
                {sectionKind.toUpperCase()}
              </span>
              <select
                aria-label="Select district"
                value={activeDistrict ?? ""}
                onChange={(event) => setActiveDistrict(event.target.value || null)}
                className="rounded-full border border-slate-800 bg-slate-950 px-3 py-1 text-xs text-white"
              >
                <option value="">All districts</option>
                {districts.map((district) => (
                  <option key={district} value={district}>
                    {district}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ModeToggle trainingMode={trainingMode} onToggle={() => setTrainingMode((prev) => !prev)} />
            <PresetToggle presetKind={presetKind} onChange={setPresetKind} />
            <button
              type="button"
              onClick={() => setSnipMode((prev) => !prev)}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.35em] ${
                snipMode ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-100" : "border-white/10 text-slate-300"
              }`}
              aria-pressed={snipMode}
            >
              <Camera className="h-4 w-4" />
              Snip mode
            </button>
            <button
              type="button"
              onClick={() => setShowUploadBox(true)}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-900 px-3 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-white hover:border-emerald-300"
              aria-label="Upload workbook"
            >
              <Upload className="h-4 w-4" /> Upload
            </button>
            <button
              type="button"
              onClick={() => setMapperOpen(true)}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-900 px-3 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-white hover:border-emerald-300"
              aria-label="Open mapper"
            >
              <Cog className="h-4 w-4" /> Mapper
            </button>
          </div>
        </header>

        <KpiBoardGrid
          rows={rows}
          goals={goals}
          selectedKpis={selectedKpis}
          trainingMode={trainingMode}
          sectionKind={sectionKind}
        district={activeDistrict}
        boardValues={resolvedBoardValues}
        onChangeCell={handleCellChange}
        fallbackAggregates={fallbackAggregates}
        onSelectTip={(kpi) => setActiveTip(kpi)}
        snipMode={snipMode}
      />

        {toast ? (
          <div
            className={`fixed bottom-6 right-6 z-50 rounded-2xl border px-4 py-3 text-sm shadow-lg ${
              toast.tone === "success"
                ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-50"
                : toast.tone === "error"
                ? "border-rose-400/60 bg-rose-500/10 text-rose-50"
                : "border-white/10 bg-slate-900/80 text-slate-100"
            }`}
          >
            {toast.message}
          </div>
        ) : null}
      </div>
      <TrainingTipOverlay activeKpi={activeTip} tips={TRAINING_TIPS} onClose={() => setActiveTip(null)} />
      {showUploadBox ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-xl rounded-3xl border border-slate-800 bg-slate-950 p-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Upload workbook</h2>
              <button type="button" onClick={() => setShowUploadBox(false)} className="text-slate-400 hover:text-white">
                Close
              </button>
            </div>
            <div className="mt-4">
              <UploadBox
                onParsed={(result) => {
                  handleUploadParsed(result);
                  setShowUploadBox(false);
                }}
                defaultSection={sectionKind}
                compact
              />
            </div>
          </div>
        </div>
      ) : null}
      {mapperOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-4xl rounded-3xl border border-slate-800 bg-slate-950 p-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Mapper</h2>
              <button type="button" onClick={() => setMapperOpen(false)} className="text-slate-400 hover:text-white">
                Close
              </button>
            </div>
            <div className="mt-4">
              <KpiMapper
                columns={
                  uploadResult?.columns ??
                  SAMPLE_ROWS.reduce<string[]>((cols, row) => {
                    const base = ["Shop", "District"];
                    const kpiCols = Object.keys(row.values);
                    return cols.length ? cols : [...base, ...kpiCols];
                  }, [])
                }
                mapping={mapping}
                onMappingChange={setMapping}
                selectedKpis={selectedKpis}
                onSelectedKpisChange={setSelectedKpis}
                presetKind={presetKind}
                presets={[]}
                loadingPresets={false}
                savingPreset={false}
                onLoadPreset={() => {}}
                onSavePreset={() => {}}
              />
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function ModeToggle({ trainingMode, onToggle }: { trainingMode: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-900/60 px-3 py-2 text-sm font-semibold text-white transition hover:border-emerald-400/50"
      aria-pressed={trainingMode}
      aria-label="Toggle training mode"
    >
      {trainingMode ? <ToggleRight className="h-5 w-5 text-emerald-300" /> : <ToggleLeft className="h-5 w-5 text-slate-400" />}
      {trainingMode ? "Training" : "Live"}
    </button>
  );
}

function PresetToggle({ presetKind, onChange }: { presetKind: PresetKind; onChange: (kind: PresetKind) => void }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-900/60 p-1 text-xs">
      {PRESET_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`rounded-full px-3 py-1 font-semibold uppercase tracking-[0.35em] ${presetKind === option.value ? "bg-emerald-500/20 text-emerald-100" : "text-slate-300"}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function buildNormalizedRows(
  rawRows: Record<string, unknown>[],
  mapping: KpiColumnMapping,
  selectedKpis: CanonicalKpiKey[],
  sectionKind: UploadSectionKind,
): NormalizedRow[] {
  const percentKeys = new Set(CANONICAL_KPIS.filter((kpi) => kpi.format === "percent").map((kpi) => kpi.key));
  const normalized: NormalizedRow[] = [];
  rawRows.forEach((row) => {
    const shopRaw = mapping.shopNumber ? row[mapping.shopNumber] : null;
    const shop = shopRaw == null ? null : String(shopRaw).trim();
    if (!shop) return;
    const district = mapping.districtName ? String(row[mapping.districtName] ?? "").trim() || null : null;
    const dateLabel = mapping.date ? String(row[mapping.date] ?? "").trim() || null : null;
    const values: NormalizedRow["values"] = {};
    selectedKpis.forEach((key) => {
      const column = mapping[key];
      if (!column) return;
      const parsed = normalizeNumber(row[column]);
      if (parsed == null) {
        values[key] = null;
        return;
      }
      values[key] = percentKeys.has(key) && parsed > 1 ? parsed / 100 : parsed;
    });
    normalized.push({
      shopNumber: shop,
      districtName: district,
      sectionKind,
      dateLabel,
      values,
    });
  });
  return normalized;
}

function aggregateForExport(
  rows: NormalizedRow[],
  selectedKpis: CanonicalKpiKey[],
  goals: GoalMap,
  sectionKind: UploadSectionKind,
  district: string | null,
) {
  const filtered = rows.filter((row) => row.sectionKind === sectionKind && (!district || row.districtName === district));
  const sumKeys = new Set<CanonicalKpiKey>(["cars", "sales"]);
  const aggregates = selectedKpis.map((key) => {
    const values = filtered
      .map((row) => row.values[key])
      .filter((value): value is number => typeof value === "number" && !Number.isNaN(value));
    const actual = values.length
      ? sumKeys.has(key)
        ? values.reduce((sum, value) => sum + value, 0)
        : values.reduce((sum, value) => sum + value, 0) / values.length
      : null;
    const goalConfig = goals[key];
    const goalValue = goalConfig?.goal ?? null;
    const direction = goalConfig?.direction ?? "higher";
    const status =
      actual == null || goalValue == null
        ? "missing"
        : direction === "higher"
        ? actual >= goalValue
          ? "hit"
          : "miss"
        : actual <= goalValue
        ? "hit"
        : "miss";
    const meta = CANONICAL_KPIS.find((item) => item.key === key);
    return {
      key,
      label: meta?.label ?? key,
      actual,
      goal: goalValue,
      status,
    };
  });
  return aggregates;
}

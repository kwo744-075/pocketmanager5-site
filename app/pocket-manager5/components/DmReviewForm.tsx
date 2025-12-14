"use client";

import { Fragment, useEffect, useState } from "react";

type DmReviewMode = "daily" | "weekly" | "monthly";

interface DmReviewFormProps {
  mode: DmReviewMode;
}

interface DmReviewDraft {
  districtName?: string;
  dmName?: string;
  period?: string;
  dayOrWeekLabel?: string;
  year?: string;
  salesBudget?: string;
  salesActual?: string;
  carsBudget?: string;
  carsActual?: string;
  laborBudget?: string;
  laborActual?: string;
  profitBudget?: string;
  profitActual?: string;
  big4Target?: string;
  big4Actual?: string;
  aroTarget?: string;
  aroActual?: string;
  mobilTarget?: string;
  mobilActual?: string;
  coolantsTarget?: string;
  coolantsActual?: string;
  diffsTarget?: string;
  diffsActual?: string;
  turnoverNotes?: string;
  staffingNotes?: string;
  talentNotes?: string;
  regionNotes?: string;
}

type ImportState = "idle" | "loading" | "success" | "error";

const MODE_TITLES: Record<DmReviewMode, string> = {
  daily: "DM Daily Review Presenter",
  weekly: "DM Weekly Review Presenter",
  monthly: "DM Monthly Business Review Presenter",
};

const MODE_SUBTITLE: Record<DmReviewMode, string> = {
  daily: "Build a daily performance review from your DM data.",
  weekly: "Build a weekly business review from your DM data.",
  monthly: "Build a monthly business review deck from your DM data.",
};

const DRAFT_STORAGE_PREFIX = "dmReviewDraft:";

export function DmReviewForm({ mode }: DmReviewFormProps) {
  const [districtName, setDistrictName] = useState("");
  const [dmName, setDmName] = useState("");
  const [period, setPeriod] = useState("");
  const [dayOrWeekLabel, setDayOrWeekLabel] = useState("");
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const [salesBudget, setSalesBudget] = useState("");
  const [salesActual, setSalesActual] = useState("");
  const [carsBudget, setCarsBudget] = useState("");
  const [carsActual, setCarsActual] = useState("");
  const [laborBudget, setLaborBudget] = useState("");
  const [laborActual, setLaborActual] = useState("");
  const [profitBudget, setProfitBudget] = useState("");
  const [profitActual, setProfitActual] = useState("");

  const [big4Target, setBig4Target] = useState("");
  const [big4Actual, setBig4Actual] = useState("");
  const [aroTarget, setAroTarget] = useState("");
  const [aroActual, setAroActual] = useState("");
  const [mobilTarget, setMobilTarget] = useState("");
  const [mobilActual, setMobilActual] = useState("");
  const [coolantsTarget, setCoolantsTarget] = useState("");
  const [coolantsActual, setCoolantsActual] = useState("");
  const [diffsTarget, setDiffsTarget] = useState("");
  const [diffsActual, setDiffsActual] = useState("");

  const [turnoverNotes, setTurnoverNotes] = useState("");
  const [staffingNotes, setStaffingNotes] = useState("");
  const [talentNotes, setTalentNotes] = useState("");
  const [regionNotes, setRegionNotes] = useState("");

  const [hasGenerated, setHasGenerated] = useState(false);

  const [importState, setImportState] = useState<ImportState>("idle");
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [draftStatusMessage, setDraftStatusMessage] = useState<string | null>(null);
  const [draftStatusVariant, setDraftStatusVariant] = useState<"success" | "error">("success");
  const [hasSavedDraft, setHasSavedDraft] = useState(false);

  const labelForMiddleField = mode === "daily" ? "Day" : mode === "weekly" ? "Week" : "Period";
  const headerTagline =
    mode === "daily"
      ? "Snapshot the story of today."
      : mode === "weekly"
      ? "Summarize the wins, issues, and next moves this week."
      : "Tell the story of this month.";
  const presenterLabel = dayOrWeekLabel || labelForMiddleField;

  const DRAFT_STORAGE_KEY = `${DRAFT_STORAGE_PREFIX}${mode}`;

  const financialRows: Array<{
    label: string;
    budget: string;
    setBudget: (value: string) => void;
    actual: string;
    setActual: (value: string) => void;
  }> = [
    { label: "Sales", budget: salesBudget, setBudget: setSalesBudget, actual: salesActual, setActual: setSalesActual },
    { label: "Cars", budget: carsBudget, setBudget: setCarsBudget, actual: carsActual, setActual: setCarsActual },
    { label: "Labor %", budget: laborBudget, setBudget: setLaborBudget, actual: laborActual, setActual: setLaborActual },
    { label: "Profit", budget: profitBudget, setBudget: setProfitBudget, actual: profitActual, setActual: setProfitActual },
  ];

  const kpiRows: Array<{
    label: string;
    target: string;
    setTarget: (value: string) => void;
    actual: string;
    setActual: (value: string) => void;
  }> = [
    { label: "Big 4 %", target: big4Target, setTarget: setBig4Target, actual: big4Actual, setActual: setBig4Actual },
    { label: "ARO $", target: aroTarget, setTarget: setAroTarget, actual: aroActual, setActual: setAroActual },
    { label: "Mobil 1 %", target: mobilTarget, setTarget: setMobilTarget, actual: mobilActual, setActual: setMobilActual },
    { label: "Coolants %", target: coolantsTarget, setTarget: setCoolantsTarget, actual: coolantsActual, setActual: setCoolantsActual },
    { label: "Diffs %", target: diffsTarget, setTarget: setDiffsTarget, actual: diffsActual, setActual: setDiffsActual },
  ];

  const handleGenerate = () => {
    setHasGenerated(true);
    const previewEl = document.getElementById("dm-review-preview");
    if (previewEl) {
      previewEl.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const applyDraft = (draft: DmReviewDraft) => {
    if (draft.districtName !== undefined) setDistrictName(draft.districtName);
    if (draft.dmName !== undefined) setDmName(draft.dmName);
    if (draft.period !== undefined) setPeriod(draft.period);
    if (draft.dayOrWeekLabel !== undefined) setDayOrWeekLabel(draft.dayOrWeekLabel);
    if (draft.year !== undefined) setYear(draft.year);
    if (draft.salesBudget !== undefined) setSalesBudget(draft.salesBudget);
    if (draft.salesActual !== undefined) setSalesActual(draft.salesActual);
    if (draft.carsBudget !== undefined) setCarsBudget(draft.carsBudget);
    if (draft.carsActual !== undefined) setCarsActual(draft.carsActual);
    if (draft.laborBudget !== undefined) setLaborBudget(draft.laborBudget);
    if (draft.laborActual !== undefined) setLaborActual(draft.laborActual);
    if (draft.profitBudget !== undefined) setProfitBudget(draft.profitBudget);
    if (draft.profitActual !== undefined) setProfitActual(draft.profitActual);
    if (draft.big4Target !== undefined) setBig4Target(draft.big4Target);
    if (draft.big4Actual !== undefined) setBig4Actual(draft.big4Actual);
    if (draft.aroTarget !== undefined) setAroTarget(draft.aroTarget);
    if (draft.aroActual !== undefined) setAroActual(draft.aroActual);
    if (draft.mobilTarget !== undefined) setMobilTarget(draft.mobilTarget);
    if (draft.mobilActual !== undefined) setMobilActual(draft.mobilActual);
    if (draft.coolantsTarget !== undefined) setCoolantsTarget(draft.coolantsTarget);
    if (draft.coolantsActual !== undefined) setCoolantsActual(draft.coolantsActual);
    if (draft.diffsTarget !== undefined) setDiffsTarget(draft.diffsTarget);
    if (draft.diffsActual !== undefined) setDiffsActual(draft.diffsActual);
    if (draft.turnoverNotes !== undefined) setTurnoverNotes(draft.turnoverNotes);
    if (draft.staffingNotes !== undefined) setStaffingNotes(draft.staffingNotes);
    if (draft.talentNotes !== undefined) setTalentNotes(draft.talentNotes);
    if (draft.regionNotes !== undefined) setRegionNotes(draft.regionNotes);
  };

  const getCurrentDraft = (): DmReviewDraft => ({
    districtName,
    dmName,
    period,
    dayOrWeekLabel,
    year,
    salesBudget,
    salesActual,
    carsBudget,
    carsActual,
    laborBudget,
    laborActual,
    profitBudget,
    profitActual,
    big4Target,
    big4Actual,
    aroTarget,
    aroActual,
    mobilTarget,
    mobilActual,
    coolantsTarget,
    coolantsActual,
    diffsTarget,
    diffsActual,
    turnoverNotes,
    staffingNotes,
    talentNotes,
    regionNotes,
  });

  const importFile = async (file: File) => {
    setImportState("loading");
    setImportMessage("Uploading and parsing data…");
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("mode", mode);

      const response = await fetch("/api/dm-review/import", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Unable to parse file. Please try again.");
      }

      const payload = (await response.json()) as { draft?: DmReviewDraft; message?: string };
      if (payload?.draft) {
        applyDraft(payload.draft);
      }

      setImportState("success");
      setImportMessage(payload?.message ?? "Import succeeded — fields updated.");
    } catch (error) {
      console.error("DM review import failed", error);
      setImportState("error");
      setImportMessage(error instanceof Error ? error.message : "Import failed. Please retry.");
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setUploadFile(file);
    if (file) {
      void importFile(file);
    }
  };

  const handleSaveDraft = () => {
    if (typeof window === "undefined") return;
    try {
      const payload = JSON.stringify(getCurrentDraft());
      window.localStorage.setItem(DRAFT_STORAGE_KEY, payload);
      setHasSavedDraft(true);
      setDraftStatusVariant("success");
      setDraftStatusMessage("Draft saved locally.");
    } catch (error) {
      console.error("DM review draft save failed", error);
      setDraftStatusVariant("error");
      setDraftStatusMessage("Unable to save draft in this browser.");
    }
  };

  const handleLoadDraft = () => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(DRAFT_STORAGE_KEY);
      if (!stored) {
        setDraftStatusVariant("error");
        setDraftStatusMessage("No saved draft for this mode yet.");
        setHasSavedDraft(false);
        return;
      }

      const parsed = JSON.parse(stored) as DmReviewDraft;
      applyDraft(parsed);
      setDraftStatusVariant("success");
      setDraftStatusMessage("Draft loaded from this browser.");
    } catch (error) {
      console.error("DM review draft load failed", error);
      setDraftStatusVariant("error");
      setDraftStatusMessage("Draft file is corrupt or unreadable.");
    }
  };

  const resetFormFields = () => {
    setDistrictName("");
    setDmName("");
    setPeriod("");
    setDayOrWeekLabel("");
    setYear(new Date().getFullYear().toString());
    setSalesBudget("");
    setSalesActual("");
    setCarsBudget("");
    setCarsActual("");
    setLaborBudget("");
    setLaborActual("");
    setProfitBudget("");
    setProfitActual("");
    setBig4Target("");
    setBig4Actual("");
    setAroTarget("");
    setAroActual("");
    setMobilTarget("");
    setMobilActual("");
    setCoolantsTarget("");
    setCoolantsActual("");
    setDiffsTarget("");
    setDiffsActual("");
    setTurnoverNotes("");
    setStaffingNotes("");
    setTalentNotes("");
    setRegionNotes("");
    setUploadFile(null);
    setHasGenerated(false);
    setImportState("idle");
    setImportMessage(null);
  };

  const handleClearDraft = () => {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(DRAFT_STORAGE_KEY);
    setHasSavedDraft(false);
    resetFormFields();
    setDraftStatusVariant("success");
    setDraftStatusMessage("Draft cleared for this layout.");
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    setHasSavedDraft(Boolean(window.localStorage.getItem(DRAFT_STORAGE_KEY)));
  }, [DRAFT_STORAGE_KEY]);

  useEffect(() => {
    if (!draftStatusMessage) return;
    const timeout = window.setTimeout(() => setDraftStatusMessage(null), 3500);
    return () => window.clearTimeout(timeout);
  }, [draftStatusMessage]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 text-slate-50 flex flex-col">
      <div className="mx-auto w-full max-w-6xl px-4 py-8">
        {/* Header */}
        <header className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">{MODE_TITLES[mode]}</h1>
            <p className="text-sm md:text-base text-slate-300">{MODE_SUBTITLE[mode]}</p>
          </div>

          <div className="flex flex-col items-stretch gap-1 md:items-end">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleLoadDraft}
                className="rounded-xl border border-slate-600 px-3 py-1.5 text-xs md:text-sm transition hover:bg-slate-800 disabled:opacity-50"
                disabled={!hasSavedDraft}
              >
                Load Draft
              </button>
              <button
                type="button"
                onClick={handleSaveDraft}
                className="rounded-xl border border-slate-600 px-3 py-1.5 text-xs md:text-sm transition hover:bg-slate-800"
              >
                Save Draft
              </button>
              <button
                type="button"
                onClick={handleClearDraft}
                className="rounded-xl border border-slate-600 px-3 py-1.5 text-xs md:text-sm transition hover:bg-slate-800"
              >
                Clear Draft
              </button>
              <button
                type="button"
                onClick={handleGenerate}
                className="rounded-xl bg-emerald-500 px-4 py-1.5 text-xs md:text-sm font-semibold text-slate-900 shadow hover:bg-emerald-400 transition"
              >
                Generate Presentation
              </button>
            </div>
            {draftStatusMessage && (
              <p className={`text-[11px] ${draftStatusVariant === "error" ? "text-rose-300" : "text-emerald-300"}`}>
                {draftStatusMessage}
              </p>
            )}
          </div>
        </header>

        <p className="mb-4 text-xs md:text-sm text-slate-300">
          Sign in to Pocket Manager 5 to sync drafts between devices. For now, drafts stay in this browser only for your {mode === "daily" ? "daily" : mode === "weekly" ? "weekly" : "monthly"} review layouts.
        </p>

        {/* Main layout: form + preview */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)]">
          {/* Left: form */}
          <section className="space-y-4">
            {/* District info */}
            <div className="rounded-2xl bg-slate-900/80 border border-slate-700/80 shadow-lg p-4 md:p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-base md:text-lg font-semibold">District Info</h2>
                <span className="text-[10px] md:text-xs uppercase tracking-wide text-slate-400">Step 1 • Context</span>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="block text-xs text-slate-300">District Name</label>
                  <input
                    className="w-full rounded-lg bg-slate-950/60 border border-slate-700 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    value={districtName}
                    onChange={(event) => setDistrictName(event.target.value)}
                    placeholder="Baton Rouge South"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs text-slate-300">DM Name</label>
                  <input
                    className="w-full rounded-lg bg-slate-950/60 border border-slate-700 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    value={dmName}
                    onChange={(event) => setDmName(event.target.value)}
                    placeholder="Jordan Carter"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs text-slate-300">{labelForMiddleField}</label>
                  <input
                    className="w-full rounded-lg bg-slate-950/60 border border-slate-700 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    value={period}
                    onChange={(event) => setPeriod(event.target.value)}
                    placeholder={mode === "daily" ? "Tue" : mode === "weekly" ? "W8" : "P8"}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs text-slate-300">Label (e.g. “Week ending”, “As of”)</label>
                  <input
                    className="w-full rounded-lg bg-slate-950/60 border border-slate-700 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    value={dayOrWeekLabel}
                    onChange={(event) => setDayOrWeekLabel(event.target.value)}
                    placeholder={mode === "daily" ? "As of 7/2" : mode === "weekly" ? "Week ending 7/6" : "Period 8 2025"}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs text-slate-300">Year</label>
                  <input
                    className="w-full rounded-lg bg-slate-950/60 border border-slate-700 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    value={year}
                    onChange={(event) => setYear(event.target.value)}
                    placeholder="2025"
                  />
                </div>
              </div>
            </div>

            {/* Upload */}
            <div className="rounded-2xl bg-slate-900/80 border border-slate-700/80 shadow-lg p-4 md:p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-base md:text-lg font-semibold">Upload Data (Excel-Driven)</h2>
                <span className="text-[10px] md:text-xs uppercase tracking-wide text-slate-400">Step 2 • Import</span>
              </div>

              <p className="text-xs md:text-sm text-slate-300">
                Upload your consolidated P&amp;L, KPI export, or other Excel file. A future API will map these columns into the fields below.
              </p>

              <label className="flex flex-col items-start gap-2 rounded-xl border border-dashed border-slate-600 bg-slate-950/40 px-4 py-3 cursor-pointer hover:border-emerald-500 hover:bg-slate-950/70 transition">
                <span className="text-xs font-medium text-slate-200">Click to attach Excel / CSV</span>
                <span className="text-[11px] text-slate-400">Accepted: .xlsx, .xls, .csv</span>
                <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileChange} />
              </label>

              <div className="space-y-1 text-xs">
                {uploadFile && (
                  <p className="text-emerald-300">
                    Selected: <span className="font-medium">{uploadFile.name}</span>
                  </p>
                )}
                {importMessage && (
                  <p
                    className={
                      importState === "error" ? "text-rose-300" : importState === "success" ? "text-emerald-300" : "text-slate-300"
                    }
                  >
                    {importMessage}
                  </p>
                )}
              </div>
            </div>

            {/* Financials */}
            <div className="rounded-2xl bg-slate-900/80 border border-slate-700/80 shadow-lg p-4 md:p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-base md:text-lg font-semibold">Financial Results – Budget vs Actual</h2>
                <span className="text-[10px] md:text-xs uppercase tracking-wide text-slate-400">Step 3 • Financials</span>
              </div>

              <div className="grid grid-cols-[minmax(0,1.2fr)_1fr_1fr] gap-2 text-xs md:text-sm font-medium text-slate-300">
                <div className="text-slate-400">Metric</div>
                <div>Budget</div>
                <div>Actual</div>

                {financialRows.map((row) => (
                  <Fragment key={row.label}>
                    <div className="py-1.5 text-slate-300">{row.label}</div>
                    <input
                      className="rounded-lg bg-slate-950/60 border border-slate-700 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      value={row.budget}
                      onChange={(event) => row.setBudget(event.target.value)}
                    />
                    <input
                      className="rounded-lg bg-slate-950/60 border border-slate-700 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      value={row.actual}
                      onChange={(event) => row.setActual(event.target.value)}
                    />
                  </Fragment>
                ))}
              </div>
            </div>

            {/* KPIs */}
            <div className="rounded-2xl bg-slate-900/80 border border-slate-700/80 shadow-lg p-4 md:p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-base md:text-lg font-semibold">KPI Breakdown</h2>
                <span className="text-[10px] md:text-xs uppercase tracking-wide text-slate-400">Step 4 • KPIs</span>
              </div>

              <div className="grid grid-cols-[minmax(0,1.2fr)_1fr_1fr] gap-2 text-xs md:text-sm font-medium text-slate-300">
                <div className="text-slate-400">KPI</div>
                <div>Target</div>
                <div>Actual</div>

                {kpiRows.map((row) => (
                  <Fragment key={row.label}>
                    <div className="py-1.5 text-slate-300">{row.label}</div>
                    <input
                      className="rounded-lg bg-slate-950/60 border border-slate-700 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      value={row.target}
                      onChange={(event) => row.setTarget(event.target.value)}
                    />
                    <input
                      className="rounded-lg bg-slate-950/60 border border-slate-700 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      value={row.actual}
                      onChange={(event) => row.setActual(event.target.value)}
                    />
                  </Fragment>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div className="rounded-2xl bg-slate-900/80 border border-slate-700/80 shadow-lg p-4 md:p-5 space-y-3">
              <h2 className="text-base md:text-lg font-semibold">Notes</h2>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="block text-xs text-slate-300">Turnover / Retention Notes</label>
                  <textarea
                    className="w-full min-h-[70px] rounded-lg bg-slate-950/60 border border-slate-700 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    value={turnoverNotes}
                    onChange={(event) => setTurnoverNotes(event.target.value)}
                    placeholder="Key hires, exits, bench concerns..."
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs text-slate-300">Staffing & Bench Notes</label>
                  <textarea
                    className="w-full min-h-[70px] rounded-lg bg-slate-950/60 border border-slate-700 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    value={staffingNotes}
                    onChange={(event) => setStaffingNotes(event.target.value)}
                    placeholder="Coverage gaps, bench strength, hiring plans..."
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs text-slate-300">Talent Snapshot / Top Performers</label>
                  <textarea
                    className="w-full min-h-[70px] rounded-lg bg-slate-950/60 border border-slate-700 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    value={talentNotes}
                    onChange={(event) => setTalentNotes(event.target.value)}
                    placeholder="Who’s winning? Who’s ready for next level?"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs text-slate-300">Additional Region Notes</label>
                  <textarea
                    className="w-full min-h-[70px] rounded-lg bg-slate-950/60 border border-slate-700 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    value={regionNotes}
                    onChange={(event) => setRegionNotes(event.target.value)}
                    placeholder="Anything your RD / leadership needs to know."
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Right: live “slide” preview */}
          <section
            id="dm-review-preview"
            className={`rounded-2xl border shadow-xl p-4 md:p-6 bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 ${
              hasGenerated ? "border-emerald-500/70" : "border-slate-700/70"
            }`}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="space-y-0.5">
                <h2 className="text-base md:text-lg font-semibold">Slide Preview – Summary</h2>
                <p className="text-xs text-slate-300">{headerTagline}</p>
              </div>
              {hasGenerated && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-300 border border-emerald-500/40">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Generated
                </span>
              )}
            </div>

            <div className="aspect-[4/3] rounded-xl bg-slate-950/80 border border-slate-700/80 p-4 md:p-5 flex flex-col gap-3 text-xs md:text-sm">
              {/* Title */}
              <div className="border-b border-slate-700 pb-2">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm md:text-base font-semibold">{MODE_TITLES[mode].replace("Presenter", "")}</h3>
                  <span className="text-[10px] text-slate-400">{year || "YYYY"}</span>
                </div>
                <p className="text-[11px] text-slate-300 mt-0.5">
                  {districtName || "District Name"} • DM: {dmName || "Name"} • {presenterLabel}: {period || (mode === "daily" ? "Today" : "—")}
                </p>
              </div>

              {/* Financial + KPI columns */}
              <div className="flex-1 grid gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <h4 className="text-[11px] font-semibold text-slate-200">Financial Highlights</h4>
                  <ul className="space-y-0.5 text-[11px] text-slate-200">
                    <li>
                      Sales – <span className="text-slate-300">{salesActual || "—"}</span>
                      {salesBudget && <span className="text-slate-400"> (Budg {salesBudget})</span>}
                    </li>
                    <li>
                      Cars – <span className="text-slate-300">{carsActual || "—"}</span>
                      {carsBudget && <span className="text-slate-400"> (Budg {carsBudget})</span>}
                    </li>
                    <li>
                      Labor % – <span className="text-slate-300">{laborActual || "—"}</span>
                      {laborBudget && <span className="text-slate-400"> (Budg {laborBudget})</span>}
                    </li>
                    <li>
                      Profit – <span className="text-slate-300">{profitActual || "—"}</span>
                      {profitBudget && <span className="text-slate-400"> (Budg {profitBudget})</span>}
                    </li>
                  </ul>
                </div>

                <div className="space-y-1.5">
                  <h4 className="text-[11px] font-semibold text-slate-200">KPI Snapshot</h4>
                  <ul className="space-y-0.5 text-[11px] text-slate-200">
                    <li>
                      Big 4 % – <span className="text-slate-300">{big4Actual || "—"}</span>
                      {big4Target && <span className="text-slate-400"> (Goal {big4Target})</span>}
                    </li>
                    <li>
                      ARO $ – <span className="text-slate-300">{aroActual || "—"}</span>
                      {aroTarget && <span className="text-slate-400"> (Goal {aroTarget})</span>}
                    </li>
                    <li>
                      Mobil 1 % – <span className="text-slate-300">{mobilActual || "—"}</span>
                      {mobilTarget && <span className="text-slate-400"> (Goal {mobilTarget})</span>}
                    </li>
                    <li>
                      Coolants % – <span className="text-slate-300">{coolantsActual || "—"}</span>
                      {coolantsTarget && <span className="text-slate-400"> (Goal {coolantsTarget})</span>}
                    </li>
                    <li>
                      Diffs % – <span className="text-slate-300">{diffsActual || "—"}</span>
                      {diffsTarget && <span className="text-slate-400"> (Goal {diffsTarget})</span>}
                    </li>
                  </ul>
                </div>
              </div>

              {/* Footer notes */}
              <div className="border-t border-slate-700 pt-1.5 space-y-0.5 text-[10px] text-slate-300">
                {turnoverNotes && (
                  <p>
                    <span className="font-semibold text-slate-200">Turnover:</span> {turnoverNotes}
                  </p>
                )}
                {staffingNotes && (
                  <p>
                    <span className="font-semibold text-slate-200">Staffing:</span> {staffingNotes}
                  </p>
                )}
                {talentNotes && (
                  <p>
                    <span className="font-semibold text-slate-200">Talent:</span> {talentNotes}
                  </p>
                )}
                {regionNotes && (
                  <p>
                    <span className="font-semibold text-slate-200">Region:</span> {regionNotes}
                  </p>
                )}
                {!turnoverNotes && !staffingNotes && !talentNotes && !regionNotes && (
                  <p className="text-slate-500 italic">Add notes above to populate this section.</p>
                )}
              </div>
            </div>

            <p className="mt-3 text-[10px] text-slate-400 leading-snug">
              Later, this preview can feed a PPTX / PDF export via <code className="rounded bg-slate-900 px-1 py-0.5 text-[10px]">pptxgenjs</code> or similar. For now, use this as your on-screen DM presenter in meetings.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
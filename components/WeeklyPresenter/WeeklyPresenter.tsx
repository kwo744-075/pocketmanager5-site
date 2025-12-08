"use client";

import React, { useState, useMemo, useEffect } from "react";
import parseWorkbook from "@/lib/excelParser";
import { fetchRetailContext } from "@/lib/retailCalendar";
import { findScopeColumn, mapPresetToColumns, getPresetsForScope, matchColumn, Scope } from "@/lib/kpiMapper";
import { getAliasesForKey, updateAlias, removeAlias } from "@/lib/kpiAliases";

type SheetMap = Record<string, any[]>;

export default function WeeklyPresenter() {
  const [presenter, setPresenter] = useState("");
  const [weekDate, setWeekDate] = useState("");
  const [retailContext, setRetailContext] = useState<any>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [sheets, setSheets] = useState<SheetMap>({});
  const [primarySheet, setPrimarySheet] = useState<string | null>(null);
  const [selectedKPIs, setSelectedKPIs] = useState<string[]>([]);
  const [generatedSlides, setGeneratedSlides] = useState<any[]>([]);
  const [includeExtras, setIncludeExtras] = useState(true);
  const PRESET_MAP: Record<string, string[]> = {
    ppt: [
      "Sales",
      "Cars",
      "Labor %",
      "Profit",
      "Big 4 %",
      "ARO $",
      "Mobil 1 %",
      "Coolants %",
      "Diffs %",
    ],
    custom: [],
  };
  const [preset, setPreset] = useState<string>("ppt");

  // Template / image mapping for PPTX slides
  const TEMPLATE_FILES = [
    "Slide1.PNG",
    "Slide2.PNG",
    "Slide3.PNG",
    "Slide4.PNG",
    "Slide5.PNG",
    "Slide6.PNG",
    "Slide7.PNG",
  ];
  const [templateMode, setTemplateMode] = useState<"none" | "single" | "auto">("none");
  const [templateChoice, setTemplateChoice] = useState<string>(TEMPLATE_FILES[0]);

  // matchColumn is imported from lib/kpiMapper and already consults alias table

  const [scope, setScope] = useState<Scope>("shop");
  const [scopeValue, setScopeValue] = useState<string>("");

  function applyPreset() {
    // Use scope-specific presets as the base if preset is ppt
    if (preset === "ppt") {
      const base = getPresetsForScope(scope);
      if (primarySheet && sheets[primarySheet]) {
        const cols = Object.keys(sheets[primarySheet][0] ?? {});
        const mapped = mapPresetToColumns(base, cols);
        setSelectedKPIs(mapped.length > 0 ? mapped : base.slice());
      } else {
        setSelectedKPIs(base.slice());
      }
    } else {
      setSelectedKPIs([]);
    }
  }

  // --- Mapping storage (localStorage) ---
  const MAPPING_KEY = "weekly.kpi.mappings.v1";
  const [savedMappings, setSavedMappings] = useState<Record<string, Record<string, string>>>({});

  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem(MAPPING_KEY) : null;
      if (raw) setSavedMappings(JSON.parse(raw));
    } catch (e) {
      // ignore
    }
  }, []);

  function saveMappingForScope(scopeName: string, mapping: Record<string, string>) {
    const next = { ...(savedMappings || {}) };
    next[scopeName] = mapping;
    setSavedMappings(next);
    try {
      window.localStorage.setItem(MAPPING_KEY, JSON.stringify(next));
    } catch (e) {
      console.error("Failed to save mapping", e);
    }
  }

  function clearMappingForScope(scopeName: string) {
    const next = { ...(savedMappings || {}) };
    delete next[scopeName];
    setSavedMappings(next);
    try {
      window.localStorage.setItem(MAPPING_KEY, JSON.stringify(next));
    } catch (e) {
      console.error("Failed to clear mapping", e);
    }
  }

  const sheetNames = useMemo(() => Object.keys(sheets), [sheets]);
  const [columns, setColumns] = useState<string[]>([]);
  const [availableScopeValues, setAvailableScopeValues] = useState<string[] | null>(null);
  const [editingMapping, setEditingMapping] = useState<Record<string, string>>({});
  const [aliasOpen, setAliasOpen] = useState<Record<string, boolean>>({});
  const [aliasInputs, setAliasInputs] = useState<Record<string, string>>({});
  const TEMPLATES_KEY = "weekly.kpi.templates.v1";
  const [mappingTemplates, setMappingTemplates] = useState<Record<string, string>>({});

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    setParseError(null);
    const file = e.currentTarget.files?.[0] ?? null;
    if (!file) return;
    try {
      const ab = await file.arrayBuffer();
      const parsed = await parseWorkbook(ab);
      setSheets(parsed.sheets);
      const first = Object.keys(parsed.sheets)[0];
      setPrimarySheet(first ?? null);
      setSelectedKPIs([]);
      // set columns for mapping UI
      const rows = parsed.sheets[first] ?? [];
      const cols = rows[0] ? Object.keys(rows[0]) : [];
      setColumns(cols);
      setAvailableScopeValues(null);
      setEditingMapping({});
      setGeneratedSlides([]);
    } catch (err) {
      console.error("Workbook parse failed", err);
      setSheets({});
      setPrimarySheet(null);
      setParseError(err instanceof Error ? err.message : String(err));
    }
  }

  // load persisted templates for mappings
  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem(TEMPLATES_KEY) : null;
      if (raw) setMappingTemplates(JSON.parse(raw));
    } catch (e) {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      if (typeof window !== "undefined") window.localStorage.setItem(TEMPLATES_KEY, JSON.stringify(mappingTemplates));
    } catch (e) {
      // swallow
    }
  }, [mappingTemplates]);

  function scoreColumnAgainstCandidates(col: string, candidates: string[]) {
    const nc = String(col).toLowerCase().replace(/[^a-z0-9]/g, "");
    let best = 0;
    for (const cand of candidates) {
      const c = String(cand).toLowerCase().replace(/[^a-z0-9]/g, "");
      if (nc === c) return 100;
      if (nc.includes(c) || c.includes(nc)) best = Math.max(best, 80);
      if (nc.startsWith(c) || c.startsWith(nc)) best = Math.max(best, 60);
      if (c.length > 2 && nc.includes(c.slice(0, Math.max(3, Math.floor(c.length / 2))))) best = Math.max(best, 40);
    }
    return best;
  }

  function suggestColumns(presetName: string, cols: string[]) {
    if (!cols || cols.length === 0) return [];
    const aliases = getAliasesForKey(presetName) || [];
    const candidates = Array.from(new Set([presetName, ...aliases]));
    const scored = cols.map((c) => ({ c, score: scoreColumnAgainstCandidates(c, candidates) }));
    scored.sort((a, b) => b.score - a.score || a.c.localeCompare(b.c));
    return scored.filter(s => s.score > 0).slice(0, 3).map(s => s.c);
  }

  async function lookupRetailWeek() {
    try {
      const ctx = await fetchRetailContext(weekDate || undefined);
      setRetailContext(ctx);
    } catch (err) {
      console.error(err);
      setRetailContext(null);
    }
  }

  // recompute available scope values when primarySheet, sheets, or scope change
  useEffect(() => {
    if (!primarySheet) return;
    const rows = sheets[primarySheet] ?? [];
    if (!rows || rows.length === 0) {
      setAvailableScopeValues(null);
      return;
    }
    const cols = Object.keys(rows[0]);
    setColumns(cols);
    const scopeCol = findScopeColumn(cols, scope);
    if (!scopeCol) {
      setAvailableScopeValues(null);
      return;
    }
    const vals = rows
      .map((r) => r[scopeCol])
      .filter((v) => v != null)
      .map((v) => String(v))
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    const uniq = Array.from(new Set(vals));
    setAvailableScopeValues(uniq.sort());
  }, [primarySheet, sheets, scope]);

  function toggleKPI(k: string) {
    setSelectedKPIs((prev) => (prev.includes(k) ? prev.filter((p) => p !== k) : [...prev, k]));
  }

  function generateSlides() {
    if (!primarySheet) return;
    const rows = sheets[primarySheet] ?? [];
    // try to find a row matching scopeValue using detected scope column
    let targetRow: any = rows[0] ?? null;
    if (scopeValue) {
      const cols = Object.keys(rows[0] ?? {});
      const scopeCol = findScopeColumn(cols, scope);
      if (scopeCol) {
        const found = rows.find((r) => {
          const v = r[scopeCol];
          if (v == null) return false;
          return String(v).toLowerCase().includes(scopeValue.toLowerCase());
        });
        if (found) targetRow = found;
      }
    }

    const slides = selectedKPIs.map((k) => {
      const sample = targetRow ?? {};
      return {
        title: `${k}`,
        value: sample[k] ?? null,
        sourceSheet: primarySheet,
      };
    });
    setGeneratedSlides(slides);
  }

  function downloadJSON() {
    const payload = {
      presenter,
      weekDate,
      retailContext,
      sheets,
      generatedSlides,
    } as any;
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `weekly-presenter-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function exportPptx() {
    try {
      const PptxGenJSModule = await import("pptxgenjs");
      // pptxgenjs default export may be the constructor
      const PptxGenJS: any = PptxGenJSModule?.default ?? PptxGenJSModule;
      const pptx = new PptxGenJS();
      const title = `Weekly Review${presenter ? ` - ${presenter}` : ""}`;
      pptx.defineLayout({ name: "WIDE", width: 10, height: 5.625 });
      pptx.layout = "WIDE";

      // helper to fetch image as data URL
      async function loadImageDataUrl(url: string) {
        try {
          const resp = await fetch(url);
          if (!resp.ok) return null;
          const blob = await resp.blob();
          return await new Promise<string | null>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob);
          });
        } catch (e) {
          return null;
        }
      }

      // preload templates if requested
      const templateData: Record<string, string | null> = {};
      if (templateMode !== "none") {
        for (const f of TEMPLATE_FILES) {
          // expect files under /weekly-templates/
          const path = `/weekly-templates/${f}`;
          // don't await all sequentially to speed up
          templateData[f] = await loadImageDataUrl(path);
        }
      }

      // Cover slide
      const cover = pptx.addSlide();
      cover.addText(title, { x: 0.5, y: 0.6, fontSize: 28, bold: true });
      const weekLabel = retailContext ? `${retailContext.weekLabel} • ${retailContext.periodLabel} • ${retailContext.quarterLabel}` : weekDate;
      cover.addText(String(weekLabel ?? ""), { x: 0.5, y: 1.6, fontSize: 14, color: "666666" });

      // KPI slides (with optional template backgrounds)
      if (generatedSlides.length === 0) {
        const s = pptx.addSlide();
        s.addText("No KPI slides generated", { x: 0.5, y: 1.2, fontSize: 18, color: "444444" });
      } else {
        for (let idx = 0; idx < generatedSlides.length; idx++) {
          const g = generatedSlides[idx];
          const s = pptx.addSlide();
          // determine template for this slide
          let templateForThis: string | null = null;
          if (templateMode === "single") {
            templateForThis = templateData[templateChoice] ?? null;
          } else if (templateMode === "auto") {
            const f = TEMPLATE_FILES[idx % TEMPLATE_FILES.length];
            templateForThis = templateData[f] ?? null;
          }
          if (templateForThis) {
            try {
              s.addImage({ data: templateForThis, x: 0, y: 0, w: 10, h: 5.625 });
            } catch (e) {
              /* ignore image errors and continue with text overlay */
            }
          }
          s.addText(g.title ?? "KPI", { x: 0.5, y: 0.4, fontSize: 20, bold: true, color: "222222" });
          s.addText(String(g.value ?? "—"), { x: 0.5, y: 1.4, fontSize: 40, bold: true, color: "222222" });
          if (g.sourceSheet) s.addText(String(g.sourceSheet), { x: 0.5, y: 3.8, fontSize: 10, color: "666666" });
        }
      }

      // Extra sheets as small tables
      if (includeExtras) {
        const limitPerSheet = 6;
        for (const name of Object.keys(sheets)) {
          const rows = sheets[name] ?? [];
          if (!rows || rows.length === 0) continue;
          const headers = Object.keys(rows[0]).slice(0, 6);
          const tableRows = [headers];
          for (let i = 0; i < Math.min(rows.length, limitPerSheet); i++) {
            const r = rows[i];
            tableRows.push(headers.map((h) => (r[h] != null ? String(r[h]) : "")));
          }
          const s = pptx.addSlide();
          s.addText(name, { x: 0.3, y: 0.2, fontSize: 14, bold: true });
          s.addTable(tableRows, { x: 0.3, y: 0.8, w: 9.4, fontSize: 10, border: { pt: 0.5, color: "CCCCCC" } });
        }
      }

      const fileName = `Weekly_Review${presenter ? `_${presenter.replace(/\s+/g, "_")}` : ""}_${new Date().toISOString().slice(0, 10)}.pptx`;
      await pptx.writeFile({ fileName });
    } catch (err) {
      console.error("PPTX export failed", err);
      alert(`PPTX export failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return (
    <div className="mx-auto max-w-4xl p-4 text-white">
      <h1 className="text-xl md:text-2xl font-semibold mb-3 text-white">Weekly Review Presenter</h1>
      {/* Workflow steps */}
      <div className="flex gap-3 mb-4">
        <div className="flex items-center gap-2 bg-slate-800/70 border border-slate-700 rounded-lg px-3 py-2 shadow-md">
          <div className="bg-indigo-500 rounded-full w-6 h-6 flex items-center justify-center text-xs font-semibold">1</div>
          <div className="text-sm">Upload</div>
        </div>
        <div className="flex items-center gap-2 bg-slate-800/70 border border-slate-700 rounded-lg px-3 py-2 shadow-md">
          <div className="bg-emerald-500 rounded-full w-6 h-6 flex items-center justify-center text-xs font-semibold">2</div>
          <div className="text-sm">Select KPIs</div>
        </div>
        <div className="flex items-center gap-2 bg-slate-800/70 border border-slate-700 rounded-lg px-3 py-2 shadow-md">
          <div className="bg-rose-500 rounded-full w-6 h-6 flex items-center justify-center text-xs font-semibold">3</div>
          <div className="text-sm">Generate & Export</div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="col-span-1">
          <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-3 mb-4 shadow-lg">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-start">
              <div className="md:col-span-1">
                <div className="text-sm text-white mb-1">Upload Weekly Excel</div>
                <input aria-label="Upload Weekly Excel" type="file" accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" onChange={handleFile} className="w-full bg-slate-900 text-white border border-slate-700 rounded px-2 py-1" />
                {parseError ? <div className="mt-2 text-xs text-rose-300">{parseError}</div> : null}
              </div>
              <div className="md:col-span-1 min-w-0">
                <div className="text-sm text-white mb-1">Presenter name</div>
                <input aria-label="Presenter name" value={presenter} onChange={(e) => setPresenter(e.target.value)} className="w-full bg-slate-900 text-white border border-slate-700 rounded px-2 py-1 min-w-0" />
              </div>
              <div className="md:col-span-1 w-full">
                <div className="text-sm text-white mb-1">Week date</div>
                <input aria-label="Week date" type="date" value={weekDate} onChange={(e) => setWeekDate(e.target.value)} className="w-full bg-slate-900 text-white border border-slate-700 rounded px-2 py-1 text-sm" />
                <button onClick={lookupRetailWeek} className="mt-2 w-full bg-sky-600 text-white px-2 py-1 rounded text-sm">Lookup</button>
                {retailContext ? <div className="mt-2 text-xs text-slate-200">{retailContext.weekLabel} • {retailContext.periodLabel}</div> : null}
              </div>
            </div>
          </div>

          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 mb-4 text-white">
            <div className="grid grid-cols-2 gap-3 items-center">
              <div>
                <div className="text-sm mb-1">Scope</div>
                <select value={scope} onChange={(e) => setScope(e.target.value as Scope)} className="bg-slate-900 text-white border border-slate-700 rounded px-2 py-1">
                  <option value="shop">Shop</option>
                  <option value="district">District</option>
                  <option value="region">Region</option>
                </select>
              </div>
              <div>
                <div className="text-sm mb-1">Scope value (ID or name)</div>
                <input value={scopeValue} onChange={(e) => setScopeValue(e.target.value)} className="w-full bg-slate-900 text-white border border-slate-700 rounded px-2 py-1" placeholder="e.g. Store 123 or District A" />
              </div>
            </div>
            <div className="text-xs text-slate-300 mt-2">Choose a scope so the presenter will pick the row matching this shop/district/region from the sheet when generating KPI slides.</div>
          </div>

          <div className="mb-6">
            <h2 className="text-sm md:text-base font-medium mb-2 text-white">Slide Preview</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {generatedSlides.length === 0 ? (
                <div className="col-span-1 bg-slate-800/50 border border-slate-700 rounded p-3 text-center text-slate-300 text-sm">No slides generated yet. Select KPIs and click "Generate Slides".</div>
              ) : (
                generatedSlides.map((s, idx) => (
                  <div key={idx} className="bg-slate-900/60 border border-slate-700 rounded p-3 text-white shadow-sm">
                    <div className="text-[11px] text-slate-300">{s.sourceSheet}</div>
                    <div className="text-lg font-semibold mt-1">{s.title}</div>
                    <div className="text-2xl mt-2">{String(s.value ?? "—")}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div>
            <h2 className="text-sm md:text-base font-medium mb-2 text-white">Weekly Full KPI summary</h2>
            <div className="space-y-2 text-sm">
              {sheetNames.length === 0 && <div className="text-slate-300">No sheets loaded.</div>}
              {sheetNames.map((name) => (
                <div key={name} className="bg-slate-800/50 border border-slate-700 rounded p-2 text-white">
                  <div className="font-semibold text-sm">{name}</div>
                  <div className="text-xs text-slate-300">{sheets[name].length} rows</div>
                  <div className="mt-1 overflow-auto max-h-28 text-xs text-slate-100">
                    <table className="w-full">
                      <thead>
                        <tr className="text-left">
                          {Object.keys(sheets[name][0] ?? {}).slice(0, 4).map((h) => (
                            <th key={h} className="pr-3">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {sheets[name].slice(0, 4).map((r, i) => (
                          <tr key={i}>
                            {Object.keys(r).slice(0, 4).map((c) => (
                              <td key={c} className="pr-3">{String(r[c])}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="col-span-1">
          <div className="border rounded p-4 mb-4">
            <div className="font-semibold mb-2">KPI Selector</div>
            <div className="text-sm text-neutral-600 mb-2">Primary sheet</div>
            <select value={primarySheet ?? ""} onChange={(e) => setPrimarySheet(e.target.value)} className="w-full border rounded px-2 py-1 mb-3">
              <option value="">(select sheet)</option>
              {sheetNames.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            {primarySheet && (
              <div>
                <div className="text-sm text-neutral-600 mb-2">Choose KPIs to generate slides</div>
                <div className="flex gap-2 items-center mb-2">
                  <label className="text-sm text-slate-300">Preset:</label>
                  <select value={preset} onChange={(e) => setPreset(e.target.value)} className="text-sm bg-slate-900 text-white border border-slate-700 rounded px-2 py-1">
                    <option value="ppt">PPT Weekly KPIs</option>
                    <option value="custom">Custom</option>
                  </select>
                  <button onClick={applyPreset} className="ml-2 bg-emerald-600 text-white px-2 py-1 rounded text-sm">Apply preset</button>
                </div>
                <div className="flex flex-col gap-2 mb-3">
                  <div className="text-sm text-slate-300">Slide template</div>
                  <div className="flex gap-2 items-center">
                    <select value={templateMode} onChange={(e) => setTemplateMode(e.target.value as any)} className="bg-slate-900 text-white border border-slate-700 rounded px-2 py-1 text-sm">
                      <option value="none">None</option>
                      <option value="single">Single template</option>
                      <option value="auto">Auto sequence</option>
                    </select>
                    {templateMode !== "none" && (
                      <select value={templateChoice} onChange={(e) => setTemplateChoice(e.target.value)} className="bg-slate-900 text-white border border-slate-700 rounded px-2 py-1 text-sm">
                        {TEMPLATE_FILES.map((f) => (
                          <option key={f} value={f}>{f}</option>
                        ))}
                      </select>
                    )}
                    <div className="text-xs text-slate-400">(Templates must be in `/public/weekly-templates/`)</div>
                  </div>
                </div>
                <div className="space-y-1 max-h-56 overflow-auto">
                  {columns.map((col) => (
                    <label key={col} className="flex items-center gap-2">
                      <input type="checkbox" checked={selectedKPIs.includes(col)} onChange={() => toggleKPI(col)} />
                      <span className="text-sm">{col}</span>
                    </label>
                  ))}
                </div>

                {/* Mapping review UI */}
                <div className="mt-3 bg-slate-900/50 border border-slate-700 rounded p-3">
                  <div className="text-sm font-semibold mb-2">Mapping review</div>
                  <div className="text-xs text-slate-300 mb-2">Review or remap how preset KPI names match your sheet columns. Save mappings to reuse across uploads.</div>
                  <div className="space-y-2 max-h-40 overflow-auto">
                      {PRESET_MAP.ppt.map((presetName) => (
                      <div key={presetName} className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <div className="w-36 text-xs">{presetName}</div>
                          <select
                            value={editingMapping[presetName] ?? matchColumn(presetName, columns) ?? ""}
                            onChange={(e) => setEditingMapping((s) => ({ ...s, [presetName]: e.target.value }))}
                            className="flex-1 bg-slate-800 text-white border border-slate-700 rounded px-2 py-1 text-sm"
                          >
                            <option value="">(not mapped)</option>
                            {columns.map((c) => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                            <button
                              onClick={() => setAliasOpen((s) => ({ ...s, [presetName]: !s[presetName] }))}
                              className="ml-2 text-xs bg-slate-700 px-2 py-1 rounded"
                            >
                              Aliases
                            </button>
                            <select
                              value={mappingTemplates[presetName] ?? ""}
                              onChange={(e) => setMappingTemplates((s) => ({ ...s, [presetName]: e.target.value }))}
                              className="ml-2 bg-slate-800 text-white border border-slate-700 rounded px-2 py-1 text-xs"
                            >
                              <option value="">(template)</option>
                              {TEMPLATE_FILES.map((f) => (
                                <option key={f} value={f}>{f}</option>
                              ))}
                            </select>
                        </div>
                        {aliasOpen[presetName] && (
                          <div className="ml-2 bg-slate-800/40 border border-slate-700 rounded p-2">
                            <div className="text-xs text-slate-300 mb-1">Aliases for <strong>{presetName}</strong></div>
                            <div className="flex gap-2 mb-2">
                              <input
                                value={aliasInputs[presetName] ?? ""}
                                onChange={(e) => setAliasInputs((s) => ({ ...s, [presetName]: e.target.value }))}
                                placeholder="add alias (e.g. 'net sales')"
                                className="flex-1 bg-slate-900 text-white border border-slate-700 rounded px-2 py-1 text-xs"
                              />
                              <button
                                onClick={() => {
                                  const v = (aliasInputs[presetName] || "").trim();
                                  if (!v) return;
                                  updateAlias(presetName, v);
                                  setAliasInputs((s) => ({ ...s, [presetName]: "" }));
                                  // force re-render by toggling open state
                                  setAliasOpen((s) => ({ ...s }));
                                }}
                                className="bg-emerald-600 text-white px-2 py-1 rounded text-xs"
                              >Add</button>
                            </div>
                            <div className="text-xs space-y-1">
                              {getAliasesForKey(presetName).map((a) => (
                                <div key={a} className="flex items-center justify-between gap-2">
                                  <div className="text-xs text-slate-200">{a}</div>
                                  <div className="flex gap-2">
                                    <button onClick={() => { removeAlias(presetName, a); setAliasOpen((s) => ({ ...s })); }} className="text-rose-400 text-xs">Remove</button>
                                    <button onClick={() => {
                                      // quick-apply alias as mapping if a matching column exists
                                      const m = matchColumn(a, columns);
                                      if (m) setEditingMapping((s) => ({ ...s, [presetName]: m }));
                                    }} className="text-emerald-400 text-xs">Apply</button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {/* suggestions based on aliases and name */}
                        <div className="ml-0 mt-1 flex gap-2 flex-wrap">
                          {suggestColumns(presetName, columns).map((c) => (
                            <button key={c} onClick={() => setEditingMapping((s) => ({ ...s, [presetName]: c }))} className="text-xs bg-slate-700 px-2 py-1 rounded">{c}</button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => { saveMappingForScope(scope, editingMapping); }} className="bg-emerald-600 text-white px-2 py-1 rounded text-sm">Save mapping</button>
                    <button onClick={() => { clearMappingForScope(scope); setEditingMapping({}); }} className="bg-rose-600 text-white px-2 py-1 rounded text-sm">Clear saved mapping</button>
                    <button onClick={() => { const mapped = mapPresetToColumns(PRESET_MAP.ppt, columns); setSelectedKPIs(mapped.length>0?mapped:PRESET_MAP.ppt.slice()); }} className="bg-neutral-700 text-white px-2 py-1 rounded text-sm">Apply (auto-map)</button>
                  </div>
                </div>
                <div className="mt-3 flex gap-2 items-center">
                  <button onClick={generateSlides} className="bg-emerald-600 text-white px-2 py-1 rounded text-sm">Generate</button>
                  <button onClick={downloadJSON} className="bg-neutral-800 text-white px-2 py-1 rounded text-sm">Download JSON</button>
                  <button onClick={exportPptx} className="bg-indigo-600 text-white px-2 py-1 rounded text-sm">Export PPTX</button>
                </div>
                <div className="mt-2 flex items-center gap-2 text-sm">
                  <label className="flex items-center gap-2 text-xs">
                    <input type="checkbox" checked={includeExtras} onChange={() => setIncludeExtras((v) => !v)} />
                    <span>Include extra sheets as slides</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          <div className="border rounded p-4">
            <div className="font-semibold mb-2">Extras</div>
            <div className="text-sm text-neutral-600">Use extra datasets from the workbook as additional slides or visuals. They will appear under the Slide Preview as the full KPI summary.</div>
          </div>
        </aside>
      </div>
    </div>
  );
}

// Preset Builder Component - select KPIs, set goals, save presets

"use client";

import React, { useState, useEffect } from "react";
import { KPIDefinition, ReviewPreset, CadenceType, ScopeType } from "../types";
import { loadPresets, savePreset } from "../kpiPresets";

interface PresetBuilderProps {
  availableColumns: string[];
  selectedKPIs: KPIDefinition[];
  onKPIsChange: (kpis: KPIDefinition[]) => void;
  preset: ReviewPreset | null;
  onPresetChange: (preset: ReviewPreset | null) => void;
  mode: ScopeType;
  onNext: () => void;
  onPrev: () => void;
}

export function PresetBuilder({
  availableColumns,
  selectedKPIs,
  onKPIsChange,
  preset,
  onPresetChange,
  mode,
  onNext,
  onPrev,
}: PresetBuilderProps) {
  const [availableKPIs, setAvailableKPIs] = useState<string[]>([]);
  const [savedPresets, setSavedPresets] = useState<ReviewPreset[]>([]);
  const [presetName, setPresetName] = useState("");
  const [cadence, setCadence] = useState<CadenceType>("daily");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const shopColumns = ["shop", "store", "location", "number", "name"];
    const kpiColumns = availableColumns.filter((col) => !shopColumns.some((shop) => col.toLowerCase().includes(shop)));
    setAvailableKPIs(kpiColumns);
    loadExistingPresets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableColumns]);

  const loadExistingPresets = async () => {
    setIsLoading(true);
    const presets = await loadPresets(mode, cadence);
    setSavedPresets(presets);
    setIsLoading(false);
  };

  const addKPI = (kpiName: string) => {
    if (selectedKPIs.find((k) => k.name === kpiName)) return;
    const newKPI: KPIDefinition = { name: kpiName, goal: 0, comparator: ">=", displayOrder: selectedKPIs.length };
    onKPIsChange([...selectedKPIs, newKPI]);
  };

  const updateKPI = (index: number, updates: Partial<KPIDefinition>) => {
    const newKPIs = [...selectedKPIs];
    newKPIs[index] = { ...newKPIs[index], ...updates };
    onKPIsChange(newKPIs);
  };

  const removeKPI = (index: number) => {
    const newKPIs = selectedKPIs.filter((_, i) => i !== index);
    onKPIsChange(newKPIs);
  };

  const loadPreset = (selectedPreset: ReviewPreset) => {
    onKPIsChange(selectedPreset.selected_kpis);
    onPresetChange(selectedPreset);
    setPresetName(selectedPreset.preset_name);
    setCadence(selectedPreset.cadence);
  };

  const saveCurrentPreset = async () => {
    if (!presetName.trim()) {
      alert("Please enter a preset name");
      return;
    }
    if (selectedKPIs.length === 0) {
      alert("Please select at least one KPI");
      return;
    }
    const newPreset: Omit<ReviewPreset, "id" | "created_at"> = {
      scope: mode,
      cadence,
      preset_name: presetName,
      selected_kpis: selectedKPIs,
    };
    const saved = await savePreset(newPreset);
    if (saved) {
      alert("Preset saved successfully");
      loadExistingPresets();
      onPresetChange(saved);
    } else {
      alert("Failed to save preset");
    }
  };

  return (
    <div className="space-y-6 rounded-2xl border border-slate-800 bg-slate-950 p-6 text-slate-100 shadow-lg">
      <h2 className="text-center text-xl font-semibold text-white">KPI Selection &amp; Goals</h2>

      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-white">Load Preset</h3>
        {isLoading ? (
          <p className="text-sm text-slate-400">Loading presets...</p>
        ) : (
          savedPresets.map((p) => (
            <button
              key={p.id}
              className="block w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-left text-sm font-medium text-slate-100 hover:border-emerald-400/60"
              onClick={() => loadPreset(p)}
            >
              {p.preset_name} ({p.cadence})
            </button>
          ))
        )}
      </div>

      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-white">Period Type</h3>
        <label className="sr-only" htmlFor="cadence-select">
          Period type
        </label>
        <select
          id="cadence-select"
          value={cadence}
          onChange={(e) => setCadence(e.target.value as CadenceType)}
          className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400/60 focus:outline-none"
          aria-label="Select period type"
        >
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
          <option value="period">Period</option>
        </select>
      </div>

      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-white">Available KPIs</h3>
        <div className="flex flex-wrap gap-2">
          {availableKPIs.map((kpi) => (
            <button
              key={kpi}
              className="rounded-full bg-indigo-600 px-3 py-2 text-sm text-white transition-colors hover:bg-indigo-700"
              onClick={() => addKPI(kpi)}
            >
              {kpi}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-white">Selected KPIs &amp; Goals</h3>
        {selectedKPIs.map((kpi, index) => (
          <div key={kpi.name} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2">
            <span className="min-w-[120px] text-sm font-medium text-white">{kpi.name}</span>
            <label className="sr-only" htmlFor={`comparator-${index}`}>
              {kpi.name} comparator
            </label>
            <select
              id={`comparator-${index}`}
              value={kpi.comparator}
              onChange={(e) => updateKPI(index, { comparator: e.target.value as KPIDefinition["comparator"] })}
              className="rounded-lg border border-slate-800 bg-slate-950 px-2 py-1 text-sm text-slate-100 focus:border-emerald-400/60 focus:outline-none"
              aria-label={`${kpi.name} comparator`}
            >
              <option value=">=">{">="}</option>
              <option value="<=">{"<="}</option>
              <option value="=">=</option>
            </select>
            <input
              className="w-24 rounded-lg border border-slate-800 bg-slate-950 px-2 py-1 text-sm text-slate-100 focus:border-emerald-400/60 focus:outline-none"
              value={kpi.goal.toString()}
              onChange={(e) => updateKPI(index, { goal: parseFloat(e.target.value) || 0 })}
              type="number"
              placeholder="Goal"
              aria-label={`${kpi.name} goal`}
            />
            <button
              className="rounded-lg border border-rose-500/60 px-3 py-1 text-sm font-semibold text-rose-200 hover:bg-rose-500/10"
              onClick={() => removeKPI(index)}
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-white">Save Preset</h3>
        <input
          className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400/60 focus:outline-none"
          value={presetName}
          onChange={(e) => setPresetName(e.target.value)}
          placeholder="Preset name"
          aria-label="Preset name"
        />
        <button className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500" onClick={saveCurrentPreset}>
          Save Preset
        </button>
      </div>

      <div className="flex items-center justify-between gap-3">
        <button className="flex-1 rounded-lg border border-slate-800 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-100 hover:border-emerald-400/60" onClick={onPrev}>
          Previous
        </button>
        <button className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500" onClick={onNext}>
          Next
        </button>
      </div>
    </div>
  );
}

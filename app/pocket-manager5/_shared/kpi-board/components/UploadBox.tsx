"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { CloudUpload, FileSpreadsheet, RefreshCw } from "lucide-react";
import { SECTION_OPTIONS } from "../data";
import type { UploadParseResult, UploadSectionKind } from "../types";

type UploadBoxProps = {
  onParsed: (result: UploadParseResult) => void;
  defaultSection?: UploadSectionKind;
  compact?: boolean;
};

type SheetPreview = {
  name: string;
  rows: Array<Array<string | number | null>>;
};

const MAX_PREVIEW_ROWS = 14;

export function UploadBox({ onParsed, defaultSection = "daily", compact }: UploadBoxProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [sectionKind, setSectionKind] = useState<UploadSectionKind>(defaultSection);
  const [fileName, setFileName] = useState<string | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string | null>(null);
  const [preview, setPreview] = useState<SheetPreview | null>(null);
  const [headerRow, setHeaderRow] = useState<number | null>(null);
  const [detectedHeaderRow, setDetectedHeaderRow] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      setLoading(true);
      try {
        const XLSX = await import("xlsx");
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });
        const names = workbook.SheetNames || [];
        const firstSheet = names[0];
        setSheetNames(names);
        setSelectedSheet(firstSheet ?? null);
        setFileName(file.name);

        if (firstSheet) {
          const sheet = workbook.Sheets[firstSheet];
          const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false }) as Array<Array<string | number | null>>;
          const sliced = rows.slice(0, MAX_PREVIEW_ROWS);
          const detected = detectHeaderRow(rows);
          setPreview({ name: firstSheet, rows: sliced });
          setDetectedHeaderRow(detected);
          setHeaderRow(detected ?? 0);
        }
      } catch (err) {
        console.error("[KPI Board] Upload parse failed", err);
        setError("Could not read this workbook. Try a simpler export or re-save as .xlsx.");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const handleFileInput = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const nextFile = event.target.files?.[0];
      if (!nextFile) return;
      void handleFile(nextFile);
    },
    [handleFile],
  );

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDragActive(false);
      const nextFile = event.dataTransfer.files?.[0];
      if (nextFile) {
        void handleFile(nextFile);
      }
    },
    [handleFile],
  );

  const sheetRowOptions = useMemo(() => {
    const count = preview?.rows.length ?? 0;
    return Array.from({ length: count }, (_, idx) => idx);
  }, [preview?.rows.length]);

  const columns = useMemo(() => {
    if (!preview || headerRow == null) return [];
    const row = preview.rows[headerRow] ?? [];
    return row.map((cell, idx) => {
      const label = String(cell ?? "").trim();
      return label || `Column ${idx + 1}`;
    });
  }, [headerRow, preview]);

  const parseToObjects = useCallback(
    async (rowIndex: number) => {
      if (!fileName || !selectedSheet) return;
      try {
        const XLSX = await import("xlsx");
        const fileInput = fileInputRef.current;
        const file = fileInput?.files?.[0];
        if (!file) return;
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });
        const sheet = workbook.Sheets[selectedSheet];
        if (!sheet) {
          setError("Sheet missing in workbook. Re-upload to refresh preview.");
          return;
        }
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false }) as Array<Array<string | number | null>>;
        const header = rows[rowIndex] ?? [];
        const mappedHeader = header.map((cell, idx) => {
          const label = String(cell ?? "").trim();
          return label || `Column ${idx + 1}`;
        });
        const body = rows.slice(rowIndex + 1);
        const objects: Record<string, unknown>[] = body
          .map((cells) => {
            const rowObject: Record<string, unknown> = {};
            mappedHeader.forEach((label, colIdx) => {
              rowObject[label] = cells[colIdx] ?? null;
            });
            return rowObject;
          })
          .filter((row) => Object.values(row).some((value) => value !== null && value !== ""));

        onParsed({
          rows: objects,
          columns: mappedHeader,
          fileName,
          sheetName: selectedSheet,
          headerRow: rowIndex,
          sectionKind,
        });
      } catch (err) {
        console.error("[KPI Board] Parse to objects failed", err);
        setError("Parse failed. Try selecting a different header row.");
      }
    },
    [fileName, onParsed, sectionKind, selectedSheet],
  );

  const handleSheetChange = useCallback(
    async (name: string) => {
      const file = fileInputRef.current?.files?.[0];
      if (!file) return;
      try {
        const XLSX = await import("xlsx");
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });
        const sheet = workbook.Sheets[name];
        if (!sheet) return;
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false }) as Array<Array<string | number | null>>;
        const sliced = rows.slice(0, MAX_PREVIEW_ROWS);
        const detected = detectHeaderRow(rows);
        setPreview({ name, rows: sliced });
        setSelectedSheet(name);
        setDetectedHeaderRow(detected);
        setHeaderRow(detected ?? 0);
      } catch (err) {
        console.error("[KPI Board] Sheet switch failed", err);
        setError("Unable to read that sheet. Try a smaller workbook.");
      }
    },
    [],
  );

  const readyToConfirm = fileName && preview && headerRow != null;

  return (
    <div className="space-y-4 rounded-3xl border border-white/10 bg-slate-950/70 p-4 shadow-lg shadow-black/30">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.4em] text-slate-500">{compact ? "Upload" : "Upload workbook"}</p>
          <h3 className="text-lg font-semibold text-white">{compact ? "Attach KPI export" : "Select your KPI export"}</h3>
          {!compact ? <p className="text-sm text-slate-300">XLSX only. Parsed fully in-browser.</p> : null}
        </div>
        <div className="flex gap-2">
          <label className="text-right text-[11px] uppercase tracking-[0.35em] text-slate-400">
            Section
            <select
              value={sectionKind}
              onChange={(event) => setSectionKind(event.target.value as UploadSectionKind)}
              className="mt-1 w-36 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white"
            >
              {SECTION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div
        className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/15 bg-slate-900/60 ${compact ? "p-4" : "p-8"} text-center transition ${dragActive ? "border-emerald-400/60 bg-emerald-500/10" : "hover:border-emerald-400/40"}`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <CloudUpload className="h-8 w-8 text-emerald-300" />
        <div>
          <p className="text-base font-semibold text-white">{compact ? "Browse for .xlsx" : "Drag & drop or browse"}</p>
          {!compact ? <p className="text-sm text-slate-400">XLSX or XLS only. If your report has multiple tabs, pick one below.</p> : null}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          className="hidden"
          onChange={handleFileInput}
          aria-label="Upload KPI workbook"
        />
        {fileName ? (
          <div className="rounded-full border border-emerald-400/40 px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-emerald-100">
            {fileName}
          </div>
        ) : null}
        {loading ? <p className="text-xs text-slate-400">Reading workbook.</p> : null}
      </div>

      {sheetNames.length ? (
        <div className="space-y-3 rounded-2xl border border-white/5 bg-slate-900/60 p-4">
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-200">
            <FileSpreadsheet className="h-4 w-4 text-emerald-200" />
            <span>Pick sheet & header row</span>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-xs uppercase tracking-[0.3em] text-slate-500">
              Sheet tab
              <select
                value={selectedSheet ?? ""}
                onChange={(event) => void handleSheetChange(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white"
              >
                {sheetNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs uppercase tracking-[0.3em] text-slate-500">
              Header row
              <select
                value={headerRow ?? ""}
                onChange={(event) => setHeaderRow(Number(event.target.value))}
                className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white"
              >
                {sheetRowOptions.map((idx) => (
                  <option key={idx} value={idx}>
                    Row {idx + 1} {detectedHeaderRow === idx ? "(auto)" : ""}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {!compact ? (
            <div className="overflow-x-auto rounded-xl border border-slate-800/70 bg-slate-950/80">
              <table className="min-w-full text-left text-xs text-slate-200">
                <tbody>
                  {preview?.rows.map((row, idx) => (
                    <tr key={`preview-${idx}`} className={`border-t border-slate-900 ${idx === headerRow ? "bg-slate-800/60" : ""}`}>
                      <td className="px-3 py-2 text-[10px] uppercase tracking-[0.35em] text-slate-500">Row {idx + 1}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-2">
                          {row.map((cell, cellIdx) => (
                            <span
                              key={`${idx}-${cellIdx}`}
                              className={`rounded-full border px-2 py-1 text-[11px] ${
                                idx === headerRow
                                  ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-100"
                                  : "border-white/10 bg-slate-900 text-slate-200"
                              }`}
                            >
                              {String(cell ?? "") || `Col ${cellIdx + 1}`}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {columns.length ? (
            <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3 text-xs text-slate-300">
              <p className="text-[10px] uppercase tracking-[0.35em] text-slate-500">Detected columns</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {columns.map((col) => (
                  <span key={col} className="rounded-full border border-white/10 bg-slate-950 px-3 py-1 text-[11px] text-white">
                    {col}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => {
              if (fileInputRef.current?.value) {
                fileInputRef.current.value = "";
              }
              setFileName(null);
              setPreview(null);
              setSheetNames([]);
              setSelectedSheet(null);
              setHeaderRow(null);
              setDetectedHeaderRow(null);
              setError(null);
            }}
            className="inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-300 transition hover:border-emerald-400/40"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Reset
          </button>
        </div>
      ) : null}

      {error ? <p className="rounded-xl border border-rose-500/50 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">{error}</p> : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-slate-400">{readyToConfirm ? "Header locked. Parse to load grid." : "Pick a sheet and header row to continue."}</div>
        <button
          type="button"
          disabled={!readyToConfirm}
          onClick={() => (headerRow != null ? parseToObjects(headerRow) : null)}
          className="inline-flex items-center gap-2 rounded-full border border-emerald-400/50 bg-emerald-500/10 px-4 py-2 text-sm font-semibold uppercase tracking-[0.35em] text-emerald-100 transition hover:border-emerald-300 disabled:cursor-not-allowed disabled:border-white/10 disabled:text-slate-500"
        >
          Use this table
        </button>
      </div>
    </div>
  );
}

function detectHeaderRow(rows: Array<Array<string | number | null>>): number | null {
  const heuristics = ["shop", "store"];
  for (let i = 0; i < Math.min(rows.length, 8); i += 1) {
    const row = rows[i] ?? [];
    const hasMatch = row.some((cell) => {
      if (cell == null) return false;
      const value = String(cell).toLowerCase();
      return heuristics.some((needle) => value.includes(needle));
    });
    if (hasMatch) return i;
  }
  return rows.length ? 0 : null;
}

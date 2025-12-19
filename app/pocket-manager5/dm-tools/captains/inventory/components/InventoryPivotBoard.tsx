"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Filter, Table as TableIcon, Upload } from "lucide-react";
import * as XLSX from "xlsx";

type PeriodKind = "day" | "week" | "period" | "year";
type Grouping = "shop" | "district" | "region";

type PivotRow = {
  region: string;
  district: string;
  shop: string;
  periodLabel: string;
  counts: number;
  variance: number;
  missingInventory: number;
};

const SAMPLE_ROWS: PivotRow[] = [
  { region: "Gulf Coast", district: "District 101", shop: "447", periodLabel: "Week 48", counts: 2, variance: -213, missingInventory: 0 },
  { region: "Gulf Coast", district: "District 101", shop: "511", periodLabel: "Week 48", counts: 0, variance: -120, missingInventory: 1 },
  { region: "Gulf Coast", district: "District 101", shop: "512", periodLabel: "Week 48", counts: 1, variance: -55, missingInventory: 0 },
  { region: "Midwest", district: "District 220", shop: "612", periodLabel: "Week 48", counts: 1, variance: -40, missingInventory: 0 },
  { region: "Midwest", district: "District 220", shop: "615", periodLabel: "Week 48", counts: 0, variance: -520, missingInventory: 1 },
];

const toneForVariance = (variance: number, missing: number) => {
  if (missing > 0 || Math.abs(variance) >= 500) return "text-rose-200 bg-rose-500/10 border-rose-500/40";
  if (Math.abs(variance) < 1) return "text-slate-300 bg-slate-500/10 border-slate-500/40";
  return "text-emerald-200 bg-emerald-500/10 border-emerald-500/40";
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Math.round(value));

const periodOptions: { label: string; value: PeriodKind | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Day", value: "day" },
  { label: "Week", value: "week" },
  { label: "Period", value: "period" },
  { label: "Year", value: "year" },
];

export function InventoryPivotBoard() {
  const [rows, setRows] = useState<PivotRow[]>(SAMPLE_ROWS);
  const [fileName, setFileName] = useState<string>("inventory-captain-sample.xlsx");
  const [grouping, setGrouping] = useState<Grouping>("shop");
  const [periodFilter, setPeriodFilter] = useState<PeriodKind | "all">("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showNegativeOnly, setShowNegativeOnly] = useState(false);
  const [includeDirectoryZeros, setIncludeDirectoryZeros] = useState(true);

  useEffect(() => {
    const loadSample = async () => {
      try {
        setLoading(true);
        const response = await fetch("/inventory-captain-sample.xlsx");
        const buffer = await response.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, string | number>>(firstSheet);
        const parsed = normalizeRows(json);
        if (parsed.length) {
          setRows(parsed);
        }
      } catch (err) {
        console.error("Sample load failed", err);
        setRows(SAMPLE_ROWS);
        setError("Using sample data. Upload a file to override.");
      } finally {
        setLoading(false);
      }
    };
    loadSample();
  }, []);

  const normalizedRows = useMemo(() => {
    if (!rows.length) return [];
    const hasAnyCounts = rows.some((row) => row.counts > 0);
    if (!includeDirectoryZeros || !hasAnyCounts) return rows;
    // add zero rows when some shops have counts and others did not.
    const key = (row: PivotRow) => `${row.region}|${row.district}|${row.shop}`;
    const existingKeys = new Set(rows.map((row) => key(row)));
    const scaffold: PivotRow[] = [];
    const regions = new Map<string, Set<string>>();
    rows.forEach((row) => {
      const k = `${row.region}|${row.district}`;
      if (!regions.has(k)) regions.set(k, new Set());
      regions.get(k)?.add(row.shop);
    });
    regions.forEach((shops, rdKey) => {
      const [region, district] = rdKey.split("|");
      shops.forEach((shop) => {
        const withCounts = rows.filter((row) => row.shop === shop && row.counts > 0);
        if (!withCounts.length) {
          const periodLabel = rows.find((row) => row.region === region && row.district === district)?.periodLabel ?? "Current";
          const scaffoldKey = `${region}|${district}|${shop}`;
          if (!existingKeys.has(scaffoldKey)) {
            scaffold.push({ region, district, shop, periodLabel, counts: 0, variance: 0, missingInventory: 1 });
          }
        }
      });
    });
    return [...rows, ...scaffold];
  }, [includeDirectoryZeros, rows]);

  const filteredRows = useMemo(() => {
    return normalizedRows.filter((row) => {
      if (periodFilter === "all") return true;
      return row.periodLabel.toLowerCase().includes(periodFilter);
    });
  }, [normalizedRows, periodFilter]);

  const grouped = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string;
        label: string;
        counts: number;
        variance: number;
        missingInventory: number;
        children?: PivotRow[];
      }
    >();
    filteredRows.forEach((row) => {
      const key =
        grouping === "shop"
          ? `${row.region}|${row.district}|${row.shop}`
          : grouping === "district"
            ? `${row.region}|${row.district}`
            : row.region;
      const label =
        grouping === "shop" ? `#${row.shop}` : grouping === "district" ? row.district : row.region || "All Regions";
      if (!map.has(key)) {
        map.set(key, { key, label, counts: 0, variance: 0, missingInventory: 0, children: [] });
      }
      const entry = map.get(key)!;
      entry.counts += row.counts;
      entry.variance += row.variance;
      entry.missingInventory += row.missingInventory;
      entry.children?.push(row);
    });
    let list = Array.from(map.values());
    if (showNegativeOnly) {
      list = list.filter((row) => row.missingInventory > 0 || row.variance < 0);
    }
    return list.sort((a, b) => b.missingInventory - a.missingInventory || b.variance - a.variance).slice(0, 200);
  }, [filteredRows, grouping, showNegativeOnly]);

  const topOutliers = useMemo(() => {
    const shopGroups = grouped.filter((row) => grouping === "shop" || row.label.startsWith("#"));
    return shopGroups
      .slice()
      .sort((a, b) => b.missingInventory - a.missingInventory || Math.abs(b.variance) - Math.abs(a.variance))
      .slice(0, 10);
  }, [grouped, grouping]);

  const handleUpload = (file: File) => {
    setLoading(true);
    setError(null);
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, string | number>>(sheet, { defval: "" });
        const parsed = normalizeRows(json);
        setRows(parsed.length ? parsed : SAMPLE_ROWS);
      } catch (err) {
        console.error("Upload parse failed", err);
        setRows(SAMPLE_ROWS);
        setError("Upload parse failed. Reverting to sample.");
      } finally {
        setLoading(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <section className="space-y-4 rounded-3xl border border-slate-900/70 bg-slate-950/70 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Pivot breakdown</p>
          <h3 className="text-xl font-semibold text-white">Slice by shop, district, or region in one click.</h3>
          {error ? <p className="text-xs text-amber-300">{error}</p> : null}
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-800 bg-slate-900/60 px-4 py-2 text-sm text-slate-200">
          <Upload className="h-4 w-4 text-emerald-300" />
          <span>{loading ? "Loading..." : fileName}</span>
          <input
            type="file"
            accept=".xlsx,.xls"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) handleUpload(file);
            }}
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/50 p-1">
          {(["shop", "district", "region"] as Grouping[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setGrouping(mode)}
              className={`rounded-full px-3 py-1 font-semibold transition ${
                grouping === mode ? "bg-emerald-500/20 text-emerald-100 border border-emerald-500/40" : "text-slate-300"
              }`}
            >
              {mode === "shop" ? "Shop" : mode === "district" ? "District" : "Region"}
            </button>
          ))}
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/50 p-1">
          {periodOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setPeriodFilter(option.value)}
              className={`rounded-full px-3 py-1 font-semibold transition ${
                periodFilter === option.value ? "bg-slate-800 text-white border border-slate-700" : "text-slate-300"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <label className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/50 px-3 py-2 text-slate-200">
          <input type="checkbox" className="h-4 w-4 rounded border-slate-700" checked={includeDirectoryZeros} onChange={(event) => setIncludeDirectoryZeros(event.target.checked)} />
          Show zeros when counts missing
        </label>
        <label className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/50 px-3 py-2 text-slate-200">
          <input type="checkbox" className="h-4 w-4 rounded border-slate-700" checked={showNegativeOnly} onChange={(event) => setShowNegativeOnly(event.target.checked)} />
          <Filter className="h-4 w-4 text-amber-300" /> Focus on issues
        </label>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/60 px-3 py-2 text-slate-200"
          onClick={() => exportTable(grouped, grouping)}
        >
          <Download className="h-4 w-4 text-emerald-300" /> Export view
        </button>
      </div>

      <div className="rounded-2xl border border-slate-900/70 bg-slate-950/80 p-3 shadow-inner">
        <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-slate-500">
          <TableIcon className="h-4 w-4" /> Pivot table
        </div>
        <div className="overflow-auto">
          <table className="min-w-full text-sm text-slate-100">
            <thead className="bg-slate-900/70 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-3 py-2 text-left">{grouping === "shop" ? "Shop" : grouping === "district" ? "District" : "Region"}</th>
                {grouping !== "region" ? <th className="px-3 py-2 text-left">District</th> : null}
                <th className="px-3 py-2 text-left">Counts</th>
                <th className="px-3 py-2 text-left">Variance</th>
                <th className="px-3 py-2 text-left">Missing inv.</th>
              </tr>
            </thead>
            <tbody>
              {grouped.map((row) => (
                <tr key={row.key} className="border-b border-slate-900/60">
                  <td className="px-3 py-3 font-semibold text-white">{row.label}</td>
                  {grouping !== "region" ? <td className="px-3 py-3 text-slate-400">{row.children?.[0]?.district ?? "--"}</td> : null}
                  <td className="px-3 py-3 text-slate-200">{row.counts}</td>
                  <td className="px-3 py-3">
                    <span className={`inline-flex min-w-[120px] items-center justify-between gap-2 rounded-full border px-3 py-1 font-semibold ${toneForVariance(row.variance, row.missingInventory)}`}>
                      {formatCurrency(row.variance)}
                      <span className="text-xs text-slate-400">+/-500 red</span>
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${row.missingInventory > 0 ? "border-rose-400/60 text-rose-200" : "border-emerald-400/40 text-emerald-200"}`}>
                      {row.missingInventory} {row.missingInventory === 1 ? "miss" : "misses"}
                    </span>
                  </td>
                </tr>
              ))}
              {!grouped.length ? (
                <tr>
                  <td className="px-3 py-4 text-sm text-slate-400" colSpan={5}>
                    No rows yet. Upload a sheet or use the sample.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-900/70 bg-slate-950/80 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Top outliers</p>
            <p className="text-sm text-slate-300">Worst 10 on missing counts and dollars.</p>
          </div>
          <select
            className="rounded-full border border-slate-800 bg-slate-900/70 px-3 py-1 text-sm text-slate-100"
            value={grouping}
            onChange={(event) => setGrouping(event.target.value as Grouping)}
          >
            <option value="shop">Shop</option>
            <option value="district">District</option>
            <option value="region">Region</option>
          </select>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {topOutliers.map((row) => (
            <div key={row.key} className="rounded-xl border border-slate-900/80 bg-slate-900/60 p-3">
              <div className="flex items-center justify-between text-sm text-slate-300">
                <span className="font-semibold text-white">{row.label}</span>
                <span className="text-xs text-slate-500">{row.children?.[0]?.region ?? ""}</span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${row.missingInventory > 0 ? "border-rose-400/60 text-rose-200" : "border-emerald-400/60 text-emerald-200"}`}>
                  {row.missingInventory} missing
                </span>
                <span className={`text-sm font-semibold ${Math.abs(row.variance) >= 500 || row.missingInventory > 0 ? "text-rose-200" : "text-emerald-200"}`}>
                  {formatCurrency(row.variance)}
                </span>
              </div>
            </div>
          ))}
          {!topOutliers.length ? <p className="text-sm text-slate-400">No outliers to show yet.</p> : null}
        </div>
      </div>
    </section>
  );
}

function normalizeRows(records: Record<string, string | number>[]): PivotRow[] {
  return records
    .map((row) => {
      const region = String(row.Region ?? row.region ?? row.REGION ?? "Unknown Region");
      const district = String(row.District ?? row.district ?? row.DISTRICT ?? "Unknown District");
      const shop = String(row.Shop ?? row.Store ?? row.store ?? row.SHOP ?? row.STORE ?? "0").replace("#", "").trim();
      const periodLabel = String(row.Period ?? row.period ?? row.Label ?? row.label ?? "Current");
      const counts = Number(row.Counts ?? row.counts ?? row.COUNTS ?? 0);
      const variance = Number(row.Variance ?? row.variance ?? row.VAR ?? 0);
      const missingInventory = Number(row["Missing Inventory"] ?? row.missingInventory ?? row.MISSING ?? 0);
      return { region, district, shop, periodLabel, counts, variance, missingInventory: missingInventory || (counts ? 0 : 1) };
    })
    .filter((row) => !!row.shop);
}

function exportTable(rows: { key: string; label: string; counts: number; variance: number; missingInventory: number }[], grouping: Grouping) {
  if (!rows.length) return;
  const csv = [
    ["Group", "Counts", "Variance", "Missing Inventory"].join(","),
    ...rows.map((row) => [row.label, row.counts, row.variance, row.missingInventory].join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `inventory-pivot-${grouping}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

"use client";

import React, { useCallback, useState, useRef, useMemo } from "react";
import * as XLSX from "xlsx";

type Row = Record<string, unknown>;
type SummaryRow = { shop: string; sales?: number; cars?: number; big4?: number; mobil1?: number; coolants?: number; [k: string]: number | string | undefined };

function normalizeNumber(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number") return isFinite(v) ? v : 0;
  const s = String(v).replace(/[^0-9.\-]/g, "").trim();
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function aggregateByShop(rows: Row[]) {
  const map = new Map<string, Record<string, number>>();
  if (!rows || rows.length === 0) return [];
  const headers = Object.keys(rows[0] || {});
  const findHeader = (candidates: string[]) => {
    for (const c of candidates) {
      const found = headers.find((h) => h.toLowerCase().includes(c));
      if (found) return found;
    }
    return null;
  };
  const shopKey = findHeader(["store", "shop", "location", "store#", "store number", "id"]) || headers[0] || "(unknown)";

  for (const r of rows) {
    const shopRaw = r[shopKey] ?? r["store"] ?? r["shop"] ?? r["Store"] ?? r["Shop"] ?? r["location"];
    const shop = shopRaw == null ? "(unknown)" : String(shopRaw);
    let entry = map.get(shop);
    if (!entry) {
      entry = { cars: 0, sales: 0, big4: 0, coolants: 0, diffs: 0, donations: 0, mobil1: 0 };
      map.set(shop, entry);
    }
    entry.cars += normalizeNumber(r["cars"] ?? r["Cars"] ?? r["car"] ?? r["Car"] ?? r["Store Hours"] ?? 0);
    entry.sales += normalizeNumber(r["sales"] ?? r["Sales"] ?? r["revenue"] ?? r["Revenue"] ?? 0);
    entry.big4 += normalizeNumber(r["big4"] ?? r["Big 4"] ?? r["big_4"] ?? 0);
    entry.coolants += normalizeNumber(r["coolants"] ?? r["Coolants"] ?? r["coolant"] ?? 0);
    entry.diffs += normalizeNumber(r["diffs"] ?? r["Diffs"] ?? 0);
    entry.donations += normalizeNumber(r["donations"] ?? r["Donations"] ?? 0);
    entry.mobil1 += normalizeNumber(r["mobil1"] ?? r["Mobil1"] ?? 0);
  }
  return Array.from(map.entries()).map(([shop, metrics]) => ({ shop, ...metrics }));
}

function BarChartSVG({ data, valueKey = "sales", width = 820, height = 240 }: { data: SummaryRow[]; valueKey?: string; width?: number; height?: number }) {
  const max = Math.max(...data.map((d) => (d[valueKey] as number) ?? 0), 1);
  const pad = 36;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  const barW = Math.max(10, Math.floor(innerW / Math.max(1, data.length)) - 8);
  return (
    <svg id="dm-kpi-chart" width={width} height={height} className="rounded border border-slate-700 bg-transparent">
      <g transform={`translate(${pad},${pad})`}>
        {data.map((d, i) => {
          const val = (d[valueKey] as number) ?? 0;
          const h = (val / max) * innerH;
          const x = i * (barW + 8);
          const y = innerH - h;
          return (
            <g key={i}>
              <rect x={x} y={y} width={barW} height={h} fill="#60a5fa" rx={3} />
              <text x={x + barW / 2} y={innerH + 14} fontSize={11} textAnchor="middle" fill="#cbd5e1">
                {String(d.shop).slice(0, 10)}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}

export default function Page() {
  const [rows, setRows] = useState<Row[]>([]);
  const [summary, setSummary] = useState<SummaryRow[]>([]);
  const [lastFilename, setLastFilename] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const [selectedKpi, setSelectedKpi] = useState<string>("sales");
  const [query, setQuery] = useState("");
  const [detectedHeaders, setDetectedHeaders] = useState<string[]>([]);
  const [headerMapOpen, setHeaderMapOpen] = useState(false);
  const [headerMap, setHeaderMap] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [headerMatchTrace, setHeaderMatchTrace] = useState<Record<string, { matched?: string; method?: string }>>({});
  const [mappingToast, setMappingToast] = useState<{ text: string; visible: boolean }>({ text: "", visible: false });
  const [mappingPresets, setMappingPresets] = useState<Record<string, Record<string, string>>>({});
  const [mappingPresetName, setMappingPresetName] = useState<string>("");
  const [viewPresets, setViewPresets] = useState<Record<string, { includedKpis: string[]; selectedKpi?: string; mappingPreset?: string }>>({});
  const [viewPresetName, setViewPresetName] = useState<string>("");

  const canonicalFields = useMemo(() => [
    'shop', 'sales', 'cars', 'big4', 'mobil1', 'coolants', 'diffs', 'donations', 'fuel_filters', 'pmix'
  ], []);

  const [includedKpis, setIncludedKpis] = useState<string[]>(['sales','cars']);
  const [suggestedKpis, setSuggestedKpis] = useState<string[]>([]);
  const [viewPeriod, setViewPeriod] = useState<'day'|'week'|'month'>('day');

  const primaryKpis = ['sales','cars'];
  const controllableKpis = ['big4','coolants','diffs','fuel_filters','pmix'];

  const displayColumns = useMemo(() => {
    // primary first, then controllables that are included, then other included
    const prim = primaryKpis ?? ['sales','cars'];
    const controllablesIncluded = controllableKpis.filter((k) => includedKpis.includes(k));
    // derive other included KPIs from the summary keys to avoid TDZ issues
    const known = new Set([...primaryKpis, ...controllableKpis, 'shop']);
    const summaryKeys = Array.from(new Set(Object.keys(summary[0] ?? {})));
    const othersIncluded = summaryKeys.filter((k) => !known.has(k) && includedKpis.includes(k));
    return Array.from(new Set([...prim, ...controllablesIncluded, ...othersIncluded]));
  }, [includedKpis, summary]);

  const colMaxMap = useMemo(() => {
    const m: Record<string, number> = {};
    for (const c of displayColumns) {
      const max = Math.max(...summary.map((r) => Number(r[c] ?? 0)), 1);
      m[c] = max || 1;
    }
    return m;
  }, [summary, displayColumns]);

  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('desc');

  const toggleSort = (key: string) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir('desc');
      return;
    }
    setSortDir((d) => d === 'desc' ? 'asc' : 'desc');
  };

  const filteredSummary = useMemo(() => {
    const q = query.trim().toLowerCase();
    return summary.filter((s) => !q || String(s.shop).toLowerCase().includes(q));
  }, [summary, query]);

  const sortedSummary = useMemo(() => {
    const data = [...filteredSummary];
    if (!sortKey) return data;
    data.sort((a, b) => {
      const av = Number(a[sortKey] ?? 0);
      const bv = Number(b[sortKey] ?? 0);
      if (isNaN(av) && isNaN(bv)) return 0;
      if (isNaN(av)) return 1;
      if (isNaN(bv)) return -1;
      return sortDir === 'asc' ? av - bv : bv - av;
    });
    return data;
  }, [filteredSummary, sortKey, sortDir]);

  const applyAggregation = useCallback((json: Row[]) => {
    // if headerMap is present, remap rows to canonical keys using case-insensitive lookups
    let remapped = json;
    if (detectedHeaders.length > 0 && Object.keys(headerMap).length > 0) {
      // build a normalized key map based on the first row (keys present in the sheet)
      const firstRow = json[0] ?? {};
      const keyMap = new Map<string, string>();
      Object.keys(firstRow).forEach((k) => keyMap.set(String(k).toLowerCase().trim(), k));

      const matchTrace: Record<string, { matched?: string; method?: string }> = {};
      for (const c of canonicalFields) {
        const desired = headerMap[c];
        if (desired) {
          const lookup = String(desired).toLowerCase().trim();
          const exact = keyMap.get(lookup);
          if (exact) {
            matchTrace[c] = { matched: exact, method: 'explicit-exact' };
            continue;
          }
          const contains = Array.from(keyMap.entries()).find(([lk]) => lk.includes(lookup))?.[1];
          if (contains) {
            matchTrace[c] = { matched: contains, method: 'explicit-contains' };
            continue;
          }
        }
        // fallback to canonical name match
        const fallback = Array.from(keyMap.entries()).find(([lk]) => lk === c || lk.includes(c))?.[1];
        if (fallback) {
          matchTrace[c] = { matched: fallback, method: headerMap[c] ? 'fallback-contains' : 'fallback-exact' };
        } else {
          matchTrace[c] = { matched: undefined, method: 'none' };
        }
      }
      setHeaderMatchTrace(matchTrace);

      // remap rows using the trace
      remapped = json.map((r) => {
        const out: Row = { ...r };
        for (const c of canonicalFields) {
          const m = matchTrace[c];
          if (m?.matched && r[m.matched] !== undefined) out[c] = r[m.matched];
        }
        return out;
      });

      // show a brief mapping summary toast
      const mappedSummary = Object.entries(matchTrace).map(([k, v]) => `${k}→${v.matched ?? '—'}(${v.method})`).join(', ');
      setMappingToast({ text: `Column mapping applied: ${mappedSummary}`, visible: true });
      window.setTimeout(() => setMappingToast((s) => ({ ...s, visible: false })), 6000);
    }
    const agg = aggregateByShop(remapped);
    agg.sort((a, b) => (b[selectedKpi as string] ?? 0) - (a[selectedKpi as string] ?? 0));
    setSummary(agg.slice(0, 24));
  }, [selectedKpi, canonicalFields, detectedHeaders, headerMap]);

  // mapping & view presets storage helpers
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem('dm_mapping_presets_v1');
      if (raw) setMappingPresets(JSON.parse(raw));
    } catch (e) {
      console.warn('failed to load mapping presets', e);
    }
    try {
      const rawv = localStorage.getItem('dm_view_presets_v1');
      if (rawv) setViewPresets(JSON.parse(rawv));
    } catch (e) {
      console.warn('failed to load view presets', e);
    }
  }, []);

  const saveMappingPreset = useCallback((name: string) => {
    if (!name) return;
    const next = { ...(mappingPresets || {}), [name]: headerMap };
    setMappingPresets(next);
    localStorage.setItem('dm_mapping_presets_v1', JSON.stringify(next));
    setMappingPresetName("");
    setMappingToast({ text: `Mapping saved: ${name}`, visible: true });
    window.setTimeout(() => setMappingToast((s) => ({ ...s, visible: false })), 3000);
  }, [headerMap, mappingPresets]);

  const deleteMappingPreset = useCallback((name: string) => {
    const copy = { ...(mappingPresets || {}) };
    delete copy[name];
    setMappingPresets(copy);
    localStorage.setItem('dm_mapping_presets_v1', JSON.stringify(copy));
  }, [mappingPresets]);

  const applyMappingPreset = useCallback((name: string) => {
    const preset = mappingPresets?.[name];
    if (!preset) return;
    setHeaderMap(preset);
    // re-run aggregation using currently loaded rows
    if (rows && rows.length) applyAggregation(rows);
    setMappingToast({ text: `Applied mapping: ${name}`, visible: true });
    window.setTimeout(() => setMappingToast((s) => ({ ...s, visible: false })), 3000);
  }, [mappingPresets, applyAggregation, rows]);

  const saveViewPreset = useCallback((name: string, mappingPreset?: string) => {
    if (!name) return;
    const next = { ...(viewPresets || {}), [name]: { includedKpis, selectedKpi, mappingPreset } };
    setViewPresets(next);
    localStorage.setItem('dm_view_presets_v1', JSON.stringify(next));
    setViewPresetName("");
    setMappingToast({ text: `View saved: ${name}`, visible: true });
    window.setTimeout(() => setMappingToast((s) => ({ ...s, visible: false })), 3000);
  }, [includedKpis, selectedKpi, viewPresets]);

  const applyViewPreset = useCallback((name: string) => {
    const p = viewPresets?.[name];
    if (!p) return;
    if (p.mappingPreset) applyMappingPreset(p.mappingPreset);
    if (p.includedKpis) setIncludedKpis(p.includedKpis);
    if (p.selectedKpi) setSelectedKpi(p.selectedKpi);
    setMappingToast({ text: `Applied view: ${name}`, visible: true });
    window.setTimeout(() => setMappingToast((s) => ({ ...s, visible: false })), 3000);
  }, [viewPresets, applyMappingPreset]);

  const onFile = useCallback(async (file: File | null) => {
    if (!file) return;
    const raw = await file.arrayBuffer();
    const wb = XLSX.read(raw, { type: "array" });
    const sheetName = wb.SheetNames[0];
    const sheet = wb.Sheets[sheetName];
    // try to detect header row in the first few rows (some exports include leading notes)
    const rowsArr = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[];
    let headerRowIndex = 0;
    const headerCandidates = ['store', 'shop', 'location', 'sales', 'revenue', 'cars', 'big4', 'coolant', 'diff', 'donation', 'fuel', 'pmix'];
    for (let i = 0; i < Math.min(6, rowsArr.length); i++) {
      const r = rowsArr[i] as any[] | undefined;
      if (!r) continue;
      const found = r.some((cell: any) => {
        if (cell == null) return false;
        const s = String(cell).toLowerCase();
        return headerCandidates.some((c) => s.includes(c));
      });
      if (found) { headerRowIndex = i; break; }
    }
    const json = XLSX.utils.sheet_to_json<Row>(sheet, { defval: null, range: headerRowIndex });
    setRows(json);
    // detect headers from the chosen header row or from json keys
    const headers = Array.isArray(rowsArr[headerRowIndex]) ? rowsArr[headerRowIndex] as string[] : undefined;
    const headerList = Array.isArray(headers) ? headers.map(String) : Object.keys(json[0] ?? {});
    setDetectedHeaders(headerList || []);
    // attempt quick auto-map
    const autoMap: Record<string, string> = {};
    const tryFind = (candidates: string[]) => headerList.find(h => candidates.some(c => h.toLowerCase().includes(c)));
    autoMap['shop'] = tryFind(['store', 'shop', 'location', 'store#']) || headerList[0] || '';
    autoMap['sales'] = tryFind(['sales','revenue','total']) || '';
    autoMap['cars'] = tryFind(['cars','car','count']) || '';
    autoMap['big4'] = tryFind(['big 4','big4','big_4']) || '';
    autoMap['mobil1'] = tryFind(['mobil','mobil1']) || '';
    autoMap['coolants'] = tryFind(['coolant','coolants']) || '';
    autoMap['diffs'] = tryFind(['diff','diffs']) || '';
    autoMap['donations'] = tryFind(['donation','donations']) || '';
    autoMap['fuel_filters'] = tryFind(['fuel filter','fuel filters','filter']) || '';
    autoMap['pmix'] = tryFind(['pmix','p-mix','p mix','pmix%']) || '';
    setHeaderMap(autoMap);
    setLastFilename(file.name ?? null);
    applyAggregation(json);
  }, [applyAggregation]);

  const onInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    onFile(f);
  }, [onFile]);

  const onDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0] ?? null;
    onFile(f);
  }, [onFile]);

  const onDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  const loadSample = useCallback(async () => {
    try {
      const res = await fetch("/PocketManager5_sitetmpupload_samples/Sample Weekly review.xlsx");
      if (!res.ok) throw new Error("Sample not available via static path");
      const buf = await res.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      // detect header row similar to onFile
      const rowsArr = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[];
      let headerRowIndex = 0;
      const headerCandidates = ['store', 'shop', 'location', 'sales', 'revenue', 'cars', 'big4', 'coolant', 'diff', 'donation', 'fuel', 'pmix'];
      for (let i = 0; i < Math.min(6, rowsArr.length); i++) {
        const r = rowsArr[i] as any[] | undefined;
        if (!r) continue;
        const found = r.some((cell: any) => {
          if (cell == null) return false;
          const s = String(cell).toLowerCase();
          return headerCandidates.some((c) => s.includes(c));
        });
        if (found) { headerRowIndex = i; break; }
      }
      const json = XLSX.utils.sheet_to_json<Row>(sheet, { defval: null, range: headerRowIndex });
      const headers = Array.isArray(rowsArr[headerRowIndex]) ? rowsArr[headerRowIndex] as string[] : undefined;
      setRows(json);
      setDetectedHeaders(Array.isArray(headers) ? headers.map(String) : Object.keys(json[0] ?? {}));
      applyAggregation(json);
      // suggest KPIs based on aggregated data
      suggestKpis(aggregateByShop(json));
    } catch (e) {
      console.warn(e);
      alert("Unable to load sample file. Please upload the Sample Weekly review.xlsx manually.");
    }
  }, [applyAggregation]);

  const downloadCSV = useCallback(() => {
    if (!summary || summary.length === 0) return;
    const cols = Object.keys(summary[0]);
    const csv = [cols.join(","), ...summary.map((r) => cols.map((c) => (r[c] ?? "").toString().replace(/,/g,"")).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const name = `kpi_summary_${new Date().toISOString().slice(0,10)}.csv`;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }, [summary]);

  const exportPngAndCsv = useCallback(async () => {
    try {
      const svg = document.getElementById("dm-kpi-chart") as SVGSVGElement | null;
      if (!svg) {
        alert("Chart not available to export.");
        return;
      }
      const serializer = new XMLSerializer();
      const svgStr = serializer.serializeToString(svg);
      const blob = new Blob([`<?xml version="1.0" encoding="utf-8"?>\n${svgStr}`], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = svg.clientWidth || Number(svg.getAttribute("width") || 900);
          canvas.height = svg.clientHeight || Number(svg.getAttribute("height") || 280);
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("Unable to get canvas context");
          ctx.fillStyle = "#0b1220";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
          canvas.toBlob((pngBlob) => {
            if (!pngBlob) {
              URL.revokeObjectURL(url);
              alert("Failed to create PNG");
              return;
            }
            const pngUrl = URL.createObjectURL(pngBlob);
            const a = document.createElement("a");
            a.href = pngUrl;
            a.download = `kpi_chart_${new Date().toISOString().slice(0,10)}.png`;
            a.click();
            URL.revokeObjectURL(pngUrl);
            URL.revokeObjectURL(url);
            downloadCSV();
          }, "image/png");
        } catch (err) {
          console.warn(err);
          URL.revokeObjectURL(url);
          alert("Export failed");
        }
      };
      img.onerror = (e) => {
        console.warn(e);
        URL.revokeObjectURL(url);
        alert("Failed to load chart image for export");
      };
      img.crossOrigin = "anonymous";
      img.src = url;
    } catch (err) {
      console.warn(err);
      alert("Export failed");
    }
  }, [summary, downloadCSV]);

  // backward-compat alias for older code references
  const allKpis = useMemo(() => {
    const keys = new Set<string>(canonicalFields);
    Object.keys(summary[0] ?? {}).forEach((k) => keys.add(k));
    return Array.from(keys).filter(k => k !== 'shop');
  }, [summary, canonicalFields]);
  const availableKpis = allKpis;
  const otherKpis = useMemo(() => allKpis.filter(k => ![...primaryKpis, ...controllableKpis].includes(k)), [allKpis]);

  // detect columns that should be shown as percentages
  const percentCols = useMemo(() => {
    const s = new Set<string>();
    const keys = Array.from(new Set([...allKpis]));
    const lowerDetected = detectedHeaders.map((h) => String(h).toLowerCase());
    for (const k of keys) {
      const kLower = String(k).toLowerCase();
      // obvious canonical names
      if (kLower.includes('pmix') || kLower.includes('pct') || kLower.includes('percent')) {
        s.add(k);
        continue;
      }
      // headerMap explicit markers
      const mapped = headerMap[k];
      if (mapped && String(mapped).toLowerCase().includes('%')) {
        s.add(k);
        continue;
      }
      if (mapped && String(mapped).toLowerCase().includes('percent')) {
        s.add(k);
        continue;
      }
      // detected header contains % or percent
      const foundHeader = lowerDetected.find((h) => h.includes('%') || h.includes('percent') || h.includes('pct'));
      if (foundHeader) {
        // if headerMap maps this key to that header, mark it; otherwise use numeric heuristic below
        if (mapped && String(mapped).toLowerCase() === foundHeader) {
          s.add(k);
          continue;
        }
      }
      // numeric heuristic: if all values are between 0 and 1 (and some >0), treat as percent
      const vals = summary.map((r) => Number(r[k] ?? 0)).filter((v) => !Number.isNaN(v));
      if (vals.length > 0) {
        const max = Math.max(...vals.map((v) => Math.abs(v)));
        const someBetween0And1 = vals.some((v) => v > 0 && Math.abs(v) <= 1);
        if (max <= 1 && someBetween0And1) {
          s.add(k);
          continue;
        }
      }
    }
    return s;
  }, [summary, headerMap, detectedHeaders, allKpis]);

  const formatCellValue = useCallback((raw: unknown, col: string) => {
    const n = Number(raw ?? 0);
    if (!percentCols.has(col)) {
      if (Number.isNaN(n)) return String(raw ?? '-');
      return n === 0 ? '-' : n.toLocaleString();
    }
    if (Number.isNaN(n)) return String(raw ?? '-');
    if (n === 0) return '-';
    // if value appears as fraction (<=1) treat as 0-1 -> percent, else treat as whole percent number
    let pct = n;
    if (Math.abs(n) <= 1) pct = n * 100;
    // round to 1 decimal unless it's effectively an integer
    const rounded = Math.abs(pct - Math.round(pct)) < 0.05 ? Math.round(pct) : Math.round(pct * 10) / 10;
    // remove .0
    const str = (Math.abs(rounded - Math.round(rounded)) < 0.0001) ? String(Math.round(rounded)) : String(rounded);
    return `${str}%`;
  }, [percentCols]);


  // compute KPI stats (total and variance) to suggest important KPIs
  const computeKpiStats = useCallback((rows: SummaryRow[]) => {
    const numericKeys = new Set<string>();
    for (const r of rows) {
      for (const k of Object.keys(r)) {
        if (k === 'shop') continue;
        const v = Number(r[k] ?? 0);
        if (!Number.isNaN(v)) numericKeys.add(k);
      }
    }
    const stats: { key: string; total: number; variance: number }[] = [];
    for (const key of Array.from(numericKeys)) {
      const vals = rows.map((r) => Number(r[key] ?? 0));
      const total = vals.reduce((s, x) => s + x, 0);
      const mean = vals.length ? total / vals.length : 0;
      const variance = vals.length ? vals.reduce((s, x) => s + (x - mean) ** 2, 0) / vals.length : 0;
      stats.push({ key, total, variance });
    }
    return stats.sort((a, b) => b.variance - a.variance);
  }, []);

  const suggestKpis = useCallback((rows: SummaryRow[]) => {
    const stats = computeKpiStats(rows);
    // pick top 6 by variance, always include sales and cars
    const picks = stats.map(s => s.key).filter(k => k !== 'shop');
    const top = picks.slice(0, 6);
    const uniq = Array.from(new Set(['sales','cars', ...top]));
    setSuggestedKpis(uniq);
    return uniq;
  }, [computeKpiStats]);

  React.useEffect(() => {
    if (summary && summary.length) {
      suggestKpis(summary);
    }
  }, [summary, suggestKpis]);

  return (
    <main className="px-4 py-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-4 mb-4">
        <h1 className="text-2xl md:text-3xl font-semibold text-white">DM Daily Review — KPI Visualizer</h1>
        <div className="ml-auto flex gap-2">
          <button onClick={loadSample} className="bg-sky-600 text-white px-3 py-1 rounded text-sm font-semibold">Load Sample</button>
          <button onClick={() => fileRef.current?.click()} className="bg-neutral-800 text-white px-3 py-1 rounded text-sm">Choose File</button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={onInputChange} style={{ display: "none" }} />
          <button onClick={downloadCSV} disabled={!summary || summary.length === 0} className="bg-neutral-700 text-white px-3 py-1 rounded text-sm disabled:opacity-50">Download CSV</button>
          <button onClick={exportPngAndCsv} disabled={!summary || summary.length === 0} className="bg-indigo-600 text-white px-3 py-1 rounded text-sm disabled:opacity-50">Export PNG + CSV</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div>
          <div onDrop={onDrop} onDragOver={onDragOver} className="border border-slate-700 rounded-md p-2 bg-slate-900/40">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-slate-300">Upload or drop your Weekly review Excel/CSV here</div>
                <div className="text-xs text-slate-500 mt-0.5">Tabs named KPI, Summary, or DM Snapshot usually work.</div>
              </div>
              <div>
                <button onClick={() => fileRef.current?.click()} className="bg-emerald-600 text-white px-3 py-1 rounded text-sm">Upload</button>
              </div>
            </div>
          </div>
        </div>

        <aside>
        <div className="md:col-span-2">
          <div className="p-3 rounded border border-slate-700 bg-slate-900/40 h-full">
            <div className="text-sm text-slate-300 mb-2">KPI Selector</div>
            <div className="text-xs text-slate-400 mb-2">Toggle KPIs to include in reporting and table display.</div>
            <div className="space-y-3">
                <div>
                  <div className="text-xs text-slate-300 mb-2">Primary Metrics</div>
                  <div className="flex gap-2">
                    {primaryKpis.map((k) => (
                      <button key={k} className="px-3 py-1 rounded text-sm bg-emerald-600 text-white" disabled>{k.toUpperCase()}</button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-slate-300 mb-2">Controllables</div>
                  <div className="grid grid-cols-2 gap-2">
                    {controllableKpis.map((k) => {
                      const label = k === 'fuel_filters' ? 'Fuel Filters' : k === 'pmix' ? 'Pmix' : k;
                      const active = includedKpis.includes(k);
                      return (
                        <button key={k} onClick={() => setIncludedKpis((s) => s.includes(k) ? s.filter(x => x !== k) : [...s, k])} className={`px-2 py-1 rounded text-xs ${active ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300'}`}>{label}</button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-slate-300 mb-2">Other KPIs</div>
                  <div className="grid grid-cols-3 gap-2">
                    {otherKpis.map((k) => {
                      const label = k === 'fuel_filters' ? 'Fuel Filters' : k === 'pmix' ? 'Pmix' : k;
                      const active = includedKpis.includes(k);
                      return (
                        <button key={k} onClick={() => setIncludedKpis((s) => s.includes(k) ? s.filter(x => x !== k) : [...s, k])} className={`px-2 py-1 rounded text-xs ${active ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300'}`}>{label}</button>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-2 flex gap-2">
                  <button onClick={() => setIncludedKpis(Array.from(new Set([...primaryKpis, ...suggestedKpis])))} className="bg-indigo-600 text-white px-3 py-1 rounded text-sm">Apply suggested KPIs</button>
                  <button onClick={() => setIncludedKpis(primaryKpis)} className="bg-neutral-700 text-white px-3 py-1 rounded text-sm">Reset</button>
                </div>
            </div>
          </div>
        </div>

        <div>
          <div className="p-3 rounded border border-slate-700 bg-slate-900/40">
            <div className="text-sm text-slate-300 font-medium mb-2">Actions</div>
            <div className="flex flex-col gap-2">
                <button onClick={async () => {
                  try {
                    if (!summary || summary.length === 0) {
                      alert('No summary to save');
                      return;
                    }
                    const payload = {
                      date: new Date().toISOString().slice(0,10),
                      filename: lastFilename,
                      source: 'dm-daily-review',
                      notes: `Saved from DM Daily Review UI (kpi=${selectedKpi})`,
                      included_kpis: includedKpis,
                      summary: summary
                    };
                    const res = await fetch('/api/kpi/save-summary', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
                    const j = await res.json();
                    if (!res.ok) throw new Error(j?.error || 'save failed');
                    alert('Saved summary: ' + (j.upload_id ?? 'ok'));
                  } catch (err: any) {
                    console.error(err);
                    alert('Save failed: ' + (err?.message ?? String(err)));
                  }
                }} className="bg-sky-600 text-white px-3 py-1 rounded text-sm">Save summary (to Supabase)</button>
                <button onClick={() => setHeaderMapOpen((s) => !s)} className="bg-neutral-700 text-white px-3 py-1 rounded text-sm">Map columns</button>
                <button onClick={() => navigator.clipboard?.writeText(JSON.stringify(summary.slice(0, 20)))} className="bg-neutral-800 text-white px-3 py-1 rounded text-sm">Copy top 20 JSON</button>
                <div className="border-t border-slate-700 pt-2">
                  <div className="text-xs text-slate-300 mb-1">Quick Views</div>
                  <div className="flex flex-col gap-2">
                    <button onClick={() => setIncludedKpis(controllableKpis)} className="bg-emerald-600 text-black px-3 py-1 rounded text-sm">Controllables by Shop</button>
                    <div className="flex gap-2">
                      <input value={viewPresetName} onChange={(e) => setViewPresetName(e.target.value)} placeholder="View name" className="flex-1 bg-slate-800 text-white px-2 py-1 rounded text-xs" />
                      <button onClick={() => saveViewPreset(viewPresetName)} className="bg-indigo-600 text-white px-3 py-1 rounded text-sm">Save view</button>
                    </div>
                    <div className="space-y-1">
                      {Object.keys(viewPresets).length === 0 ? (
                        <div className="text-slate-400 text-xs">No saved views</div>
                      ) : (
                        Object.keys(viewPresets).map((n) => (
                          <div key={n} className="flex items-center gap-2">
                            <button onClick={() => applyViewPreset(n)} className="bg-slate-800 text-white px-2 py-1 rounded text-xs">Apply</button>
                            <div className="flex-1 text-slate-300 text-xs">{n}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Overview + Controllables as a full-width district rollup container */}
        <div className="md:col-span-4">
          <div className="p-3 rounded border border-slate-700 bg-slate-900/40 mt-2">
            <div className="text-sm text-slate-300 mb-3">District Rollup KPIs</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3 rounded border border-slate-700 bg-slate-900/40">
                <div className="text-sm text-slate-300 mb-2">Overview</div>
                <div className="grid grid-cols-1 gap-2">
                  <div className="p-3 bg-slate-800 rounded text-white">
                    <div className="text-xs text-slate-300">Total Sales</div>
                    <div className="text-2xl font-semibold">{summary.reduce((s, r) => s + ((r.sales as number) ?? 0), 0).toLocaleString()}</div>
                  </div>
                  <div className="p-3 bg-slate-800 rounded text-white">
                    <div className="text-xs text-slate-300">Total Cars</div>
                    <div className="text-2xl font-semibold">{summary.reduce((s, r) => s + ((r.cars as number) ?? 0), 0).toLocaleString()}</div>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded border border-slate-700 bg-slate-900/40">
                <div className="text-sm text-slate-300 mb-2">Controllables</div>
                <div className="grid grid-cols-2 gap-2">
                  {['big4','coolants','diffs','fuel_filters','pmix'].map((k) => (
                    <div key={k} className="p-2 bg-slate-800 rounded text-white">
                      <div className="text-xs text-slate-300">{k === 'fuel_filters' ? 'Fuel Filters' : k === 'pmix' ? 'Pmix' : k}</div>
                      <div className="text-lg font-semibold">{(summary.reduce((s, r) => s + (Number(r[k] ?? 0) || 0), 0)).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {headerMapOpen && (
          <div className="p-3 rounded border border-rose-700 bg-slate-900/50 md:col-span-4">
                <div className="text-sm text-rose-200 font-medium mb-2">Column Mapping (detected headers)</div>
                <div className="text-xs text-slate-300 mb-2">Map sheet headers to canonical KPI keys used for aggregation.</div>
                <div className="space-y-2">
                  {['shop','sales','cars','big4','mobil1','coolants','diffs','donations','fuel_filters','pmix'].map((c) => (
                    <div key={c} className="flex items-center gap-2">
                      <div className="w-20 text-slate-300 text-xs">{c}</div>
                      <select value={headerMap[c] ?? ''} onChange={(e) => setHeaderMap((m) => ({ ...m, [c]: e.target.value }))} className="flex-1 bg-slate-800 text-white px-2 py-1 rounded text-xs">
                        <option value="">— none —</option>
                        {detectedHeaders.map((h) => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <button onClick={() => { setHeaderMapOpen(false); if (rows.length) applyAggregation(rows); }} className="bg-emerald-600 text-white px-3 py-1 rounded text-sm">Apply</button>
                  <button onClick={() => setHeaderMapOpen(false)} className="bg-neutral-700 text-white px-3 py-1 rounded text-sm">Close</button>
                </div>
                {mappingToast.visible && (
                  <div className="mt-3 p-2 rounded bg-emerald-600 text-black text-xs">{mappingToast.text}</div>
                )}

                <div className="mt-3 text-xs text-slate-200">
                  <div className="font-medium mb-1">Mapping Trace</div>
                  <div className="space-y-1 max-h-40 overflow-auto">
                    {Object.keys(headerMatchTrace).length === 0 ? (
                      <div className="text-slate-400">No mapping data yet. Apply mapping or upload a file.</div>
                    ) : (
                      Object.entries(headerMatchTrace).map(([k, v]) => (
                        <div key={k} className="flex items-center justify-between bg-slate-800/40 p-2 rounded">
                          <div className="w-24 text-slate-300 text-xs">{k}</div>
                          <div className="flex-1 text-white text-xs ml-2">{v.matched ?? '—'}</div>
                          <div className="text-slate-400 text-xs ml-2">{v.method}</div>
                        </div>
                      ))
                    )}
                  </div>
                    <div className="mt-2 flex gap-2 items-center">
                      <button onClick={() => navigator.clipboard?.writeText(JSON.stringify(headerMatchTrace))} className="bg-neutral-800 text-white px-2 py-1 rounded text-xs">Copy mapping JSON</button>
                      <input value={mappingPresetName} onChange={(e) => setMappingPresetName(e.target.value)} placeholder="Preset name" className="bg-slate-800 text-white px-2 py-1 rounded text-xs" />
                      <button onClick={() => saveMappingPreset(mappingPresetName)} className="bg-emerald-600 text-black px-2 py-1 rounded text-xs">Save mapping</button>
                    </div>
                    <div className="mt-2 text-xs">
                      {Object.keys(mappingPresets).length === 0 ? (
                        <div className="text-slate-400">No saved mappings</div>
                      ) : (
                        <div className="space-y-1">
                          {Object.keys(mappingPresets).map((n) => (
                            <div key={n} className="flex items-center gap-2">
                              <button onClick={() => applyMappingPreset(n)} className="bg-slate-800 text-white px-2 py-1 rounded text-xs">Apply</button>
                              <div className="flex-1 text-slate-300 text-xs">{n}</div>
                              <button onClick={() => deleteMappingPreset(n)} className="bg-rose-600 text-white px-2 py-1 rounded text-xs">Delete</button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                </div>
              </div>
            )}

            <div className="p-3 rounded border border-slate-700 bg-slate-900/40 text-sm text-slate-300">
              Guidance: Upload the DM daily/weekly workbook. Use the KPI selector to rank shops and export snapshots for your report.
            </div>
          </div>
        </aside>
      </div>

      {/* Full width KPI grid at the bottom (uses all available KPIs) */}
      <div className="rounded border border-slate-700 p-3 bg-slate-900/40 mt-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm text-slate-300">KPI Grid (All columns)</div>
          <div className="text-xs text-slate-400">Click a column header to sort</div>
        </div>
        <div className="overflow-auto">
          <div className="w-full inline-block align-middle">
            <div className="grid" style={{ gridTemplateColumns: `48px minmax(160px,1fr) repeat(${allKpis.length}, 120px)` }}>
              <div className="p-2 text-xs text-slate-400">#</div>
              <div className="p-2 text-xs text-slate-400">Shop</div>
              {allKpis.map((col) => (
                <div key={col} onClick={() => toggleSort(col)} className="p-2 text-xs text-slate-400 text-right cursor-pointer select-none">
                  {(col === 'fuel_filters' ? 'Fuel Filters' : col === 'pmix' ? 'Pmix' : col).toUpperCase()} {sortKey === col ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                </div>
              ))}

              {sortedSummary.map((r, i) => (
                <React.Fragment key={String(r.shop) + i}>
                  <div className="p-2 text-xs text-slate-300">{i + 1}</div>
                  <div className="p-2 text-sm text-white">{String(r.shop).slice(0, 36)}</div>
                  {allKpis.map((col) => {
                    const raw = r[col];
                    const formatted = formatCellValue(raw, col);
                    // for heatmap use numeric value (if parseable) to compute pct
                    const numeric = Number(r[col] ?? 0);
                    const max = colMaxMap[col] ?? 1;
                    const pct = max && !Number.isNaN(numeric) ? Math.min(1, numeric / max) : 0;
                    const bg = pct > 0.66 ? 'bg-emerald-600 text-black' : pct > 0.33 ? 'bg-yellow-600 text-black' : 'bg-slate-800 text-white';
                    return (
                      <div key={col} className={`p-2 text-right text-sm ${bg}`}>{formatted}</div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      </div>

      {showRaw && (
        <section>
          <h2 className="text-lg font-semibold text-white mb-2">Raw Rows Preview</h2>
          <div className="max-h-64 overflow-auto border border-slate-700 rounded p-2 bg-slate-900/30">
            <pre className="text-xs text-slate-300">{JSON.stringify(rows.slice(0, 200), null, 2)}</pre>
          </div>
        </section>
      )}
    </main>
  );
}


"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type KeyboardEvent } from "react";
import Link from "next/link";
import { CalendarClock, ClipboardCheck, Layers, Link2, Sparkles, SplitSquareHorizontal } from "lucide-react";
import { fetchRetailContext, type RetailContext } from "@/lib/retailCalendar";
import { buildRetailTimestampLabel } from "@/lib/retailTimestamp";

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

const HOURS_VARIANCE_TOLERANCE = 3;

const normalizeStoreKey = (store?: string | null) => {
  const trimmed = store?.toString().trim();
  return trimmed ? `store-${trimmed}` : null;
};

const normalizeLabelKey = (label?: string | null) => {
  const trimmed = label?.toString().trim().toLowerCase();
  return trimmed ? `label-${trimmed}` : null;
};

type Day = (typeof DAYS)[number];

type ViewMode = "app" | "workday";

type ShopRow = {
  id: string;
  label: string;
  store?: string;
  hours: Record<Day, number | "">;
};

type BulkLaborEntry = {
  date: string;
  shopId: string;
  expectedLaborPct: number | null;
  actualLaborPct: number;
  notes: string;
};

const emptyHours = (): Record<Day, number | ""> =>
  DAYS.reduce((acc, day) => {
    acc[day] = "";
    return acc;
  }, {} as Record<Day, number | "">);

const createShopRow = (seed?: Partial<Pick<ShopRow, "id" | "label" | "store">>): ShopRow => ({
  id:
    seed?.id ??
    (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `shop-${Math.random().toString(36).slice(2, 8)}`),
  label: seed?.label ?? "",
  store: seed?.store ?? "",
  hours: emptyHours(),
});

type AlignmentShop = {
  id: string;
  label: string;
  store: string;
};

const formatDisplayDate = (value: string | null | undefined): string => {
  if (!value) {
    return new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const rowComparisonKey = (row: ShopRow): string => {
  return normalizeStoreKey(row.store) ?? normalizeLabelKey(row.label) ?? row.id;
};

const rosterComparisonKey = (shop: AlignmentShop): string => {
  return normalizeStoreKey(shop.store) ?? normalizeLabelKey(shop.label) ?? shop.id;
};

const mergeRowsWithRoster = (existing: ShopRow[], roster: AlignmentShop[]): ShopRow[] => {
  if (!roster.length) {
    return existing.length ? existing : [createShopRow(), createShopRow()];
  }
  const currentMap = new Map(existing.map((row) => [rowComparisonKey(row), row] as const));
  const usedKeys = new Set<string>();
  const aligned = roster.map((shop) => {
    const key = rosterComparisonKey(shop);
    const carry = currentMap.get(key);
    if (carry) {
      usedKeys.add(key);
      return { ...carry, label: shop.label, store: shop.store } satisfies ShopRow;
    }
    usedKeys.add(key);
    return createShopRow({ id: shop.id ?? key, label: shop.label, store: shop.store });
  });
  const leftovers = existing.filter((row) => !usedKeys.has(rowComparisonKey(row)));
  return [...aligned, ...leftovers];
};

const computeTotals = (targetRows: ShopRow[]) => {
  const perDay: Record<Day, number> = DAYS.reduce((acc, day) => ({ ...acc, [day]: 0 }), {} as Record<Day, number>);
  let grand = 0;
  targetRows.forEach((row) => {
    DAYS.forEach((day) => {
      const value = row.hours[day];
      if (value !== "" && value != null) {
        perDay[day] += Number(value);
        grand += Number(value);
      }
    });
  });
  return { perDay, grand };
};

type LaborEntryWorkspaceProps = {
  origin?: "cadence" | "dm-tools";
  variant?: "standalone" | "embedded";
  fallbackRoster?: AlignmentShop[];
  lockShopIdentity?: boolean;
};

const heroCopy = {
  cadence: {
    eyebrow: "Cadence • Labor verification",
    title: "Labor entry grid",
    description: "Update daily hours for every shop in your district. Entries post straight into the labor verification task stack.",
  },
  "dm-tools": {
    eyebrow: "DM Tools • Daily Labor Portal",
    title: "District Labor capture",
    description: "Dual APP vs Workday capture with the same Sun–Sat grid synced to your alignment roster.",
  },
};

const formatNumber = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function LaborEntryWorkspace({ origin = "cadence", variant = "standalone", fallbackRoster = [], lockShopIdentity = false }: LaborEntryWorkspaceProps) {
  const isEmbedded = variant === "embedded";
  const [weekStart, setWeekStart] = useState<string>("");
  const [weekContext, setWeekContext] = useState<RetailContext | null>(null);
  const fallbackRetailContext = useMemo<RetailContext>(() => {
    const label = buildRetailTimestampLabel();
    const [phase, rawDate] = label.split(" ");
    const [quarterPart, periodPart, weekPart] = (phase ?? "").split("-");
    const parsedDate = rawDate ? new Date(rawDate) : new Date();
    return {
      quarterLabel: quarterPart ?? "Q?",
      periodLabel: periodPart ?? "P?",
      weekLabel: weekPart ? weekPart.replace(/^W/, "Wk") : "Wk?",
      dateLabel: parsedDate.toISOString().slice(0, 10),
    } satisfies RetailContext;
  }, []);
  const [viewMode, setViewMode] = useState<ViewMode>("workday");
  const [appRows, setAppRows] = useState<ShopRow[]>([]);
  const [workdayRows, setWorkdayRows] = useState<ShopRow[]>([]);
  const [notes, setNotes] = useState<string>("");
  const [status, setStatus] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [shopRoster, setShopRoster] = useState<AlignmentShop[]>(() => fallbackRoster);
  const [shopsLoading, setShopsLoading] = useState(false);
  const [shopsError, setShopsError] = useState<string | null>(null);
  const hero = heroCopy[origin] ?? heroCopy.cadence;
  const previousWeekRef = useRef<string | null>(null);
  const resolvedWeek = weekContext ?? fallbackRetailContext;
  const activeRows = viewMode === "app" ? appRows : workdayRows;
  const comparisonRows = viewMode === "app" ? workdayRows : appRows;
  const viewLabel = viewMode === "app" ? "APP Reported" : "Workday (TrueSource)";
  const comparisonLabel = viewMode === "app" ? "Workday" : "APP";
  const weekStartLabel = formatDisplayDate(weekStart || resolvedWeek.dateLabel);
  const periodWeekLabel = [resolvedWeek.periodLabel, resolvedWeek.weekLabel].filter(Boolean).join(" • ");
  const shopsHeadline = shopsLoading ? "Syncing…" : `${shopRoster.length || 0} shops`;
  const shopsDescriptor = shopsError
    ? shopsError
    : shopsLoading
      ? "Fetching shops from alignment…"
      : shopRoster.length
        ? "Roster locked to your alignment."
        : "Alignment roster unavailable right now.";

  const totals = useMemo(() => computeTotals(activeRows), [activeRows]);
  const comparisonMap = useMemo(() => {
    const map = new Map<string, ShopRow>();
    comparisonRows.forEach((row) => map.set(rowComparisonKey(row), row));
    return map;
  }, [comparisonRows]);

  const applyToActiveRows = useCallback(
    (mutator: (rows: ShopRow[]) => ShopRow[]) => {
      if (viewMode === "app") {
        setAppRows((prev) => mutator(prev));
      } else {
        setWorkdayRows((prev) => mutator(prev));
      }
    },
    [viewMode],
  );

  const updateRow = useCallback(
    (id: string, updater: (row: ShopRow) => ShopRow) => {
      applyToActiveRows((prev) => prev.map((row) => (row.id === id ? updater(row) : row)));
    },
    [applyToActiveRows],
  );

  const hydrateRowsFromRoster = useCallback((roster: AlignmentShop[]) => {
    setAppRows((current) => mergeRowsWithRoster(current, roster));
    setWorkdayRows((current) => mergeRowsWithRoster(current, roster));
  }, []);

  const fallbackRosterMemo = useMemo(() => fallbackRoster, [fallbackRoster]);

  const loadShops = useCallback(async () => {
    try {
      setShopsLoading(true);
      setShopsError(null);
      const response = await fetch("/api/cadence/labor/shops");
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body?.error ?? "Unable to load shops");
      }
      const roster: AlignmentShop[] = Array.isArray(body?.shops)
        ? (body.shops as Array<{ id?: string; shopNumber?: string | number; shopName?: string }>)
            .map((shop) => {
              const store = typeof shop.shopNumber === "number" ? shop.shopNumber.toString() : shop.shopNumber?.trim() ?? "";
              const generatedId =
                typeof crypto !== "undefined" && "randomUUID" in crypto
                  ? crypto.randomUUID()
                  : `shop-${Math.random().toString(36).slice(2, 8)}`;
              const id = shop.id && typeof shop.id === "string" ? shop.id : store ? `shop-${store}` : generatedId;
              const label = shop.shopName?.trim() || (store ? `Shop ${store}` : "Shop");
              return { id, label, store } satisfies AlignmentShop;
            })
        : [];
      if (roster.length) {
        setShopRoster(roster);
        hydrateRowsFromRoster(roster);
      } else if (fallbackRosterMemo.length) {
        setShopRoster(fallbackRosterMemo);
        hydrateRowsFromRoster(fallbackRosterMemo);
      }
    } catch (error) {
      console.error("Labor shops fetch failed", error);
      setShopsError("Unable to load shops for your alignment. Use placeholders as a fallback.");
      if (fallbackRosterMemo.length) {
        setShopRoster(fallbackRosterMemo);
        hydrateRowsFromRoster(fallbackRosterMemo);
      } else {
        hydrateRowsFromRoster([]);
      }
    } finally {
      setShopsLoading(false);
    }
  }, [fallbackRosterMemo, hydrateRowsFromRoster]);

  useEffect(() => {
    loadShops();
  }, [loadShops]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const context = await fetchRetailContext();
        if (cancelled) return;
        if (context) {
          setWeekContext(context);
          if (context.dateLabel) {
            setWeekStart(context.dateLabel);
          }
          return;
        }
      } catch (error) {
        console.error("Retail context load failed", error);
      }
      if (!cancelled) {
        setWeekContext(fallbackRetailContext);
        setWeekStart(fallbackRetailContext.dateLabel);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [fallbackRetailContext]);

  const resetForNewWeek = useCallback(() => {
    setAppRows((current) => current.map((row) => ({ ...row, hours: emptyHours() })));
    setWorkdayRows((current) => current.map((row) => ({ ...row, hours: emptyHours() })));
    setNotes("");
    setStatus(null);
  }, []);

  useEffect(() => {
    if (!weekStart) {
      return;
    }
    if (previousWeekRef.current === weekStart) {
      return;
    }
    previousWeekRef.current = weekStart;
    resetForNewWeek();
  }, [resetForNewWeek, weekStart]);

  useEffect(() => {
    if (!shopRoster.length && fallbackRosterMemo.length) {
      setShopRoster(fallbackRosterMemo);
      hydrateRowsFromRoster(fallbackRosterMemo);
      return;
    }
    if (shopRoster.length) {
      hydrateRowsFromRoster(shopRoster);
    }
  }, [fallbackRosterMemo, hydrateRowsFromRoster, shopRoster]);

  async function saveWeek() {
    setStatus(null);
    if (!weekStart) {
      setStatus({ tone: "error", message: "Select a week start date before saving." });
      return;
    }

    const base = new Date(`${weekStart}T00:00:00`);
    const entries: BulkLaborEntry[] = [];

    activeRows.forEach((row) => {
      const shopId = row.store?.trim() || row.label.trim();
      if (!shopId) {
        return;
      }
      DAYS.forEach((day, offset) => {
        const val = row.hours[day];
        if (val === "" || val == null) return;
        const date = new Date(base);
        date.setDate(base.getDate() + offset);
        entries.push({
          date: date.toISOString().split("T")[0],
          shopId,
          expectedLaborPct: null,
          actualLaborPct: Number(val),
          notes: notes?.trim() ? `${notes.trim()} • ${row.label || row.store}` : `Labor verification (${row.label || row.store})`,
        });
      });
    });

    if (entries.length === 0) {
      setStatus({ tone: "error", message: "Enter at least one hour value before saving." });
      return;
    }

    try {
      setSaving(true);
      const res = await fetch(`/api/cadence/labor/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error ?? "Bulk save failed");
      }
      setStatus({ tone: "success", message: `Saved ${entries.length} ${viewLabel.toLowerCase()} entries.` });
    } catch (error) {
      console.error(error);
      setStatus({ tone: "error", message: error instanceof Error ? error.message : "Failed to save week." });
    } finally {
      setSaving(false);
    }
  }

  const workspaceSection = (
    <section className={`${isEmbedded ? "space-y-6" : "mt-8 space-y-6"} rounded-3xl border border-slate-900/70 bg-slate-950/70 p-6`}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.45em] text-slate-400">Weekly labor entry</p>
          <h2 className="text-2xl font-semibold text-white">Sun–Sat entry grid</h2>
          <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-[0.35em] text-slate-200">
            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-1">
              <CalendarClock className="h-3.5 w-3.5 text-emerald-200" /> {periodWeekLabel || "Retail week"}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-1">
              <Layers className="h-3.5 w-3.5 text-emerald-200" /> {shopsHeadline}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/pocket-manager5/dm-tools/captains/labor"
            className="inline-flex items-center gap-2 rounded-full border border-emerald-400/40 px-4 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-emerald-100 transition hover:border-emerald-300"
          >
            <Link2 className="h-4 w-4" /> Labor Captain
          </Link>
          <button
            type="button"
            onClick={loadShops}
            disabled={shopsLoading}
            className={`inline-flex items-center gap-2 rounded-full border border-slate-700/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.35em] transition ${
              shopsLoading ? "text-slate-500" : "text-slate-300 hover:border-slate-400"
            }`}
          >
            <Sparkles className="h-4 w-4" /> {shopsLoading ? "Syncing…" : "Sync shops"}
          </button>
        </div>
      </div>

      {!isEmbedded ? (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-800/70 bg-slate-900/60 p-4">
            <p className="text-[11px] uppercase tracking-[0.35em] text-slate-400">Week anchor</p>
            <h3 className="mt-1 text-xl font-semibold text-white">{weekStartLabel}</h3>
            <p className="text-xs text-slate-400">{periodWeekLabel || "Retail calendar"}</p>
          </div>
          <div className="rounded-2xl border border-slate-800/70 bg-slate-900/60 p-4">
            <p className="text-[11px] uppercase tracking-[0.35em] text-slate-400">Shops in scope</p>
            <h3 className="mt-1 text-xl font-semibold text-white">{shopsHeadline}</h3>
            <p className={`text-xs ${shopsError ? "text-amber-300" : "text-slate-400"}`}>{shopsDescriptor}</p>
          </div>
          <label className="text-sm md:col-span-3">
            Shared notes
            <input
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Context for this batch (optional)"
              className="mt-1 w-full rounded-2xl border border-slate-800/70 bg-slate-900/60 px-3 py-2 text-white"
            />
          </label>
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-800/70 bg-slate-900/60 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.35em] text-slate-400">View controls</p>
            <h3 className="text-xl font-semibold text-white">{viewLabel}</h3>
            <p className="text-xs text-slate-400">Shading evaluates ±{HOURS_VARIANCE_TOLERANCE} hrs against {comparisonLabel} entries.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(
              [
                { key: "app" as ViewMode, label: "APP reported" },
                { key: "workday" as ViewMode, label: "Workday" },
              ] satisfies Array<{ key: ViewMode; label: string }>
            ).map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setViewMode(option.key)}
                className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.35em] transition ${
                  viewMode === option.key ? "bg-emerald-500 text-slate-950" : "border border-slate-700/70 text-slate-300 hover:border-slate-400"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <EntryGrid rows={activeRows} updateRow={updateRow} totals={totals} comparisonMap={comparisonMap} lockShopIdentity={lockShopIdentity} />

      <footer className="flex flex-col gap-3 border-t border-slate-800/70 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 text-sm text-slate-300">
          <span>
            <strong className="text-white">Totals:</strong> {formatNumber.format(totals.grand)} hrs week-to-date
          </span>
          <span className="text-xs text-slate-500">Totals reflect the active view only. Shaded cells call out ±{HOURS_VARIANCE_TOLERANCE} hr variance vs the other source.</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={saveWeek}
            disabled={saving}
            className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-xs font-semibold uppercase tracking-[0.35em] ${
              saving ? "bg-slate-800/60 text-slate-400" : "bg-emerald-500 text-slate-950"
            }`}
          >
            <ClipboardCheck className="h-4 w-4" /> {saving ? "Saving…" : "Save week"}
          </button>
        </div>
      </footer>
      {status ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            status.tone === "success"
              ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-100"
              : "border-rose-400/40 bg-rose-500/10 text-rose-100"
          }`}
        >
          {status.message}
        </div>
      ) : null}
    </section>
  );

  if (isEmbedded) {
    return workspaceSection;
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <HeroBlock hero={hero} />
      {workspaceSection}
    </main>
  );
}

type EntryGridProps = {
  rows: ShopRow[];
  updateRow: (id: string, updater: (row: ShopRow) => ShopRow) => void;
  totals: { perDay: Record<Day, number>; grand: number };
  comparisonMap: Map<string, ShopRow>;
  lockShopIdentity?: boolean;
};

function EntryGrid({ rows, updateRow, totals, comparisonMap, lockShopIdentity = false }: EntryGridProps) {
  const tableRef = useRef<HTMLTableElement | null>(null);

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") {
      return;
    }
    const table = tableRef.current ?? event.currentTarget.closest("table");
    if (!table) {
      return;
    }
    const current = event.currentTarget as HTMLInputElement;
    const column = current.dataset.gridCol;
    const rowValue = current.dataset.gridRow;
    if (column && rowValue != null) {
      event.preventDefault();
      const columnInputs = Array.from(table.querySelectorAll<HTMLInputElement>(`input[data-grid-col="${column}"]`)).sort(
        (a, b) => Number(a.dataset.gridRow ?? 0) - Number(b.dataset.gridRow ?? 0),
      );
      const currentIndex = columnInputs.indexOf(current);
      if (currentIndex !== -1) {
        const offset = event.shiftKey ? -1 : 1;
        const target = columnInputs[currentIndex + offset];
        if (target) {
          target.focus();
          target.select?.();
          target.scrollIntoView({ behavior: "smooth", block: "center" });
          return;
        }
      }
    }

    event.preventDefault();
    const inputs = Array.from(table.querySelectorAll<HTMLInputElement>('input[data-grid-cell="labor"]'));
    const index = inputs.indexOf(current);
    if (index === -1) {
      return;
    }
    const offset = event.shiftKey ? -1 : 1;
    const fallbackTarget = inputs[index + offset];
    if (fallbackTarget) {
      fallbackTarget.focus();
      fallbackTarget.select?.();
      fallbackTarget.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, []);

  function rowTotal(row: ShopRow) {
    return DAYS.reduce((sum, day) => sum + (row.hours[day] === "" || row.hours[day] == null ? 0 : Number(row.hours[day])), 0);
  }

  const parseHours = (value: number | "" | undefined): number | null => {
    if (value === "" || value == null) {
      return null;
    }
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const deltaForCell = (row: ShopRow, day: Day): number | null => {
    const comparisonRow = comparisonMap.get(rowComparisonKey(row));
    if (!comparisonRow) {
      return null;
    }
    const base = parseHours(row.hours[day]);
    const other = parseHours(comparisonRow.hours[day]);
    if (base == null || other == null) {
      return null;
    }
    const delta = Number((base - other).toFixed(2));
    return Number.isFinite(delta) ? delta : null;
  };

  const cellTone = (delta: number | null) => {
    if (delta == null) {
      return "border-slate-800/70 bg-slate-950/60";
    }
    if (Math.abs(delta) >= HOURS_VARIANCE_TOLERANCE) {
      return "border-rose-500/40 bg-rose-500/10";
    }
    return "border-emerald-500/30 bg-emerald-500/10";
  };

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-2xl border border-white/5 bg-slate-950/80 shadow-inner">
        <table ref={tableRef} className="min-w-full border-collapse text-xs">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-[0.35em] text-slate-400">
              <th className="p-2">Shop</th>
              <th className="p-2">Store #</th>
              {DAYS.map((day) => (
                <th key={day} className="p-2 text-center">
                  {day.slice(0, 3)}
                </th>
              ))}
              <th className="p-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={row.id} className="border-t border-slate-900/70">
                <td className="p-2">
                  <input
                    data-grid-cell="labor"
                    data-grid-col="label"
                    data-grid-row={rowIndex}
                    aria-label={`Label for row ${rowIndex + 1}`}
                    placeholder="Label"
                    value={row.label}
                    onChange={(event) => updateRow(row.id, (curr) => ({ ...curr, label: event.target.value }))}
                    onKeyDown={handleKeyDown}
                    readOnly={lockShopIdentity}
                    className={`w-full rounded-lg border px-2 py-1 text-white ${lockShopIdentity ? "border-slate-800/60 bg-slate-900/40" : "border-slate-800/70 bg-slate-900/60"}`}
                  />
                </td>
                <td className="p-2">
                  <input
                    data-grid-cell="labor"
                    data-grid-col="store"
                    data-grid-row={rowIndex}
                    aria-label={`Store for row ${rowIndex + 1}`}
                    placeholder="Shop #"
                    value={row.store ?? ""}
                    onChange={(event) => updateRow(row.id, (curr) => ({ ...curr, store: event.target.value }))}
                    onKeyDown={handleKeyDown}
                    readOnly={lockShopIdentity}
                    className={`w-full rounded-lg border px-2 py-1 text-white ${lockShopIdentity ? "border-slate-800/60 bg-slate-900/40" : "border-slate-800/70 bg-slate-900/60"}`}
                  />
                </td>
                {DAYS.map((day) => {
                  const delta = deltaForCell(row, day);
                  const tone = cellTone(delta);
                  return (
                    <td key={day} className="p-1 align-top">
                      <input
                        data-grid-cell="labor"
                        data-grid-col={day}
                        data-grid-row={rowIndex}
                        type="number"
                        min="0"
                        step="0.25"
                        aria-label={`${day} hours for row ${rowIndex + 1}`}
                        value={row.hours[day] ?? ""}
                        onChange={(event) =>
                          updateRow(row.id, (curr) => ({
                            ...curr,
                            hours: { ...curr.hours, [day]: event.target.value === "" ? "" : Number(event.target.value) },
                          }))
                        }
                        onKeyDown={handleKeyDown}
                        className={`w-full appearance-none rounded-lg border px-2 py-1 text-white transition ${tone} lab-moz-textfield`}
                      />
                      <style>{`.lab-moz-textfield::-moz-focus-inner { border: 0; } .lab-moz-textfield { -moz-appearance: textfield; }`}</style>
                    </td>
                  );
                })}
                <td className="p-2 text-right text-white">{formatNumber.format(rowTotal(row))}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-900/70 text-white">
              <td className="p-2 font-semibold">Totals</td>
              <td className="p-2 text-slate-500">—</td>
              {DAYS.map((day) => (
                <td key={day} className="p-2 text-center font-semibold">
                  {formatNumber.format(totals.perDay[day])}
                </td>
              ))}
              <td className="p-2 text-right font-semibold">
                {formatNumber.format(totals.grand)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

type HeroBlockProps = {
  hero: {
    eyebrow: string;
    title: string;
    description: string;
  };
};

function HeroBlock({ hero }: HeroBlockProps) {
  return (
    <section className="rounded-3xl border border-slate-900/70 bg-gradient-to-br from-slate-950 via-slate-950/80 to-slate-900/40 p-6 shadow-[0_30px_90px_rgba(0,0,0,0.45)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.5em] text-emerald-200">{hero.eyebrow}</p>
          <h1 className="mt-2 text-3xl font-semibold text-white lg:text-4xl">{hero.title}</h1>
          <p className="mt-2 text-sm text-slate-300">{hero.description}</p>
          <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-300">
            <Badge icon={CalendarClock} label="Sun–Sat grid" />
            <Badge icon={Layers} label="Shops stacked" />
            <Badge icon={SplitSquareHorizontal} label="Dual APP & Workday" />
          </div>
        </div>
        <div className="grid gap-3 rounded-2xl border border-white/5 bg-slate-950/60 p-4 text-sm text-slate-300">
          <div className="flex items-center gap-2 text-emerald-200">
            <ClipboardCheck className="h-4 w-4" /> Linked to Cadence task
          </div>
          <p className="text-xs text-slate-500">This same workspace powers the DM Tools Daily Labor Portal and the Labor Verification task pill.</p>
          <Link
            href="/pocket-manager5/features/cadence"
            className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-200"
          >
            Open Cadence →
          </Link>
        </div>
      </div>
    </section>
  );
}

type BadgeProps = {
  icon: ComponentType<{ className?: string }>;
  label: string;
};

function Badge({ icon: Icon, label }: BadgeProps) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-200">
      <Icon className="h-3.5 w-3.5 text-emerald-200" />
      {label}
    </span>
  );
}

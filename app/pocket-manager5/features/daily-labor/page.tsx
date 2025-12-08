"use client";

import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import Link from "next/link";
import { Building2, ClipboardCheck, Home, Target, X } from "lucide-react";
import LaborEntryWorkspace from "../labor/LaborEntryWorkspace";

type ScopeValue = "daily" | "wtd";

type RegionDistrictRow = {
  district: string;
  cars: number;
  lhc: number;
  allowedHours: number;
  actualHours: number;
  highlight?: boolean;
};

type RegionStoreRow = {
  district: string;
  store: number;
  cars: number;
  lhc: number;
  allowedHours: number;
  adjustedHours: number;
  actualHours: number;
};

type RosterShop = {
  id: string;
  shopNumber: string;
  shopName: string;
  districtName: string | null;
  regionName: string | null;
};

type CreditNote = {
  id: string;
  type: "pto" | "vacancy";
  shopLabel: string;
  shopId?: string | null;
  shopNumber?: string | null;
  day?: Day;
  hours: number;
};

type CreditRowState = {
  district: string;
  variance: number;
  ptoDays: number;
  vacantShops: number;
  creditHours: number;
  notes: CreditNote[];
};

type PlannerCellSummary = {
  total: number;
  entries: Array<{ id: string; label: string; hours: number }>;
};

type ToastPayload = {
  title: string;
  detail: string;
  delta: number;
};

type Day = (typeof WEEK_DAYS)[number];
type DayRecord = Record<Day, number>;

const REGION_DISTRICT_SUMMARY: RegionDistrictRow[] = [
  { district: "Baton Rouge North", cars: 144, lhc: 0.79, allowedHours: 113.76, actualHours: 166.01 },
  { district: "Baton Rouge South", cars: 193, lhc: 0.79, allowedHours: 152.47, actualHours: 198.7 },
  { district: "Gulf Coast North", cars: 305, lhc: 0.79, allowedHours: 240.95, actualHours: 265 },
  { district: "Lafayette", cars: 228, lhc: 0.79, allowedHours: 180.12, actualHours: 220.53 },
  { district: "Gulf Coast West", cars: 206, lhc: 0.79, allowedHours: 162.74, actualHours: 188.84 },
  { district: "Nola North", cars: 404, lhc: 0.79, allowedHours: 319.16, actualHours: 340.28 },
  { district: "Nola South", cars: 334, lhc: 0.79, allowedHours: 263.86, actualHours: 314.3 },
  { district: "Region", cars: 1814, lhc: 0.79, allowedHours: 1433.06, actualHours: 1693.66, highlight: true },
];

const REGION_STORE_DETAIL: RegionStoreRow[] = [
  { district: "Baton Rouge South", store: 18, cars: 36, lhc: 0.79, allowedHours: 28.44, adjustedHours: 28.44, actualHours: 35.38 },
  { district: "Baton Rouge South", store: 19, cars: 27, lhc: 0.79, allowedHours: 21.33, adjustedHours: 25.3, actualHours: 41 },
  { district: "Baton Rouge South", store: 282, cars: 19, lhc: 0.79, allowedHours: 15.01, adjustedHours: 25.3, actualHours: 8.47 },
  { district: "Baton Rouge South", store: 447, cars: 29, lhc: 0.79, allowedHours: 22.91, adjustedHours: 25.3, actualHours: 29.19 },
  { district: "Baton Rouge South", store: 448, cars: 47, lhc: 0.79, allowedHours: 37.13, adjustedHours: 37.13, actualHours: 35.44 },
  { district: "Baton Rouge South", store: 531, cars: 13, lhc: 0.79, allowedHours: 10.23, adjustedHours: 25.3, actualHours: 30.19 },
  { district: "Baton Rouge South", store: 832, cars: 23, lhc: 0.79, allowedHours: 18.17, adjustedHours: 25.3, actualHours: 19.03 },
];

const FALLBACK_ENTRY_ROSTER = REGION_STORE_DETAIL.map((row) => ({
  id: `fallback-${row.store}`,
  label: `Shop ${row.store}`,
  store: row.store.toString(),
}));

const MIN_HOURS_KEY = [
  { day: "Sunday", hours: 20 },
  { day: "Monday", hours: 45.3 },
  { day: "Tuesday", hours: 70.6 },
  { day: "Wednesday", hours: 95.93 },
  { day: "Thursday", hours: 121.23 },
  { day: "Friday", hours: 146.53 },
  { day: "Saturday", hours: 171.8 },
];

const MIN_HOURS_TOTAL = MIN_HOURS_KEY.reduce((sum, entry) => sum + entry.hours, 0);

const WEEK_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
const PTO_HOURS_PER_DAY = 8;
const VACANT_SHOP_CREDIT = 40;

const DAILY_SPLIT: DayRecord = {
  Sunday: 0.13,
  Monday: 0.14,
  Tuesday: 0.15,
  Wednesday: 0.15,
  Thursday: 0.15,
  Friday: 0.14,
  Saturday: 0.14,
};

const hoursFormatter = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const integerFormatter = new Intl.NumberFormat("en-US");

const createDayRecord = (fill = 0): DayRecord =>
  WEEK_DAYS.reduce((acc, day) => {
    acc[day] = fill;
    return acc;
  }, {} as DayRecord);

const createPlannerSummaryRow = (): Record<Day, PlannerCellSummary> =>
  WEEK_DAYS.reduce((acc, day) => {
    acc[day] = { total: 0, entries: [] };
    return acc;
  }, {} as Record<Day, PlannerCellSummary>);

const distributeHours = (total: number): DayRecord => {
  const record = createDayRecord();
  let remainder = total;
  WEEK_DAYS.forEach((day, index) => {
    const value = index === WEEK_DAYS.length - 1 ? remainder : Number((total * DAILY_SPLIT[day]).toFixed(2));
    record[day] = value;
    remainder = Number((remainder - value).toFixed(2));
  });
  return record;
};

const createInitialCreditRows = (): CreditRowState[] =>
  REGION_DISTRICT_SUMMARY.filter((row) => !row.highlight).map((row) => ({
    district: row.district,
    variance: row.actualHours - row.allowedHours,
    ptoDays: 0,
    vacantShops: 0,
    creditHours: 0,
    notes: [],
  }));

export default function DailyLaborLanding() {
  const [districtScope, setDistrictScope] = useState<ScopeValue>("daily");
  const [districtClassic, setDistrictClassic] = useState(false);
  const [storeScope, setStoreScope] = useState<ScopeValue>("daily");
  const [storeClassic, setStoreClassic] = useState(false);
  const [creditRows, setCreditRows] = useState<CreditRowState[]>(() => createInitialCreditRows());
  const [entryOpen, setEntryOpen] = useState(false);
  const openEntry = useCallback(() => setEntryOpen(true), []);
  const closeEntry = useCallback(() => setEntryOpen(false), []);

  useEffect(() => {
    if (!entryOpen) {
      return;
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeEntry();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [entryOpen, closeEntry]);

  return (
    <div className="space-y-10">
      <Link
        href="/pocket-manager5"
        className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-slate-200 transition hover:border-emerald-400/50 hover:text-white"
      >
        <Home className="h-4 w-4 text-emerald-300" /> Return home
      </Link>
      <section className="rounded-3xl border border-slate-900/70 bg-slate-950/80 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.5em] text-slate-400">Daily Labor</p>
            <h2 className="text-2xl font-semibold text-white">Variance & credit controls</h2>
            <p className="mt-1 text-sm text-slate-300">Moved from the Captain workspace so the same cards can be reviewed outside the DM tooling view.</p>
          </div>
          <button
            type="button"
            onClick={openEntry}
            className="rounded-full border border-emerald-400/40 px-4 py-1 text-xs font-semibold uppercase tracking-[0.4em] text-emerald-100 transition hover:border-emerald-300 hover:text-white"
          >
            Daily Labor
          </button>
        </div>
        <div className="mt-6 grid gap-6 xl:grid-cols-[2fr_1fr]">
          <div className="space-y-6">
            <RegionDistrictTable
              scope={districtScope}
              onScopeChange={setDistrictScope}
              classicView={districtClassic}
              onClassicToggle={() => setDistrictClassic((prev) => !prev)}
              creditRows={creditRows}
            />
            <StoreDetailTable
              scope={storeScope}
              onScopeChange={setStoreScope}
              classicView={storeClassic}
              onClassicToggle={() => setStoreClassic((prev) => !prev)}
              creditRows={creditRows}
            />
          </div>
          <div className="space-y-6">
            <VarianceCreditGrid rows={creditRows} onRowsChange={setCreditRows} />
            <MinHoursCard />
          </div>
        </div>
      </section>
      {entryOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur" role="dialog" aria-modal="true">
          <div className="absolute inset-0" onClick={closeEntry} aria-hidden="true" />
          <div className="relative z-10 w-full max-w-6xl max-h-[90vh] overflow-y-auto rounded-[32px] border border-white/10 bg-slate-950/95 p-4 shadow-[0_40px_90px_rgba(0,0,0,0.8)]">
            <div className="mb-4 flex items-center justify-between gap-3 text-sm text-slate-300">
              <p className="text-[10px] uppercase tracking-[0.35em] text-slate-500">Daily labor entry workspace</p>
              <button
                type="button"
                onClick={closeEntry}
                className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.35em] text-slate-200 transition hover:border-emerald-400/60 hover:text-white"
              >
                Exit
                <X className="h-4 w-4" />
              </button>
            </div>
            <LaborEntryWorkspace origin="dm-tools" variant="embedded" fallbackRoster={FALLBACK_ENTRY_ROSTER} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function RegionDistrictTable({ scope, onScopeChange, classicView, onClassicToggle, creditRows }: { scope: ScopeValue; onScopeChange: (value: ScopeValue) => void; classicView: boolean; onClassicToggle: () => void; creditRows: CreditRowState[] }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-slate-950/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-white">District variance snapshot</h3>
          <p className="text-xs text-slate-400">Cars, LHC, allowed vs actual hours. Variance signals flip colors automatically.</p>
        </div>
        <div className="flex items-center gap-3">
          <ScopeToggle label="District scope" value={scope} onChange={onScopeChange} />
          <ClassicToggle value={classicView} onToggle={onClassicToggle} />
          <ClipboardCheck className="h-5 w-5 text-emerald-200" />
        </div>
      </div>
      {classicView ? <ClassicDistrictTable creditRows={creditRows} /> : <ModernDistrictTable />}
    </div>
  );
}

function ModernDistrictTable() {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-[0.3em] text-slate-400">
            <th className="py-2 pr-4">District</th>
            <th className="py-2 pr-4">Cars</th>
            <th className="py-2 pr-4">LHC</th>
            <th className="py-2 pr-4">Allowed Hours</th>
            <th className="py-2 pr-4">Actual Hours</th>
            <th className="py-2">Hours Variance</th>
          </tr>
        </thead>
        <tbody>
          {REGION_DISTRICT_SUMMARY.map((row) => {
            const variance = row.actualHours - row.allowedHours;
            return (
              <tr key={row.district} className={`border-t border-slate-800/60 ${row.highlight ? "bg-slate-900/70" : ""}`}>
                <td className="py-2 pr-4 font-semibold text-white">{row.district}</td>
                <td className="py-2 pr-4">{integerFormatter.format(row.cars)}</td>
                <td className="py-2 pr-4">{row.lhc.toFixed(2)}</td>
                <td className="py-2 pr-4">{hoursFormatter.format(row.allowedHours)}</td>
                <td className="py-2 pr-4">{hoursFormatter.format(row.actualHours)}</td>
                <td className="py-2">
                  <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${varianceTone(variance)}`}>
                    {variance > 0 ? "+" : ""}
                    {hoursFormatter.format(variance)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ClassicDistrictTable({ creditRows }: { creditRows: CreditRowState[] }) {
  const adjustments = useMemo(() => {
    const map = new Map<string, { hours: DayRecord; labels: Record<Day, string[]> }>();
    creditRows.forEach((row) => {
      const hours = createDayRecord();
      const labels = WEEK_DAYS.reduce((acc, day) => {
        acc[day] = [] as string[];
        return acc;
      }, {} as Record<Day, string[]>);
      row.notes.forEach((note) => {
        const day = note.day ?? WEEK_DAYS[0];
        hours[day] += note.hours;
        const descriptor = note.type === "pto" ? `${note.shopLabel} PTO` : `${note.shopLabel} vacancy`;
        labels[day].push(descriptor);
      });
      map.set(row.district, { hours, labels });
    });
    return map;
  }, [creditRows]);

  return (
    <div className="mt-4 overflow-x-auto">
      <table className="min-w-full border border-slate-900 text-[13px]">
        <thead className="bg-slate-950/70 text-[11px] uppercase tracking-[0.3em] text-slate-400">
          <tr>
            <th className="border-b border-slate-900 px-3 py-3 text-left">District</th>
            {WEEK_DAYS.map((day) => (
              <th key={day} className="border-b border-slate-900 px-3 py-3 text-center">
                {day.slice(0, 3)}
              </th>
            ))}
            <th className="border-b border-slate-900 px-3 py-3 text-center">WTD</th>
          </tr>
        </thead>
        <tbody>
          {REGION_DISTRICT_SUMMARY.filter((row) => !row.highlight).map((row) => {
            const allowed = distributeHours(row.allowedHours);
            const actual = distributeHours(row.actualHours);
            const adjEntry = adjustments.get(row.district);
            const weeklyCredit = WEEK_DAYS.reduce((sum, day) => sum + (adjEntry?.hours[day] ?? 0), 0);
            const netWeekly = row.actualHours - weeklyCredit;
            return (
              <tr key={row.district} className="border-t border-slate-900">
                <td className="whitespace-nowrap px-3 py-3 font-semibold text-white">{row.district}</td>
                {WEEK_DAYS.map((day) => {
                  const credit = adjEntry?.hours[day] ?? 0;
                  const tags = adjEntry?.labels[day] ?? [];
                  const net = actual[day] - credit;
                  return (
                    <td key={day} className="px-3 py-3 align-top text-center text-slate-100">
                      <div className="font-mono text-sm">{hoursFormatter.format(net)}</div>
                      <div className="text-[10px] text-slate-500">Base {hoursFormatter.format(actual[day])}</div>
                      <div className="text-[10px] text-slate-500">Allowed {hoursFormatter.format(allowed[day])}</div>
                      {credit ? <div className="text-[10px] text-emerald-300">- {hoursFormatter.format(credit)} credit</div> : null}
                      {tags.length ? <div className="text-[10px] text-slate-400">{tags.slice(-2).join(", ")}</div> : null}
                    </td>
                  );
                })}
                <td className="px-3 py-3 align-top text-center text-slate-100">
                  <div className="font-mono text-sm">{hoursFormatter.format(netWeekly)}</div>
                  <div className="text-[10px] text-slate-500">Base {hoursFormatter.format(row.actualHours)}</div>
                  <div className="text-[10px] text-slate-500">Allowed {hoursFormatter.format(row.allowedHours)}</div>
                  {weeklyCredit ? <div className="text-[10px] text-emerald-300">- {hoursFormatter.format(weeklyCredit)} credit</div> : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function StoreDetailTable({ scope, onScopeChange, classicView, onClassicToggle, creditRows }: { scope: ScopeValue; onScopeChange: (value: ScopeValue) => void; classicView: boolean; onClassicToggle: () => void; creditRows: CreditRowState[] }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-slate-950/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-white">Store drill-down</h3>
          <p className="text-xs text-slate-400">Baton Rouge South sample rows using editable cars + hours columns.</p>
        </div>
        <div className="flex items-center gap-3">
          <ScopeToggle label="Store scope" value={scope} onChange={onScopeChange} />
          <ClassicToggle value={classicView} onToggle={onClassicToggle} />
          <Building2 className="h-5 w-5 text-emerald-200" />
        </div>
      </div>
      {classicView ? <ClassicStoreTable creditRows={creditRows} /> : <ModernStoreTable />}
    </div>
  );
}

function ModernStoreTable() {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-[0.25em] text-slate-400">
            <th className="py-2 pr-4">District</th>
            <th className="py-2 pr-4">Store</th>
            <th className="py-2 pr-4">Cars WTD (edit)</th>
            <th className="py-2 pr-4">LHC</th>
            <th className="py-2 pr-4">Allowed Hours</th>
            <th className="py-2 pr-4">Adj Allowed Hrs</th>
            <th className="py-2 pr-4">Actual Hours (edit)</th>
            <th className="py-2">Hours Variance</th>
          </tr>
        </thead>
        <tbody>
          {REGION_STORE_DETAIL.map((row) => {
            const variance = row.actualHours - row.adjustedHours;
            return (
              <tr key={row.store} className="border-t border-slate-800/60">
                <td className="py-2 pr-4 font-semibold text-white">{row.district}</td>
                <td className="py-2 pr-4">{row.store}</td>
                <td className="py-2 pr-4">{row.cars}</td>
                <td className="py-2 pr-4">{row.lhc.toFixed(2)}</td>
                <td className="py-2 pr-4">{hoursFormatter.format(row.allowedHours)}</td>
                <td className="py-2 pr-4">{hoursFormatter.format(row.adjustedHours)}</td>
                <td className="py-2 pr-4">{hoursFormatter.format(row.actualHours)}</td>
                <td className="py-2">
                  <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${varianceTone(variance)}`}>
                    {variance > 0 ? "+" : ""}
                    {hoursFormatter.format(variance)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ClassicStoreTable({ creditRows }: { creditRows: CreditRowState[] }) {
  const adjustments = useMemo(() => {
    const map = new Map<string, { hours: DayRecord; labels: Record<Day, string[]> }>();
    creditRows.forEach((row) => {
      row.notes.forEach((note) => {
        const storeKey = note.shopNumber ? String(note.shopNumber) : note.shopLabel ?? row.district;
        if (!storeKey) return;
        if (!map.has(storeKey)) {
          map.set(storeKey, {
            hours: createDayRecord(),
            labels: WEEK_DAYS.reduce((acc, day) => {
              acc[day] = [];
              return acc;
            }, {} as Record<Day, string[]>),
          });
        }
        const bucket = map.get(storeKey)!;
        const day = note.day ?? WEEK_DAYS[0];
        bucket.hours[day] += note.hours;
        bucket.labels[day].push(note.type === "pto" ? `${note.shopLabel} PTO` : `${note.shopLabel} vacancy`);
      });
    });
    return map;
  }, [creditRows]);

  return (
    <div className="mt-4 overflow-x-auto">
      <table className="min-w-full border border-slate-900 text-[13px]">
        <thead className="bg-slate-950/70 text-[11px] uppercase tracking-[0.3em] text-slate-400">
          <tr>
            <th className="border-b border-slate-900 px-3 py-3 text-left">District</th>
            <th className="border-b border-slate-900 px-3 py-3 text-left">Shop</th>
            {WEEK_DAYS.map((day) => (
              <th key={day} className="border-b border-slate-900 px-3 py-3 text-center">
                {day.slice(0, 3)}
              </th>
            ))}
            <th className="border-b border-slate-900 px-3 py-3 text-center">WTD</th>
          </tr>
        </thead>
        <tbody>
          {REGION_STORE_DETAIL.map((row) => {
            const allowed = distributeHours(row.allowedHours);
            const actual = distributeHours(row.actualHours);
            const adjEntry = adjustments.get(String(row.store));
            const weeklyCredit = adjEntry ? WEEK_DAYS.reduce((sum, day) => sum + adjEntry.hours[day], 0) : 0;
            const netWeekly = row.actualHours - weeklyCredit;
            return (
              <tr key={`classic-${row.store}`} className="border-t border-slate-900">
                <td className="px-3 py-3 font-semibold text-white">{row.district}</td>
                <td className="px-3 py-3 text-slate-200">{row.store}</td>
                {WEEK_DAYS.map((day) => {
                  const credit = adjEntry?.hours[day] ?? 0;
                  const labels = adjEntry?.labels[day] ?? [];
                  const net = actual[day] - credit;
                  return (
                    <td key={`${row.store}-${day}`} className="px-3 py-3 align-top text-center text-slate-100">
                      <div className="font-mono text-sm">{hoursFormatter.format(net)}</div>
                      <div className="text-[10px] text-slate-500">Base {hoursFormatter.format(actual[day])}</div>
                      <div className="text-[10px] text-slate-500">Allowed {hoursFormatter.format(allowed[day])}</div>
                      {credit ? <div className="text-[10px] text-emerald-300">- {hoursFormatter.format(credit)} credit</div> : null}
                      {labels.length ? <div className="text-[10px] text-slate-400">{labels.slice(-2).join(", ")}</div> : null}
                    </td>
                  );
                })}
                <td className="px-3 py-3 align-top text-center text-slate-100">
                  <div className="font-mono text-sm">{hoursFormatter.format(netWeekly)}</div>
                  <div className="text-[10px] text-slate-500">Base {hoursFormatter.format(row.actualHours)}</div>
                  <div className="text-[10px] text-slate-500">Allowed {hoursFormatter.format(row.allowedHours)}</div>
                  {weeklyCredit ? <div className="text-[10px] text-emerald-300">- {hoursFormatter.format(weeklyCredit)} credit</div> : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function VarianceCreditGrid({ rows, onRowsChange }: { rows: CreditRowState[]; onRowsChange: Dispatch<SetStateAction<CreditRowState[]>> }) {
  const [roster, setRoster] = useState<Record<string, RosterShop[]>>({});
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<ToastPayload | null>(null);
  const [formMode, setFormMode] = useState<"pto" | "vacancy" | null>(null);
  const [cellEditor, setCellEditor] = useState<{ district: string; days: Day[] } | null>(null);
  const [selectedShopIds, setSelectedShopIds] = useState<string[]>([]);
  const [ptoDaysInput, setPtoDaysInput] = useState(1);
  const [plannerError, setPlannerError] = useState<string | null>(null);

  const fallbackShops = useMemo(() => {
    const map: Record<string, RosterShop[]> = {};
    REGION_STORE_DETAIL.forEach((row) => {
      const record: RosterShop = {
        id: `sample-${row.store}`,
        shopNumber: row.store.toString(),
        shopName: `Shop ${row.store}`,
        districtName: row.district,
        regionName: null,
      };
      map[row.district] = [...(map[row.district] ?? []), record];
    });
    return map;
  }, []);

  const resolveShops = useCallback(
    (district: string) => {
      return roster[district] ?? fallbackShops[district] ?? [];
    },
    [roster, fallbackShops],
  );

  const shopIndex = useMemo(() => {
    const map: Record<string, RosterShop> = {};
    Object.values(fallbackShops).forEach((shops) => {
      shops.forEach((shop) => {
        map[shop.id] = shop;
      });
    });
    Object.values(roster).forEach((shops) => {
      shops.forEach((shop) => {
        map[shop.id] = shop;
      });
    });
    return map;
  }, [fallbackShops, roster]);

  const allShopOptions = useMemo(() => {
    const labels = new Map<string, string>();
    Object.entries(fallbackShops).forEach(([district, shops]) => {
      shops.forEach((shop) => {
        const label = `${shop.shopName} (${shop.shopNumber}) • ${district}`;
        labels.set(shop.id, label);
      });
    });
    Object.entries(roster).forEach(([district, shops]) => {
      shops.forEach((shop) => {
        const label = `${shop.shopName} (${shop.shopNumber}) • ${district}`;
        labels.set(shop.id, label);
      });
    });
    return Array.from(labels.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [fallbackShops, roster]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    if (toast) {
      timer = setTimeout(() => setToast(null), 4000);
    }
    return () => {
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [toast]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/cadence/labor/shops");
        const body: unknown = await response.json().catch(() => ({}));
        if (!response.ok) {
          console.error("labor shops roster fetch failed", body);
          return;
        }
        const payload = (typeof body === "object" && body !== null ? (body as { shops?: Array<Record<string, unknown>> }) : { shops: [] });
        const rosterMap: Record<string, RosterShop[]> = {};
        (payload.shops ?? []).forEach((shopRecord) => {
          const district = (shopRecord["districtName"] as string | null) ?? "Unassigned";
          const rawNumber = shopRecord["shopNumber"];
          const shopNumber = rawNumber == null || rawNumber === "" ? "" : String(rawNumber);
          const normalized: RosterShop = {
            id: (shopRecord["id"] as string | null) ?? crypto.randomUUID(),
            shopNumber: shopNumber || district,
            shopName: (shopRecord["shopName"] as string | null) ?? (shopNumber ? `Shop ${shopNumber}` : "Shop"),
            districtName: district,
            regionName: (shopRecord["regionName"] as string | null) ?? null,
          };
          rosterMap[district] = [...(rosterMap[district] ?? []), normalized];
        });
        if (!cancelled) {
          setRoster(rosterMap);
        }
      } catch (err) {
        console.error("labor shops roster request failed", err);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!formMode) {
      setCellEditor(null);
      setSelectedShopIds([]);
      setPlannerError(null);
      setPtoDaysInput(1);
      return;
    }
    if (!cellEditor && rows.length) {
      const defaultDistrict = rows[0].district;
      const defaultDay = WEEK_DAYS[0];
      setCellEditor({ district: defaultDistrict, days: [defaultDay] });
      const fallbackShop = resolveShops(defaultDistrict)[0];
      if (fallbackShop) {
        setSelectedShopIds([fallbackShop.id]);
      }
    }
  }, [formMode, cellEditor, resolveShops, rows]);

  const selectedShops = useMemo(() => {
    const uniqueIds = Array.from(new Set(selectedShopIds));
    return uniqueIds
      .map((id) => shopIndex[id])
      .filter((shop): shop is RosterShop => Boolean(shop));
  }, [selectedShopIds, shopIndex]);

  const plannerGrid = useMemo(() => {
    if (!formMode) {
      return null;
    }
    const map: Record<string, Record<Day, PlannerCellSummary>> = {};
    rows.forEach((row) => {
      row.notes.forEach((note) => {
        if (note.type !== formMode || !note.day) {
          return;
        }
        if (!map[row.district]) {
          map[row.district] = createPlannerSummaryRow();
        }
        const bucket = map[row.district][note.day];
        bucket.total += note.hours;
        bucket.entries.push({ id: note.id, label: note.shopLabel, hours: note.hours });
      });
    });
    return map;
  }, [rows, formMode]);

  const noteList = useMemo(() => rows.flatMap((row) => row.notes), [rows]);

  const updateRow = (district: string, apply: (row: CreditRowState) => CreditRowState) => {
    onRowsChange((current) => current.map((row) => (row.district === district ? apply(row) : row)));
  };

  const openCellFor = (district: string, day: Day, append = false) => {
    if (!formMode) {
      return;
    }
    setPlannerError(null);
    setCellEditor((current) => {
      if (append && current && current.district === district) {
        if (current.days.includes(day)) {
          return current;
        }
        return { district, days: [...current.days, day] };
      }
      return { district, days: [day] };
    });
    if (!selectedShopIds.length) {
      const firstShop = resolveShops(district)[0];
      if (firstShop) {
        setSelectedShopIds([firstShop.id]);
      }
    }
  };

  const toggleDaySelection = (day: Day) => {
    setPlannerError(null);
    setCellEditor((current) => {
      if (!current) {
        const fallbackDistrict = rows[0]?.district;
        return fallbackDistrict ? { district: fallbackDistrict, days: [day] } : null;
      }
      const hasDay = current.days.includes(day);
      if (hasDay) {
        if (current.days.length === 1) {
          return current;
        }
        return { ...current, days: current.days.filter((value) => value !== day) };
      }
      return { ...current, days: [...current.days, day] };
    });
  };

  const describeDays = (days: Day[]) => {
    if (!days.length) {
      return "";
    }
    if (days.length <= 2) {
      return days.map((day) => day.slice(0, 3)).join(", ");
    }
    return `${days[0].slice(0, 3)} +${days.length - 1}`;
  };

  const handlePlannerSubmit = () => {
    if (!formMode) {
      setPlannerError("Choose PTO or Vacancy to start.");
      return;
    }
    if (!cellEditor) {
      setPlannerError("Select a district & day cell first.");
      return;
    }
    if (!selectedShops.length) {
      setPlannerError("Select at least one shop to credit.");
      return;
    }
    const selectedDays = cellEditor.days;
    if (!selectedDays.length) {
      setPlannerError("Select at least one day.");
      return;
    }

    const patches: Record<string, { ptoDays: number; vacantShops: number; creditHours: number; notes: CreditNote[] }> = {};
    const ensurePatch = (district: string) => {
      if (!patches[district]) {
        patches[district] = { ptoDays: 0, vacantShops: 0, creditHours: 0, notes: [] };
      }
      return patches[district];
    };

    if (formMode === "pto") {
      if (!Number.isFinite(ptoDaysInput) || ptoDaysInput <= 0) {
        setPlannerError("Enter PTO days greater than zero.");
        return;
      }
      const quantity = Number(ptoDaysInput);
      const hours = quantity * PTO_HOURS_PER_DAY;
      selectedDays.forEach((day) => {
        selectedShops.forEach((shop) => {
          const targetDistrict = shop.districtName ?? cellEditor.district;
          if (!targetDistrict) {
            return;
          }
          const patch = ensurePatch(targetDistrict);
          patch.ptoDays += quantity;
          patch.creditHours += hours;
          patch.notes.push({
            id: crypto.randomUUID(),
            type: "pto",
            shopLabel: shop.shopName ?? shop.shopNumber ?? "Shop",
            shopId: shop.id,
            shopNumber: shop.shopNumber,
            day,
            hours,
          });
        });
      });
    } else {
      selectedDays.forEach((day) => {
        selectedShops.forEach((shop) => {
          const targetDistrict = shop.districtName ?? cellEditor.district;
          if (!targetDistrict) {
            return;
          }
          const hours = VACANT_SHOP_CREDIT;
          const patch = ensurePatch(targetDistrict);
          patch.vacantShops += 1;
          patch.creditHours += hours;
          patch.notes.push({
            id: crypto.randomUUID(),
            type: "vacancy",
            shopLabel: shop.shopName ?? shop.shopNumber ?? "Vacancy",
            shopId: shop.id,
            shopNumber: shop.shopNumber,
            day,
            hours,
          });
        });
      });
    }

    const affectedDistricts = Object.keys(patches);
    if (!affectedDistricts.length) {
      setPlannerError("No matching districts for the selected shops.");
      return;
    }

    affectedDistricts.forEach((district) => {
      const payload = patches[district];
      updateRow(district, (row) => ({
        ...row,
        ptoDays: row.ptoDays + payload.ptoDays,
        vacantShops: row.vacantShops + payload.vacantShops,
        creditHours: row.creditHours + payload.creditHours,
        notes: [...row.notes, ...payload.notes],
      }));
    });

    const totalDelta = affectedDistricts.reduce((sum, district) => sum + patches[district].creditHours, 0);
    const dayLabel = describeDays(selectedDays);
    const detailLabel =
      selectedShops.length > 1
        ? `${selectedShops.length} shops • ${dayLabel}`
        : `${selectedShops[0]?.shopName ?? selectedShops[0]?.shopNumber ?? "Shop"} • ${dayLabel}`;

    setToast({
      title: formMode === "pto" ? "PTO credit logged" : "Vacancy credit logged",
      detail: detailLabel,
      delta: totalDelta,
    });
    setPlannerError(null);
    if (formMode === "pto") {
      setPtoDaysInput(1);
    }
    setFormMode(null);
  };

  const renderNotes = (row: CreditRowState, type: CreditNote["type"]) => {
    return row.notes
      .filter((note) => note.type === type)
      .slice(-3)
      .map((note) => (
        <p key={note.id} className="flex items-center justify-between text-[10px] text-slate-400">
          <span>{note.day ? `${note.day.slice(0, 3)} • ${note.shopLabel}` : note.shopLabel}</span>
          <span className="font-mono text-[10px]">+{hoursFormatter.format(note.hours)}h</span>
        </p>
      ));
  };

  const adjustedTone = (value: number) => {
    if (value > 0) {
      return "text-rose-300";
    }
    if (value < 0) {
      return "text-emerald-300";
    }
    return "text-slate-200";
  };

  const toggleFormMode = (mode: "pto" | "vacancy") => {
    setPlannerError(null);
    setFormMode((current) => (current === mode ? null : mode));
  };

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        acc.ptoDays += row.ptoDays;
        acc.vacantShops += row.vacantShops;
        acc.creditHours += row.creditHours;
        acc.adjusted += row.variance - row.creditHours;
        return acc;
      },
      { ptoDays: 0, vacantShops: 0, creditHours: 0, adjusted: 0 },
    );
  }, [rows]);

  const overlayActive = Boolean(formMode);
  const plannerGridSnapshot = plannerGrid ?? {};

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/5 bg-slate-950/70 p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.35em] text-slate-500">Credits</p>
          <h3 className="text-base font-semibold text-white">PTO & vacancy adjustments</h3>
          <p className="text-[11px] text-slate-400">8 hrs per PTO day • 40 hrs per vacant shop.</p>
        </div>
        <div className="inline-flex gap-2 text-[10px] font-semibold uppercase tracking-[0.35em]">
          <button
            type="button"
            onClick={() => toggleFormMode("pto")}
            className={`rounded-full border px-3 py-1 transition ${
              formMode === "pto" ? "border-emerald-400/70 bg-emerald-500/20 text-emerald-100" : "border-white/10 text-slate-300 hover:border-emerald-400/50"
            }`}
          >
            PTO
          </button>
          <button
            type="button"
            onClick={() => toggleFormMode("vacancy")}
            className={`rounded-full border px-3 py-1 transition ${
              formMode === "vacancy" ? "border-emerald-400/70 bg-emerald-500/20 text-emerald-100" : "border-white/10 text-slate-300 hover:border-emerald-400/50"
            }`}
          >
            Vacancy
          </button>
        </div>
      </div>
      {overlayActive ? (
        <div className="fixed inset-0 z-40 flex items-start justify-center bg-slate-950/80 p-6 text-xs text-slate-300 backdrop-blur" role="dialog" aria-modal="true">
          <div className="absolute inset-0" onClick={() => setFormMode(null)} aria-hidden="true" />
          <div className="relative z-10 flex max-h-[92vh] w-full max-w-[1500px] flex-col gap-6 overflow-y-auto rounded-[36px] border border-white/10 bg-slate-950/95 p-8 shadow-[0_60px_110px_rgba(0,0,0,0.85)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[9px] uppercase tracking-[0.4em] text-slate-500">{formMode === "pto" ? "PTO planner" : "Vacancy planner"}</p>
              <h4 className="text-lg font-semibold text-white">Week at a glance</h4>
              <p className="text-[11px] text-slate-400">Click a day cell, multi-select shops, and post credits. Entries flow into the adjustments card instantly.</p>
              <p className="text-[10px] text-emerald-300">Hold Shift/Ctrl while clicking a grid cell to add more days without losing the current selection.</p>
              {loading ? <p className="mt-1 text-[10px] text-slate-500">Loading roster…</p> : null}
            </div>
            <button
              type="button"
              onClick={() => setFormMode(null)}
              className="rounded-full border border-white/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.35em] text-slate-200 transition hover:border-emerald-400/60 hover:text-white"
            >
              Exit planner
            </button>
            </div>
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]">
            <div className="overflow-x-auto">
                <table className="min-w-full border border-white/10 text-[12px]">
                <thead>
                    <tr className="text-[10px] uppercase tracking-[0.3em] text-slate-400">
                      <th className="bg-slate-900/60 px-3 py-3 text-left">District</th>
                    {WEEK_DAYS.map((day) => (
                        <th key={day} className="bg-slate-900/60 px-3 py-3 text-center">
                        {day.slice(0, 3)}
                      </th>
                    ))}
                      <th className="bg-slate-900/60 px-3 py-3 text-center">WTD</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const wtdSummary = WEEK_DAYS.reduce(
                      (acc, day) => {
                        const bucket = plannerGridSnapshot[row.district]?.[day];
                        if (bucket) {
                          acc.total += bucket.total;
                          acc.entries += bucket.entries.length;
                        }
                        return acc;
                      },
                      { total: 0, entries: 0 },
                    );
                    return (
                      <tr key={`planner-${row.district}`} className="border-t border-white/5">
                        <td className="px-3 py-3 align-top">
                          <p className="font-semibold text-white">{row.district}</p>
                          <p className="text-[10px] text-slate-500">
                            {formMode === "pto" ? `${row.ptoDays.toFixed(2)} PTO days logged` : `${row.vacantShops} vacancy credits`}
                          </p>
                        </td>
                        {WEEK_DAYS.map((day) => {
                          const bucket = plannerGridSnapshot[row.district]?.[day];
                          const total = bucket?.total ?? 0;
                          const entries = bucket?.entries ?? [];
                          const isActive = cellEditor?.district === row.district && cellEditor?.days?.includes(day);
                          return (
                            <td key={`${row.district}-${day}`} className="px-2 py-2">
                              <button
                                type="button"
                                onClick={(event) => openCellFor(row.district, day, event.shiftKey || event.metaKey || event.ctrlKey)}
                                className={`flex h-full min-h-[120px] w-full flex-col gap-2 rounded-2xl border px-3 py-2 text-left text-[12px] transition ${
                                  isActive
                                    ? "border-emerald-400/80 bg-emerald-500/15 text-emerald-50"
                                    : "border-white/10 bg-slate-900/40 text-slate-200 hover:border-emerald-400/50"
                                }`}
                              >
                                <div className="flex items-center justify-between font-mono text-[12px]">
                                  <span>{hoursFormatter.format(total)}h</span>
                                  <span className="text-[9px] uppercase tracking-[0.3em]">{entries.length ? `+${entries.length}` : "—"}</span>
                                </div>
                                <div className="mt-1 space-y-1 text-[11px]">
                                  {entries.length ? (
                                    entries.slice(-2).map((entry) => (
                                      <p key={entry.id} className="truncate">
                                        {entry.label}
                                      </p>
                                    ))
                                  ) : (
                                    <span className="text-slate-600">No credits</span>
                                  )}
                                </div>
                              </button>
                            </td>
                          );
                        })}
                        <td className="px-3 py-2">
                          <div className="rounded-2xl border border-dashed border-white/15 bg-slate-900/60 px-3 py-2 text-slate-200">
                            <div className="flex items-center justify-between font-mono text-[12px] text-white">
                              <span>{hoursFormatter.format(wtdSummary.total)}h</span>
                              <span className="text-[9px] uppercase tracking-[0.35em]">WTD</span>
                            </div>
                            <p className="text-[10px] text-slate-500">{wtdSummary.entries ? `${wtdSummary.entries} entries` : "No activity"}</p>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col rounded-2xl border border-white/10 bg-slate-900/60 p-4 text-[11px] text-slate-200">
              <div className="space-y-1">
                <p className="text-[9px] uppercase tracking-[0.4em] text-slate-500">Planner focus</p>
                <p className="text-sm font-semibold text-white">
                  {cellEditor ? `${describeDays(cellEditor.days)} • ${cellEditor.district}` : "Select a cell to begin"}
                </p>
                <p className="text-[10px] text-slate-400">Credits apply to each selected shop&apos;s home district at end of day.</p>
              </div>
              {plannerError ? (
                <p className="mt-2 rounded-lg border border-rose-400/60 bg-rose-500/10 px-2 py-1 text-[11px] text-rose-100">{plannerError}</p>
              ) : null}
              <label className="mt-3 text-[11px] text-slate-400">
                District
                <select
                  value={cellEditor?.district ?? ""}
                  onChange={(event) => {
                    const nextDistrict = event.target.value;
                    if (!nextDistrict) {
                      return;
                    }
                    setCellEditor((prev) => ({
                      days: prev?.days?.length ? prev.days : [WEEK_DAYS[0]],
                      district: nextDistrict,
                    }));
                    setPlannerError(null);
                    if (!selectedShopIds.length) {
                      const firstShop = resolveShops(nextDistrict)[0];
                      if (firstShop) {
                        setSelectedShopIds([firstShop.id]);
                      }
                    }
                  }}
                  className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950/80 px-2 py-1 text-white"
                >
                  <option value="" disabled>
                    Select district
                  </option>
                  {rows.map((row) => (
                    <option key={row.district} value={row.district}>
                      {row.district}
                    </option>
                  ))}
                </select>
              </label>
              <div className="mt-3">
                <p className="text-[10px] uppercase tracking-[0.35em] text-slate-500">Day</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {WEEK_DAYS.map((day) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => {
                        toggleDaySelection(day);
                        setPlannerError(null);
                      }}
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.3em] transition ${
                        cellEditor?.days?.includes(day)
                          ? "border-emerald-400/70 bg-emerald-500/15 text-emerald-100"
                          : "border-white/10 text-slate-300 hover:border-emerald-400/50"
                      }`}
                    >
                      {day.slice(0, 3)}
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-[10px] text-slate-500">Use the pills above or Shift/Ctrl + click inside the grid to add/remove multiple days.</p>
              </div>
              <label className="mt-3 text-[11px] text-slate-400">
                Shop numbers
                <select
                  multiple
                  value={selectedShopIds}
                  onChange={(event) => setSelectedShopIds(Array.from(event.target.selectedOptions).map((option) => option.value))}
                  className="mt-1 h-28 w-full rounded-lg border border-slate-800 bg-slate-950/80 px-2 py-1 text-white"
                >
                  {allShopOptions.length ? (
                    allShopOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))
                  ) : (
                    <option value="" disabled>
                      No roster data available
                    </option>
                  )}
                </select>
              </label>
              <div className="mt-2 rounded-lg border border-slate-800/60 bg-slate-950/40 px-3 py-2 text-[10px] text-slate-400">
                {selectedShops.length ? `${selectedShops.length} shop${selectedShops.length > 1 ? "s" : ""} selected.` : "Select shops to include in this post."}
              </div>
              {formMode === "pto" ? (
                <label className="mt-3 text-[11px] text-slate-400">
                  PTO days per shop
                  <input
                    type="number"
                    min="0.25"
                    step="0.25"
                    value={ptoDaysInput}
                    onChange={(event) => setPtoDaysInput(Number.isNaN(event.target.valueAsNumber) ? 0 : event.target.valueAsNumber)}
                    className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950/80 px-2 py-1 text-white"
                  />
                  <span className="mt-1 block text-[10px] text-slate-500">Each PTO day converts to 8 hrs. Entries accrue at the end of the selected day.</span>
                </label>
              ) : (
                <p className="mt-3 rounded-lg border border-dashed border-slate-800/70 bg-slate-950/40 px-3 py-2 text-[10px] text-slate-400">
                  Each shop adds {VACANT_SHOP_CREDIT} hrs of vacancy credit for the selected day.
                </p>
              )}
              <button
                type="button"
                onClick={handlePlannerSubmit}
                className="mt-4 w-full rounded-full bg-emerald-500 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.35em] text-slate-950 transition hover:bg-emerald-400"
              >
                Post credit
              </button>
            </div>
            </div>
          </div>
        </div>
      ) : null}
      <div
        className={`mt-3 overflow-x-auto ${overlayActive ? "pointer-events-none opacity-30 blur-sm" : ""}`}
        aria-hidden={overlayActive}
      >
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-[0.3em] text-slate-400">
              <th className="py-2 pr-4">District</th>
              <th className="py-2 pr-4 text-center">PTO Days</th>
              <th className="py-2 pr-4 text-center">Vacant Shops</th>
              <th className="py-2 pr-4 text-center">Total Hours</th>
              <th className="py-2 text-center">Hours credit</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const adjusted = row.variance - row.creditHours;
              return (
                <tr key={row.district} className="border-t border-slate-800/60">
                  <td className="py-2 pr-4 align-top">
                    <p className="font-semibold text-white">{row.district}</p>
                    <div className="mt-1 space-y-0.5">
                      {renderNotes(row, "pto")}
                      {renderNotes(row, "vacancy")}
                    </div>
                  </td>
                  <td className="py-2 pr-4 text-center font-mono text-[11px] text-slate-200">{row.ptoDays.toFixed(2)}</td>
                  <td className="py-2 pr-4 text-center font-mono text-[11px] text-slate-200">{row.vacantShops}</td>
                  <td className={`py-2 pr-4 text-center font-mono text-[11px] ${adjustedTone(adjusted)}`}>
                    {adjusted > 0 ? "+" : ""}
                    {hoursFormatter.format(adjusted)}h
                  </td>
                  <td className="py-2 text-center font-mono text-[11px] text-emerald-200">+{hoursFormatter.format(row.creditHours)}h</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-800/60 text-[10px] uppercase tracking-[0.35em] text-slate-400">
              <td className="py-2 pr-4 text-white">Totals</td>
              <td className="py-2 pr-4 text-center font-mono text-[11px] text-slate-200">{totals.ptoDays.toFixed(2)}</td>
              <td className="py-2 pr-4 text-center font-mono text-[11px] text-slate-200">{totals.vacantShops}</td>
              <td className={`py-2 pr-4 text-center font-mono text-[11px] ${adjustedTone(totals.adjusted)}`}>
                {totals.adjusted > 0 ? "+" : ""}
                {hoursFormatter.format(totals.adjusted)}h
              </td>
              <td className="py-2 text-center font-mono text-[11px] text-emerald-200">+{hoursFormatter.format(totals.creditHours)}h</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div
        className={`mt-3 rounded-xl border border-slate-800/60 bg-slate-900/60 p-3 text-xs text-slate-300 ${overlayActive ? "pointer-events-none opacity-30 blur-sm" : ""}`}
        aria-hidden={overlayActive}
      >
        <p className="text-[10px] uppercase tracking-[0.35em] text-slate-500">Summary notation</p>
        <div className="mt-2 space-y-1">
          {noteList.length === 0 ? (
            <p className="text-slate-500">No credits logged yet.</p>
          ) : (
            noteList.map((note) => (
              <div key={note.id} className="flex items-center justify-between">
                <span>{note.type === "pto" ? `${note.day ?? "Day"} • ${note.shopLabel}` : `${note.day ?? "Day"} • ${note.shopLabel}`}</span>
                <span className="font-mono text-[11px] text-white">+{hoursFormatter.format(note.hours)}h</span>
              </div>
            ))
          )}
        </div>
      </div>
      {toast ? (
        <div className="pointer-events-none absolute bottom-4 right-4 inline-flex max-w-xs flex-col gap-1 rounded-2xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-100 shadow-lg">
          <span className="text-[10px] uppercase tracking-[0.4em]">{toast.title}</span>
          <span className="text-sm font-semibold text-white">{toast.detail}</span>
          <span className="text-[10px] font-mono text-emerald-200">+{hoursFormatter.format(toast.delta)} hrs</span>
        </div>
      ) : null}
    </div>
  );
}

function MinHoursCard() {
  return (
    <div className="rounded-2xl border border-amber-400/60 bg-gradient-to-br from-amber-500/20 via-amber-500/10 to-slate-950/80 p-4 text-amber-100">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.4em]">Minimum Hours WTD — key</p>
          <p className="text-xs text-amber-200">Baseline allowance per day, capped for ≤218 cars in week.</p>
        </div>
        <Target className="h-5 w-5" />
      </div>
      <div className="mt-4 space-y-2 text-sm">
        {MIN_HOURS_KEY.map((row) => (
          <div key={row.day} className="flex items-center justify-between rounded-lg border border-amber-400/40 bg-amber-500/5 px-3 py-1.5">
            <span className="font-semibold">{row.day}</span>
            <span>{hoursFormatter.format(row.hours)} hrs</span>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
        Shops at 26 hrs Sunday / 32 hrs Mon–Sat stay compliant up to 218 cars. Total runway: {hoursFormatter.format(MIN_HOURS_TOTAL)} hrs.
      </div>
    </div>
  );
}

function ScopeToggle({ label, value, onChange }: { label: string; value: ScopeValue; onChange: (value: ScopeValue) => void }) {
  const options: ScopeValue[] = ["daily", "wtd"];
  return (
    <div className="flex flex-col items-end gap-1 text-xs text-slate-400">
      <span className="text-[9px] uppercase tracking-[0.35em]">{label}</span>
      <div className="inline-flex gap-1">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => (value === option ? null : onChange(option))}
            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.3em] transition ${
              value === option
                ? "border-emerald-400/70 bg-emerald-500/15 text-emerald-100"
                : "border-white/10 text-slate-300 hover:border-emerald-400/50"
            }`}
          >
            {option === "daily" ? "Daily" : "WTD"}
          </button>
        ))}
      </div>
    </div>
  );
}

function ClassicToggle({ value, onToggle }: { value: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.3em] transition ${
        value ? "border-emerald-400/70 bg-emerald-500/15 text-emerald-100" : "border-white/10 text-slate-300 hover:border-emerald-400/50"
      }`}
      aria-pressed={value}
    >
      Classic
    </button>
  );
}

function varianceTone(value: number) {
  if (value > 0) {
    return "text-rose-300 border-rose-500/40 bg-rose-500/10";
  }
  if (value < 0) {
    return "text-emerald-300 border-emerald-500/40 bg-emerald-500/10";
  }
  return "text-slate-300 border-slate-700/70";
}

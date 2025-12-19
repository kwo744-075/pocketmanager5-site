"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import Chip from "@/app/components/Chip";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { autoFitTextClass } from "@/lib/ui/autoFitText";
import { AIScheduleAssumptionsModal } from "@/app/pocket-manager5/features/dm-schedule/_components/AIScheduleAssumptionsModal";
import { VisitPlanModal } from "@/app/pocket-manager5/features/dm-schedule/_components/VisitPlanModal";
import { Tooltip } from "@/app/pocket-manager5/features/dm-schedule/_components/Tooltip";
import { supabase } from "@/lib/supabaseClient";
import {
  DM_DAY_NAMES,
  DM_STATUS_DOTS,
  DM_VISIT_BADGES,
  DM_COVERAGE_SHOPS,
  DM_SCHEDULE_LOCATIONS,
  buildCoverageSummary,
  buildPeriodGrid,
  buildSampleSchedule,
  buildDueChecklist,
  buildVisitMix,
  DAY_MS,
  groupEntriesByDate,
  getRetailPeriodInfo,
  getPeriodStorageKey,
  getVisitRequirementsForPeriod,
  shortDateFormatter,
  type PeriodDay,
  type RetailPeriodInfo,
  type SampleScheduleEntry,
} from "./dmScheduleUtils";

const STORAGE_KEYS = {
  clearedPanels: "dmSchedule:clearedPanels",
  panelOverrides: "dmSchedule:panelOverrides",
  rdEmail: "dmSchedule:rdEmail",
} as const;

const PRINT_SCALE = 1; // default to 1 page landscape for printing
const MIN_SCHEDULE_TIMESTAMP = Date.UTC(2026, 0, 1);

type SerializedEntry = Omit<SampleScheduleEntry, "date"> & { date: string };

const serializeEntry = (entry: SampleScheduleEntry): SerializedEntry => ({
  ...entry,
  date: entry.date.toISOString(),
});

const deserializeEntry = (entry: SerializedEntry): SampleScheduleEntry => ({
  ...entry,
  date: new Date(entry.date),
});

const cloneEntriesMap = (entries: Record<string, SampleScheduleEntry[]>) =>
  Object.fromEntries(
    Object.entries(entries).map(([iso, items]) => [iso, items.map((item) => ({ ...item, date: new Date(item.date) }))]),
  );

const serializeOverrides = (overrides: Record<string, Record<string, SampleScheduleEntry[]>>) =>
  Object.fromEntries(
    Object.entries(overrides).map(([panelKey, dateMap]) => [
      panelKey,
      Object.fromEntries(
        Object.entries(dateMap).map(([dateKey, entries]) => [dateKey, entries.map(serializeEntry)]),
      ),
    ]),
  );

const deserializeOverrides = (
  raw: Record<string, Record<string, SerializedEntry[]>> | null,
): Record<string, Record<string, SampleScheduleEntry[]>> => {
  if (!raw) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(raw).map(([panelKey, dateMap]) => [
      panelKey,
      Object.fromEntries(
        Object.entries(dateMap).map(([dateKey, entries]) => [dateKey, entries.map(deserializeEntry)]),
      ),
    ]),
  );
};

const defer = (task: () => void) => {
  if (typeof queueMicrotask === "function") {
    queueMicrotask(task);
    return;
  }
  Promise.resolve().then(task);
};

const numericPeriodDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "numeric",
  day: "numeric",
  year: "numeric",
});

const hoverDayFormatter = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "numeric", day: "numeric" });

const formatPeriodRangeLabel = (start: Date, end: Date) =>
  `${numericPeriodDateFormatter.format(start)} - ${numericPeriodDateFormatter.format(end)}`;

const useSampleScheduleData = (anchorDate?: Date) => {
  const now = useMemo(() => new Date(), []);
  const effectiveTimestamp = useMemo(() => {
    const base = anchorDate ?? now;
    return Math.max(base.getTime(), MIN_SCHEDULE_TIMESTAMP);
  }, [anchorDate, now]);
  const effectiveDate = useMemo(() => new Date(effectiveTimestamp), [effectiveTimestamp]);
  const periodInfo = useMemo(() => getRetailPeriodInfo(effectiveDate), [effectiveDate]);
  const scheduleEntries = useMemo(
    () => buildSampleSchedule(periodInfo.startDate, periodInfo.weeksInPeriod),
    [periodInfo.startDate, periodInfo.weeksInPeriod],
  );
  const calendarGrid = useMemo(
    () => buildPeriodGrid(periodInfo.startDate, periodInfo.weeksInPeriod, effectiveDate),
    [periodInfo.startDate, periodInfo.weeksInPeriod, effectiveDate],
  );

  return {
    today: effectiveDate,
    periodInfo,
    scheduleEntries,
    calendarGrid,
  } as const;
};

type DmSchedulePlannerProps = {
  scheduleEntries?: SampleScheduleEntry[];
  historicalEntries?: SampleScheduleEntry[];
  calendarGrid?: PeriodDay[][];
  periodInfo?: RetailPeriodInfo;
  periodRange?: string;
  entriesByDate?: Record<string, SampleScheduleEntry[]>;
  visitMix?: Array<{ type: string; count: number }>;
  dueChecklist?: Array<{ type: string; required: number; actual: number; met: boolean }>;
  coverageSummary?: Array<{
    shopId: string;
    label: string;
    count: number;
    toneClass: string;
    badgeClass: string;
    statusLabel: string;
  }>;
  selectedDate?: string | null;
  onDaySelect?: (day: PeriodDay, entries: SampleScheduleEntry[]) => void;
  showLegend?: boolean;
  shopNumber?: string | null;
  entryFormSlug?: string;
  anchorDate?: Date;
  onPeriodClear?: (panelKey: string, cleared: boolean) => void;
};

type DueVisitSummary = { type: string; count: number };

const summarizeDueVisits = (period: number): DueVisitSummary[] =>
  getVisitRequirementsForPeriod(period).map(({ type, required }) => ({ type, count: required }));

const formatShopLabel = (label: string | undefined) => {
  if (!label) {
    return "Shop";
  }
  const match = label.match(/#\d+/);
  if (match) {
    return `Shop ${match[0]}`;
  }
  return label;
};

type PlannerDataInputs = Pick<
  DmSchedulePlannerProps,
  | "scheduleEntries"
  | "calendarGrid"
  | "periodInfo"
  | "periodRange"
  | "entriesByDate"
  | "visitMix"
  | "dueChecklist"
  | "coverageSummary"
> & {
  historicalEntries?: SampleScheduleEntry[];
};

type PlannerPeriodPanel = {
  storageKey: string;
  role: "current" | "next" | "year";
  label: string;
  info: RetailPeriodInfo;
  grid: PeriodDay[][];
  entries: Record<string, SampleScheduleEntry[]>;
  dueSummary: DueVisitSummary[];
  range: string;
};

type PlannerData = {
  activePeriodInfo: RetailPeriodInfo;
  activeEntries: SampleScheduleEntry[];
  derivedEntriesByDate: Record<string, SampleScheduleEntry[]>;
  periodPanels: PlannerPeriodPanel[];
  visitMix: Array<{ type: string; count: number }>;
  dueChecklist: Array<{ type: string; required: number; actual: number; met: boolean }>;
  coverageSummary: Array<{
    shopId: string;
    label: string;
    count: number;
    toneClass: string;
    badgeClass: string;
    statusLabel: string;
  }>;
  coverageHighlight: string;
  totalVisits: number;
  adminBlocks: number;
  today: Date;
  coverageMix: Record<string, { standard: number; quarterly: number; admin: number; plan: number; total: number }>;
};

const useDmSchedulePlannerData = (inputs: PlannerDataInputs = {}, anchorDate?: Date): PlannerData => {
  const { today, periodInfo, scheduleEntries, calendarGrid } = useSampleScheduleData(anchorDate);
  const {
    scheduleEntries: scheduleEntriesProp,
    calendarGrid: calendarGridProp,
    periodInfo: periodInfoProp,
    periodRange: periodRangeProp,
    entriesByDate: entriesByDateProp,
    visitMix: visitMixProp,
    dueChecklist: dueChecklistProp,
    coverageSummary: coverageSummaryProp,
    historicalEntries: historicalEntriesProp,
  } = inputs;

  void historicalEntriesProp;

  const activePeriodInfo = periodInfoProp ?? periodInfo;
  const activeCalendarGrid = calendarGridProp ?? calendarGrid;
  const activeEntries = scheduleEntriesProp ?? scheduleEntries;

  const derivedEntriesByDate = useMemo(
    () => entriesByDateProp ?? groupEntriesByDate(activeEntries),
    [entriesByDateProp, activeEntries],
  );

  const periodRange = useMemo(() => {
    if (periodRangeProp) return periodRangeProp;
    return `${shortDateFormatter.format(activePeriodInfo.startDate)}  ${shortDateFormatter.format(activePeriodInfo.endDate)}`;
  }, [periodRangeProp, activePeriodInfo.startDate, activePeriodInfo.endDate]);

  const visitMix = useMemo(
    () => visitMixProp ?? buildVisitMix(activeEntries),
    [visitMixProp, activeEntries],
  );

  const dueChecklist = useMemo(
    () => dueChecklistProp ?? buildDueChecklist(activeEntries, activePeriodInfo.period),
    [dueChecklistProp, activeEntries, activePeriodInfo.period],
  );

  const coverageSummary = useMemo(
    () => coverageSummaryProp ?? buildCoverageSummary(activeEntries),
    [coverageSummaryProp, activeEntries],
  );

  const periodId = useMemo(
    () => `P${activePeriodInfo.period}-${activePeriodInfo.startDate.getFullYear()}`,
    [activePeriodInfo.period, activePeriodInfo.startDate],
  );

  const [coverageMix, setCoverageMix] = useState<Record<string, { standard: number; quarterly: number; admin: number; plan: number; total: number }>>({});

  

  const nextPeriodInfo = useMemo(() => {
    const anchor = new Date(activePeriodInfo.endDate);
    anchor.setDate(anchor.getDate() + 1);
    return getRetailPeriodInfo(anchor);
  }, [activePeriodInfo.endDate]);

  const nextCalendarGrid = useMemo(
    () => buildPeriodGrid(nextPeriodInfo.startDate, nextPeriodInfo.weeksInPeriod, today),
    [nextPeriodInfo.startDate, nextPeriodInfo.weeksInPeriod, today],
  );

  const nextEntries = useMemo(
    () => buildSampleSchedule(nextPeriodInfo.startDate, nextPeriodInfo.weeksInPeriod),
    [nextPeriodInfo.startDate, nextPeriodInfo.weeksInPeriod],
  );

  const nextEntriesByDate = useMemo(() => groupEntriesByDate(nextEntries), [nextEntries]);

  const nextPeriodRange = useMemo(
    () => `${shortDateFormatter.format(nextPeriodInfo.startDate)}  ${shortDateFormatter.format(nextPeriodInfo.endDate)}`,
    [nextPeriodInfo.startDate, nextPeriodInfo.endDate],
  );

  const currentDueSummary = useMemo(() => summarizeDueVisits(activePeriodInfo.period), [activePeriodInfo.period]);
  const nextDueSummary = useMemo(() => summarizeDueVisits(nextPeriodInfo.period), [nextPeriodInfo.period]);

  const periodPanels = useMemo<PlannerPeriodPanel[]>(
    () => [
      {
        storageKey: getPeriodStorageKey(activePeriodInfo),
        role: "current",
        label: "Current period",
        info: activePeriodInfo,
        grid: activeCalendarGrid,
        entries: derivedEntriesByDate,
        dueSummary: currentDueSummary,
        range: periodRange,
      },
      {
        storageKey: getPeriodStorageKey(nextPeriodInfo),
        role: "next",
        label: "Next period",
        info: nextPeriodInfo,
        grid: nextCalendarGrid,
        entries: nextEntriesByDate,
        dueSummary: nextDueSummary,
        range: nextPeriodRange,
      },
    ],
    [
      activePeriodInfo,
      activeCalendarGrid,
      derivedEntriesByDate,
      currentDueSummary,
      nextPeriodInfo,
      nextCalendarGrid,
      nextEntriesByDate,
      nextDueSummary,
      periodRange,
      nextPeriodRange,
    ],
  );

  const coverageHighlight = useMemo(() => {
    if (!coverageSummary.length) return "No shops mapped";
    const shopsWithTwo = coverageSummary.filter((shop) => shop.count >= 2).length;
    if (!shopsWithTwo) return "No shops locked twice";
    const label = shopsWithTwo === 1 ? "shop" : "shops";
    return `${shopsWithTwo} ${label} locked twice`;
  }, [coverageSummary]);

  useEffect(() => {
    let active = true;
    supabase
      .from("dm_schedule_shop_mix_vw")
      .select("*")
      .eq("period_id", periodId)
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.warn("dm schedule mix load failed", error);
          return;
        }
        const map: Record<string, { standard: number; quarterly: number; admin: number; plan: number; total: number }> = {};
        (data ?? []).forEach((row: any) => {
          const key = String(row.shop_number);
          map[key] = {
            standard: Number(row.standard_visits ?? 0),
            quarterly: Number(row.quarterly_audits ?? 0),
            admin: Number(row.admin_days ?? 0),
            plan: Number(row.plan_to_win_days ?? 0),
            total: Number(row.total_entries ?? 0),
          };
        });
        setCoverageMix(map);
      });
    return () => {
      active = false;
    };
  }, [periodId]);

  const totalVisits = useMemo(
    () => activeEntries.filter((entry) => entry.visitType !== "Off").length,
    [activeEntries],
  );

  const adminBlocks = useMemo(
    () =>
      activeEntries.filter((entry) => entry.visitType === "Admin" || entry.visitType === "Project Day").length,
    [activeEntries],
  );

  return {
    today,
    activePeriodInfo,
    activeEntries,
    derivedEntriesByDate,
    periodPanels,
    visitMix,
    dueChecklist,
    coverageSummary,
    coverageHighlight,
    totalVisits,
    adminBlocks,
    coverageMix,
  };
};

export function DmSchedulePlanner({
  scheduleEntries: scheduleEntriesProp,
  historicalEntries: historicalEntriesProp,
  calendarGrid: calendarGridProp,
  periodInfo: periodInfoProp,
  periodRange: periodRangeProp,
  entriesByDate: entriesByDateProp,
  visitMix: visitMixProp,
  dueChecklist: dueChecklistProp,
  coverageSummary: coverageSummaryProp,
  selectedDate,
  onDaySelect,
  showLegend = true,
  shopNumber,
  entryFormSlug,
  anchorDate,
  onPeriodClear,
}: DmSchedulePlannerProps) {
  const router = useRouter();
  const [internalSelectedDate, setInternalSelectedDate] = useState<string | null>(null);
  const [internalSelectedPanelKey, setInternalSelectedPanelKey] = useState<string | null>(null);
  const [compactText, setCompactText] = useState(false);
  const [visitModal, setVisitModal] = useState<{
    open: boolean;
    date: string | null;
    shop: string | null;
    initial?: { visitType?: string; notes?: string };
  }>({
    open: false,
    date: null,
    shop: null,
    initial: undefined,
  });
  const [aiWizardOpen, setAiWizardOpen] = useState(false);
  const [selectedDayDetail, setSelectedDayDetail] = useState<{
    day: PeriodDay;
    entries: SampleScheduleEntry[];
  } | null>(null);
  const [clearedPanels, setClearedPanels] = useState<Record<string, boolean>>({});
  const [panelOverrides, setPanelOverrides] = useState<Record<string, Record<string, SampleScheduleEntry[]>>>({});
  const [copyBuffer, setCopyBuffer] = useState<{
    storageKey: string;
    entries: Record<string, SampleScheduleEntry[]>;
  } | null>(null);
  const [printTarget, setPrintTarget] = useState<string | null>(null);
  const [rdEmail, setRdEmail] = useState<string | null>(null);
  const {
    periodPanels,
    visitMix,
    coverageSummary,
    coverageHighlight,
    activePeriodInfo,
    today,
    dueChecklist,
    totalVisits,
    adminBlocks,
  } =
    useDmSchedulePlannerData(
      {
        scheduleEntries: scheduleEntriesProp,
        calendarGrid: calendarGridProp,
        periodInfo: periodInfoProp,
        periodRange: periodRangeProp,
        entriesByDate: entriesByDateProp,
        visitMix: visitMixProp,
        dueChecklist: dueChecklistProp,
        coverageSummary: coverageSummaryProp,
        historicalEntries: historicalEntriesProp,
      },
      anchorDate,
    );

    useEffect(() => {
      if (!printTarget) {
        return undefined;
      }

      const handleAfterPrint = () => {
        setPrintTarget(null);
      };

      window.addEventListener("afterprint", handleAfterPrint);
      const timeoutId = window.setTimeout(() => window.print(), 50);

      return () => {
        window.removeEventListener("afterprint", handleAfterPrint);
        window.clearTimeout(timeoutId);
      };
    }, [printTarget]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let isActive = true;
    defer(() => {
      if (!isActive) return;
      try {
        const storedCleared = window.localStorage.getItem(STORAGE_KEYS.clearedPanels);
        if (storedCleared) {
          const parsedCleared = JSON.parse(storedCleared) as Record<string, boolean>;
          setClearedPanels(parsedCleared);
        }

        const storedOverrides = window.localStorage.getItem(STORAGE_KEYS.panelOverrides);
        if (storedOverrides) {
          const parsedOverrides = JSON.parse(storedOverrides) as Record<string, Record<string, SerializedEntry[]>>;
          setPanelOverrides(deserializeOverrides(parsedOverrides));
        }

        const storedEmail = window.localStorage.getItem(STORAGE_KEYS.rdEmail);
        if (storedEmail) {
          setRdEmail(storedEmail);
        }
      } catch (error) {
        console.warn("Unable to hydrate DM schedule state", error);
      }
    });
    return () => {
      isActive = false;
    };
  }, []);

  // Year view mode: 'off' | 'two-month' | 'full-year'
  const [yearViewMode, setYearViewMode] = useState<"off" | "two-month" | "full-year">("off");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!rdEmail) {
      window.localStorage.removeItem(STORAGE_KEYS.rdEmail);
      return;
    }
    window.localStorage.setItem(STORAGE_KEYS.rdEmail, rdEmail);
  }, [rdEmail]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEYS.clearedPanels, JSON.stringify(clearedPanels));
  }, [clearedPanels]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!Object.keys(panelOverrides).length) {
      window.localStorage.removeItem(STORAGE_KEYS.panelOverrides);
      return;
    }
    window.localStorage.setItem(
      STORAGE_KEYS.panelOverrides,
      JSON.stringify(serializeOverrides(panelOverrides)),
    );
  }, [panelOverrides]);

  const computedFormSlug = entryFormSlug ?? "dm-visit-plan";
  const activeSelectedDate = selectedDate ?? internalSelectedDate;
  const activeSelectedPanelKey = selectedDate ? null : internalSelectedPanelKey;

  const handleDaySelection = useCallback(
    (panelKey: string, day: PeriodDay, entries: SampleScheduleEntry[]) => {
      if (!selectedDate) {
        setInternalSelectedDate(day.iso);
        setInternalSelectedPanelKey(panelKey);
      }

      setVisitModal({
        open: true,
        date: day.iso,
        shop: entries[0]?.shopId ?? null,
        initial: entries[0] ? { visitType: entries[0].visitType, notes: (entries[0] as any).notes } : undefined,
      });
    },
    [selectedDate, onDaySelect],
  );

  const handleCloseDayDetail = useCallback(() => {
    setSelectedDayDetail(null);
  }, []);

  const handleEditVisit = useCallback(
    (entry: SampleScheduleEntry) => {
      setVisitModal({
        open: true,
        date: entry.iso,
        shop: entry.shopId ?? null,
        initial: { visitType: entry.visitType, notes: (entry as any).notes },
      });
    },
    [],
  );

  const handleAddVisit = useCallback(
    (dayIso: string, shop: string, visitType: string) => {
      // If a panel is selected, insert locally into overrides to avoid opening the full-page form
      if (activeSelectedPanelKey) {
        const panel = periodPanels.find((p) => p.storageKey === activeSelectedPanelKey);
        if (!panel) return;

        const shopId = shop || shopNumber || "home";
        const location = (DM_SCHEDULE_LOCATIONS as Record<string, { label: string }>)[shopId]?.label ?? `Shop ${String(shopId)}`;
        const entry: SampleScheduleEntry = {
          date: new Date(dayIso),
          iso: dayIso,
          visitType: visitType || "Standard Visit",
          shopId: shopId as string,
          focus: null,
          status: "planned",
          locationLabel: location,
        };

        setPanelOverrides((prev) => {
          const existing = prev[activeSelectedPanelKey] ?? cloneEntriesMap(panel.entries);
          const next = { ...existing };
          next[dayIso] = next[dayIso] ? [...next[dayIso], entry] : [entry];
          return { ...prev, [activeSelectedPanelKey]: next };
        });
        setClearedPanels((prev) => ({ ...prev, [activeSelectedPanelKey]: false }));
        // close the quick panel UI
        setSelectedDayDetail(null);
        return;
      }

      // fallback to modal
      setVisitModal({ open: true, date: dayIso, shop, initial: { visitType } });
    },
    [activeSelectedPanelKey, periodPanels, shopNumber],
  );

  const renderCalendar = useCallback(
    (grid: PeriodDay[][], entryLookup: Record<string, SampleScheduleEntry[]>, panelKey: string) => {
      const MAX_VISIBLE = 3;
      const clampClass = compactText ? "line-clamp-2" : "line-clamp-3";
      const thresholds = compactText ? { large: 55, medium: 95, small: 150 } : undefined;
      return (
        <div className="dm-print-surface mt-4 rounded-2xl border border-slate-900/30 bg-slate-950/30 p-3 print:border-slate-300 print:bg-white print:text-slate-900">
          <div className="grid grid-cols-7 gap-1 text-[10px] uppercase tracking-[0.35em] text-slate-500">
            {DM_DAY_NAMES.map((dayName) => (
              <span key={`${panelKey}-day-${dayName}`} className="text-center">
                {dayName}
              </span>
            ))}
          </div>
          <div className="mt-2 space-y-2">
            {grid.map((week, weekIndex) => (
              <div key={`${panelKey}-week-${weekIndex}`} className="grid grid-cols-7 gap-1">
                {week.map((day) => {
                  const dayEntries = entryLookup[day.iso] ?? [];
                  const visibleEntries = dayEntries.slice(0, MAX_VISIBLE);
                  const overflow = Math.max(0, dayEntries.length - visibleEntries.length);
                  const dayContent = dayEntries.map((entry) => `${formatShopLabel(entry.locationLabel)} - ${entry.visitType}`).join(" · ");
                  const sizeClass = autoFitTextClass(dayContent, thresholds);
                  const isPanelActive = !activeSelectedPanelKey || activeSelectedPanelKey === panelKey;
                  const isSelected = isPanelActive && activeSelectedDate === day.iso;
                  const dayLabelTone = day.isToday
                    ? "text-emerald-200"
                    : isSelected
                      ? "text-cyan-100"
                      : "text-slate-200";
                  const cardTone = day.isToday
                    ? "border-emerald-400/70 bg-emerald-500/10"
                    : isSelected
                      ? "border-cyan-400/70 bg-cyan-500/10"
                      : "border-slate-800/60 bg-slate-950/30 hover:border-slate-600/70";
                  return (
                    <button
                      key={`${panelKey}-${day.iso}`}
                      type="button"
                      onClick={() => handleDaySelection(panelKey, day, dayEntries)}
                      className={`dm-calendar-day group relative min-w-0 rounded-2xl border px-2 py-2 text-left text-slate-100 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 print:border-slate-300 print:bg-white print:text-slate-900 ${cardTone}`}
                    >
                      <div className="flex items-center justify-between text-[11px] font-semibold">
                        <span className={dayLabelTone}>{day.dayNumber}</span>
                        <div className="flex gap-1 text-[9px] uppercase tracking-[0.25em]">
                          {day.isToday && <span className="text-emerald-300">Today</span>}
                          {isSelected && !day.isToday && <span className="text-cyan-300">Editing</span>}
                        </div>
                      </div>
                      <div className={`mt-1 min-w-0 space-y-1 overflow-hidden ${clampClass}`}>
                        {visibleEntries.map((entry) => (
                          <Fragment key={`${panelKey}-${entry.iso}-${entry.visitType}-${entry.locationLabel}`}>
                            <Chip
                              className={`dm-visit-pill flex min-w-0 items-center gap-1 rounded-full border px-1.5 py-0.5 ${sizeClass} font-semibold leading-none ${
                                DM_VISIT_BADGES[entry.visitType] ?? "border-slate-700/60 text-slate-200"
                              } print:hidden`}
                            >
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${
                                  entry.status ? DM_STATUS_DOTS[entry.status] : DM_STATUS_DOTS.planned
                                }`}
                              />
                              <div className="flex min-w-0 w-full items-center justify-between gap-2">
                                <span className="truncate">{formatShopLabel(entry.locationLabel)}</span>
                                <span className="shrink-0 text-right uppercase text-white/80">{entry.visitType}</span>
                              </div>
                            </Chip>
                            <div className="hidden print:block text-[10px] text-slate-900">
                              {formatShopLabel(entry.locationLabel)} â€” {entry.visitType}
                            </div>
                          </Fragment>
                        ))}
                        {overflow > 0 && <p className="text-[9px] text-slate-500">+{overflow} more</p>}
                        {dayEntries.length === 0 && <p className="text-[9px] text-slate-600">Open</p>}
                      </div>
                      <div className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 w-[320px] max-w-[90vw] -translate-x-1/2 rounded-2xl border border-slate-700/70 bg-slate-950/95 p-3 text-white opacity-0 shadow-2xl shadow-black/40 transition group-hover:opacity-100 print:hidden">
                        <div className="flex items-center justify-between gap-3 text-xs font-semibold">
                          <span className="text-white">{hoverDayFormatter.format(day.date)}</span>
                          <span className="text-white/60">
                            {dayEntries.length ? `${dayEntries.length} item${dayEntries.length === 1 ? "" : "s"}` : "Open"}
                          </span>
                        </div>
                        <div className="mt-2 text-sm text-white/90 whitespace-pre-wrap break-words">
                          {dayEntries.length
                            ? dayEntries.map((entry) => `${formatShopLabel(entry.locationLabel)} - ${entry.visitType}`).join(" · ")
                            : "No entries yet."}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      );
    },
    [activeSelectedDate, activeSelectedPanelKey, compactText, handleDaySelection],
  );

  const buildPanelEmailPayload = useCallback(
    (
      panel: PlannerPeriodPanel,
      flattenedEntries: SampleScheduleEntry[],
      panelCoverage: ReturnType<typeof buildCoverageSummary>,
      auditHeadline: string,
      periodRangeLabel: string,
      entryTypeCounts: Record<string, number>,
      panelVisitCount: number,
    ) => {
    const sortedEntries = [...flattenedEntries].sort((a, b) => a.date.getTime() - b.date.getTime());
    const visitLines = sortedEntries.length
      ? sortedEntries.map((entry) => {
          const focusSuffix = entry.focus ? `  ${entry.focus}` : "";
          return `${shortDateFormatter.format(entry.date)}  ${entry.visitType} @ ${formatShopLabel(entry.locationLabel)}${focusSuffix}`;
        })
      : ["No visits are scheduled yet."];

    const dueLines = panel.dueSummary.map((item) => {
      const scheduled = entryTypeCounts[item.type] ?? 0;
      return `${item.type}: ${scheduled}/${item.count}`;
    });

    const coverageLines = panelCoverage.map((shop) => `${shop.label}: ${shop.count} (${shop.statusLabel})`);

    const bodyLines = [
      `Period ${panel.info.period} schedule (${periodRangeLabel})`,
      `Days scheduled: ${panelVisitCount}`,
      `Required audits planned: ${auditHeadline}`,
      "",
      "Due visits",
      ...(dueLines.length ? dueLines : ["No due visit requirements mapped."]),
      "",
      "Coverage",
      ...(coverageLines.length ? coverageLines : ["No coverage notes available."]),
      "",
      "Visit plan",
      ...visitLines,
    ];

    return {
      subject: `Period ${panel.info.period} schedule  Pocket Manager`,
      body: bodyLines.join("`n"),
    };
  }, []);

  const handleConfigureRdEmail = useCallback(() => {
    if (typeof window === "undefined") {
      return null;
    }
    const next = window.prompt("Send schedules to which RD email?", rdEmail ?? "");
    if (next == null) {
      return rdEmail;
    }
    const trimmed = next.trim();
    if (!trimmed) {
      setRdEmail(null);
      return null;
    }
    if (!trimmed.includes("@")) {
      return rdEmail;
    }
    const normalized = trimmed.toLowerCase();
    setRdEmail(normalized);
    return normalized;
  }, [rdEmail]);

  const resolveRdEmail = useCallback(() => {
    if (rdEmail) {
      return rdEmail;
    }
    return handleConfigureRdEmail();
  }, [rdEmail, handleConfigureRdEmail]);

  const handleSubmitToRd = useCallback(
    (
      panel: PlannerPeriodPanel,
      flattenedEntries: SampleScheduleEntry[],
      panelCoverage: ReturnType<typeof buildCoverageSummary>,
      auditHeadline: string,
      periodRangeLabel: string,
      entryTypeCounts: Record<string, number>,
      panelVisitCount: number,
    ) => {
      if (typeof window === "undefined") {
        return;
      }

      const recipient = resolveRdEmail();
      if (!recipient) {
        return;
      }

      const { subject, body } = buildPanelEmailPayload(
        panel,
        flattenedEntries,
        panelCoverage,
        auditHeadline,
        periodRangeLabel,
        entryTypeCounts,
        panelVisitCount,
      );
      const mailtoUrl = `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      window.location.href = mailtoUrl;
    },
    [buildPanelEmailPayload, resolveRdEmail],
  );

  const handleClearToggle = useCallback(
    (panel: PlannerPeriodPanel) => {
      setClearedPanels((prev) => {
        const nextValue = !prev[panel.storageKey];
        const nextState = { ...prev, [panel.storageKey]: nextValue };
        onPeriodClear?.(panel.storageKey, nextValue);
        return nextState;
      });
    },
    [onPeriodClear],
  );

  const handleCopyPaste = useCallback(
    (panel: PlannerPeriodPanel) => {
      if (!copyBuffer) {
        setCopyBuffer({ storageKey: panel.storageKey, entries: panel.entries });
        return;
      }

      if (copyBuffer.storageKey === panel.storageKey) {
        setCopyBuffer(null);
        return;
      }

      setPanelOverrides((prev) => ({ ...prev, [panel.storageKey]: cloneEntriesMap(copyBuffer.entries) }));
      setClearedPanels((prev) => ({ ...prev, [panel.storageKey]: false }));
      setCopyBuffer(null);
    },
    [copyBuffer],
  );

  const handlePrintDualView = useCallback(() => {
    setPrintTarget("dual");
  }, []);

  const handleSetYearView = useCallback((mode: "off" | "two-month" | "full-year") => {
    setYearViewMode(mode);
  }, []);

  const handleAiSchedule = useCallback(
    (panel: PlannerPeriodPanel) => {
      if (typeof window === "undefined") return;
      if (!window.confirm(`Generate AI schedule for Period ${panel.info.period}?`)) return;

      // collect days in the period
      const allDays = panel.grid.flat();

      // Audits: Tue/Wed/Thu only (no Fri audits)
      const auditDays = allDays.filter((d) => {
        const wk = d.date.getDay();
        return wk === 2 || wk === 3 || wk === 4; // Tue, Wed, Thu
      });

      // Visits: Tue/Wed/Thu/Fri allowed. Mondays are Admin days; Sat/Sun are off.
      const visitDays = allDays.filter((d) => {
        const wk = d.date.getDay();
        return wk === 2 || wk === 3 || wk === 4 || wk === 5; // Tue, Wed, Thu, Fri
      });

      if (!visitDays.length) {
        window.alert("No available days in this period to schedule visits.");
        return;
      }

      const shops = DM_COVERAGE_SHOPS.slice();

      // helper: map iso -> entries
      const newMap: Record<string, SampleScheduleEntry[]> = {};

      const pushEntry = (day: PeriodDay, shopId: string, visitType: string) => {
        const location = (DM_SCHEDULE_LOCATIONS as Record<string, { label: string }>)[shopId]?.label ?? `Shop ${String(shopId)}`;
        const entry: SampleScheduleEntry = {
          date: day.date,
          iso: day.iso,
          visitType,
          shopId: shopId as string,
          focus: null,
          status: "planned",
          locationLabel: location,
        };
        newMap[day.iso] = newMap[day.iso] ? [...newMap[day.iso], entry] : [entry];
      };

      // place Admin on Mondays (home)
      allDays.forEach((d) => {
        const wk = d.date.getDay();
        if (wk === 1) {
          // Monday
          pushEntry(d, "home", "Admin");
        }
      });


      // determine per-shop required audits/visits
      const reqs = getVisitRequirementsForPeriod(panel.info.period, DM_COVERAGE_SHOPS.length);
      const perShopReq: Record<string, number> = {};
      reqs.forEach((r) => {
        // r.required is total for all shops; convert to per-shop (round up where needed)
        perShopReq[r.type] = Math.max(0, Math.ceil(r.required / Math.max(1, DM_COVERAGE_SHOPS.length)));
      });

      // build first-two-weeks and last-two-weeks windows
      const periodStart = panel.info.startDate;
      const periodEnd = panel.info.endDate;
      const startWindowEnd = new Date(periodStart.getTime());
      startWindowEnd.setDate(periodStart.getDate() + Math.min(13, Math.max(0, Math.floor((panel.info.weeksInPeriod || 4) * 7 - 1))));
      const endWindowStart = new Date(periodEnd.getTime());
      endWindowStart.setDate(periodEnd.getDate() - Math.min(13, Math.max(0, Math.floor((panel.info.weeksInPeriod || 4) * 7 - 1))));

      const firstWindowDays = visitDays.filter((d) => d.date.getTime() <= startWindowEnd.getTime());
      const lastWindowDays = visitDays.filter((d) => d.date.getTime() >= endWindowStart.getTime());
      const firstAuditDays = auditDays.filter((d) => d.date.getTime() <= startWindowEnd.getTime());

      // helper to pick a day from a candidate list trying to achieve spacing constraints
      const pickBestDay = (
        candidates: PeriodDay[],
        avoidDates: Date[] = [],
        preferWithin?: { start?: Date; end?: Date },
      ) => {
        if (!candidates.length) return null;
        // prefer days that satisfy spacing >=10 days from all avoidDates and fall within preferWithin if provided
        const ideal = candidates.filter((c) => {
          if (preferWithin) {
            if (preferWithin.start && c.date.getTime() < preferWithin.start.getTime()) return false;
            if (preferWithin.end && c.date.getTime() > preferWithin.end.getTime()) return false;
          }
          for (const ad of avoidDates) {
            const diffDays = Math.abs((c.date.getTime() - ad.getTime()) / DAY_MS);
            if (diffDays < 10) return false;
          }
          return true;
        });
        if (ideal.length) return ideal[0];

        // fallback: pick candidate with max min-distance to avoidDates
        let best: PeriodDay | null = null;
        let bestMin = -1;
        for (const c of candidates) {
          const minDist = avoidDates.length
            ? Math.min(...avoidDates.map((ad) => Math.abs((c.date.getTime() - ad.getTime()) / DAY_MS)))
            : Infinity;
          if (minDist > bestMin) {
            bestMin = minDist;
            best = c;
          }
        }
        return best;
      };

      // schedule per the period rules
      // for each shop, place required items in windows with spacing 10-14 days where possible
      for (const shop of shops) {
        const shopReqs: Record<string, number> = {};
        Object.keys(perShopReq).forEach((k) => (shopReqs[k] = perShopReq[k] ?? 0));

        // helper to get already scheduled dates for this shop
        const scheduledDatesForShop = () =>
          Object.values(newMap)
            .flat()
            .filter((e) => e.shopId === shop && e.visitType !== "Off")
            .map((e) => e.date)
            .sort((a, b) => a.getTime() - b.getTime());

        // incorporate historical entries (from props) to avoid too-close visits across periods
        const historicalDatesForShop = ((): Date[] => {
          try {
            const hist = (historicalEntriesProp ?? [])
              .filter((e) => e.shopId === shop && e.visitType !== "Off")
              .map((e) => e.date)
              .sort((a, b) => a.getTime() - b.getTime());
            return hist;
          } catch (err) {
            void err;
            return [] as Date[];
          }
        })();

        // If Plan To Win required, prefer first window (prefer week 1 then week2)
        if ((shopReqs["Plan To Win"] ?? 0) > 0) {
          const prefer = { start: periodStart, end: (() => { const d = new Date(periodStart); d.setDate(d.getDate() + 6); return d; })() };
          let day = pickBestDay(firstWindowDays.filter((d) => firstWindowDays.includes(d)), [...scheduledDatesForShop(), ...historicalDatesForShop], prefer);
          if (!day) day = pickBestDay(firstWindowDays, [...scheduledDatesForShop(), ...historicalDatesForShop]);
          if (day) pushEntry(day, shop, "Plan To Win");
        }

        // If Quarterly Audit required, schedule in first window audit days
        if ((shopReqs["Quarterly Audit"] ?? 0) > 0) {
          let day = pickBestDay(firstAuditDays, [...scheduledDatesForShop(), ...historicalDatesForShop], { start: periodStart, end: startWindowEnd });
          if (!day) day = pickBestDay(auditDays, [...scheduledDatesForShop(), ...historicalDatesForShop]);
          if (day) pushEntry(day, shop, "Quarterly Audit");
        }

        // Standard Visit handling: could be 1 or 2 per shop depending on period
        const standardCount = shopReqs["Standard Visit"] ?? 0;
        if (standardCount === 1) {
          // If there is an audit or PTW also scheduled, place Standard in last two weeks
          const avoid = [...scheduledDatesForShop(), ...historicalDatesForShop];
          let day = pickBestDay(lastWindowDays, avoid);
          if (!day) day = pickBestDay(visitDays, avoid);
          if (day) pushEntry(day, shop, "Standard Visit");
        } else if (standardCount >= 2) {
          // aim to space two visits 10-14 days apart: first in first window, second in last window
          const avoid = [...scheduledDatesForShop(), ...historicalDatesForShop];
          let firstDay = pickBestDay(firstWindowDays, avoid);
          if (!firstDay) firstDay = pickBestDay(visitDays, []);
          if (firstDay) {
            pushEntry(firstDay, shop, "Standard Visit");
            // second pick should be 10-14 days after firstDay
            const desiredMin = new Date(firstDay.date.getTime());
            desiredMin.setDate(desiredMin.getDate() + 10);
            const desiredMax = new Date(firstDay.date.getTime());
            desiredMax.setDate(desiredMax.getDate() + 14);
            const secondCandidates = lastWindowDays.filter((d) => d.date.getTime() >= desiredMin.getTime() && d.date.getTime() <= desiredMax.getTime());
            // include historical dates in avoidance for second pick as well
            const avoidSecond = [firstDay.date, ...historicalDatesForShop];
            let secondDay = pickBestDay(secondCandidates, avoidSecond);
            if (!secondDay) secondDay = pickBestDay(lastWindowDays, avoidSecond);
            if (!secondDay) secondDay = pickBestDay(visitDays.filter((d) => d.date.getTime() > firstDay.date.getTime()), avoidSecond);
            if (secondDay) pushEntry(secondDay, shop, "Standard Visit");
          }
        }
      }

      // Build grouped entries (already in newMap)
      setPanelOverrides((prev) => ({ ...prev, [panel.storageKey]: cloneEntriesMap(newMap) }));
      setClearedPanels((prev) => ({ ...prev, [panel.storageKey]: false }));
    },
    [historicalEntriesProp, setPanelOverrides, setClearedPanels],
  );

  const visibleVisitMix = visitMix.filter((mix) => mix.count > 0);
  const printCoverageNotes = coverageSummary.slice(0, 8);

  const nextPeriodAnchor = useMemo(() => {
    const d = new Date(activePeriodInfo.endDate);
    d.setDate(d.getDate() + 1);
    return d;
  }, [activePeriodInfo.endDate]);

  const yearStartAnchor = useMemo(() => new Date(today.getFullYear(), 0, 1), [today]);

  const panelsToRender = periodPanels;

  return (
    <Fragment>
      <style jsx global>{`
        @media print {
          @page {
            size: letter landscape;
            margin: 0.4in;
          }
          body {
            background: #fff !important;
            color: #020617 !important;
          }
          .dm-print-root {
            transform: scale(${PRINT_SCALE});
            transform-origin: top left;
            width: calc(100% / ${PRINT_SCALE});
          }
          .dm-print-root,
          .dm-print-root * {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .dm-print-surface {
            background: #fff !important;
            color: #020617 !important;
            border-color: #cbd5f5 !important;
            box-shadow: none !important;
          }
          .dm-period-panel {
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .dm-calendar-day {
            background: #fff !important;
            border-color: #cbd5f5 !important;
          }
          .dm-calendar-day .dm-visit-pill {
            background: #fff !important;
            border-color: #94a3b8 !important;
            color: #0f172a !important;
          }
        }
      `}</style>
      <div className="dm-print-root space-y-5 print:bg-white print:text-slate-900">
        <div className="dm-print-surface rounded-3xl border border-slate-800/70 bg-slate-950/70 p-4 print:border-slate-300 print:bg-white print:text-slate-900 print:shadow-none">
          <div className={`${printTarget ? "print:hidden" : ""} flex flex-wrap items-center justify-between gap-4`}>
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Dual-period workspace</p>
              <p className="mt-1 text-sm text-slate-300">
                Current + next period stay unlocked side-by-side. Print exports always include both without the dark background.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handlePrintDualView}
                className="rounded-full border border-emerald-400/60 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-emerald-100 transition hover:border-emerald-300"
              >
                Print 2-period view
              </button>
                <div className="inline-flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleSetYearView(yearViewMode === "two-month" ? "off" : "two-month")}
                    className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.25em] transition ${
                      yearViewMode === "two-month" ? "border-amber-300 bg-amber-500/10 text-amber-200" : "border-slate-700/70 text-slate-200"
                    }`}
                  >
                    {yearViewMode === "two-month" ? "Two-month: On" : "Two-month"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetYearView(yearViewMode === "full-year" ? "off" : "full-year")}
                    className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.25em] transition ${
                      yearViewMode === "full-year" ? "border-emerald-300 bg-emerald-500/10 text-emerald-200" : "border-slate-700/70 text-slate-200"
                    }`}
                  >
                    {yearViewMode === "full-year" ? "Full year: On" : "Full year"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCompactText((prev) => !prev)}
                    className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.25em] transition ${
                      compactText ? "border-cyan-300 bg-cyan-500/10 text-cyan-100" : "border-slate-700/70 text-slate-200"
                    }`}
                  >
                    {compactText ? "Compact: On" : "Compact text"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAiWizardOpen(true)}
                    className="rounded-full border border-violet-300/70 bg-violet-500/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.25em] text-violet-100 transition hover:border-violet-200"
                  >
                    AI Schedule
                  </button>
                </div>
            </div>
          </div>

          <div className="mt-6 hidden print:block">
            <div className="rounded-2xl border border-slate-300 bg-white/95 p-4 text-slate-900">
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-700">Print recap summary</p>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Visit stats</p>
                <ul className="mt-2 space-y-1 text-[12px]">
                  <li className="flex items-center justify-between border-b border-slate-200 pb-1">
                    <span>Days scheduled</span>
                    <span className="font-semibold">{totalVisits}</span>
                  </li>
                  <li className="flex items-center justify-between border-b border-slate-200 pb-1">
                    <span>Admin / project</span>
                    <span className="font-semibold">{adminBlocks}</span>
                  </li>
                  <li className="flex items-center justify-between">
                    <span>Coverage goal</span>
                    <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-600">
                      {coverageHighlight}
                    </span>
                  </li>
                </ul>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Visit mix</p>
                <ul className="mt-2 space-y-1 text-[12px]">
                  {visibleVisitMix.map((mix) => (
                    <li key={`print-mix-${mix.type}`} className="flex items-center justify-between">
                      <span>{mix.type}</span>
                      <span className="font-semibold text-slate-700">{mix.count}</span>
                    </li>
                  ))}
                  {!visibleVisitMix.length && <li className="text-slate-500">No visits captured yet.</li>}
                </ul>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Required visits</p>
                <ul className="mt-2 space-y-1 text-[12px]">
                  {dueChecklist.map((item) => (
                    <li key={`print-due-${item.type}`} className="flex items-center justify-between">
                      <span>{item.type}</span>
                      <span className="font-semibold">
                        {item.actual}/{item.required}
                      </span>
                    </li>
                  ))}
                  {!dueChecklist.length && <li className="text-slate-500">No checklist requirements.</li>}
                </ul>
              </div>
            </div>
            {printCoverageNotes.length > 0 && (
              <div className="mt-4 border-t border-slate-200 pt-3">
                <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Coverage notes</p>
                <div className="mt-2 flex flex-wrap justify-center gap-2 text-[11px] text-slate-700">
                  {printCoverageNotes.map((shop) => (
                    <span key={`print-coverage-${shop.shopId}`} className="rounded-full border border-slate-300 px-3 py-1">
                      {shop.label}: {shop.count} visits
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
      <VisitPlanModal
        open={visitModal.open}
        onOpenChange={(open) => setVisitModal((prev) => ({ ...prev, open }))}
        date={visitModal.date}
        shopNumber={visitModal.shop}
        initialVisit={visitModal.initial}
        onSaved={() => {
          setSelectedDayDetail(null);
          setVisitModal((prev) => ({ ...prev, initial: undefined }));
        }}
      />
      <AIScheduleAssumptionsModal
        open={aiWizardOpen}
        onOpenChange={setAiWizardOpen}
        onGenerate={async ({ periodId, assumptions }) => {
          await fetch("/api/dm-schedule/ai-generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              periodId,
              scope: { shopNumbers: DM_COVERAGE_SHOPS.map((s) => Number(s)) },
              assumptions,
            }),
          }).catch((err) => console.error("ai generate failed", err));
        }}
      />

        {selectedDayDetail && (
          <DayVisitQuickPanel
            day={selectedDayDetail.day}
            entries={selectedDayDetail.entries}
            onClose={handleCloseDayDetail}
            onEdit={handleEditVisit}
            onAdd={handleAddVisit}
            defaultShop={shopNumber}
          />
        )}

        {yearViewMode === "two-month" && (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <DmCoverageTracker
              scale={1}
              scheduleEntries={undefined}
              calendarGrid={undefined}
              periodInfo={undefined}
              entriesByDate={undefined}
              visitMix={visitMix}
              dueChecklist={dueChecklist}
              coverageSummary={coverageSummary}
            />
            <div>
              <DmCoverageTracker
                scale={1}
                scheduleEntries={undefined}
                calendarGrid={undefined}
                periodInfo={undefined}
                entriesByDate={undefined}
                visitMix={visitMix}
                dueChecklist={dueChecklist}
                coverageSummary={coverageSummary}
                // show tracker anchored to next period
                anchorDate={nextPeriodAnchor}
              />
            </div>
          </div>
        )}

        {yearViewMode === "full-year" && (
          <div className="mt-4">
            <DmCoverageTracker
              scale={0.95}
              scheduleEntries={undefined}
              calendarGrid={undefined}
              periodInfo={undefined}
              entriesByDate={undefined}
              visitMix={visitMix}
              dueChecklist={dueChecklist}
              coverageSummary={coverageSummary}
              anchorDate={yearStartAnchor}
            />
          </div>
        )}

        <div className="mt-4 space-y-4">
          {panelsToRender.map((panel) => {
            const hideDuringPrint = Boolean(printTarget && printTarget !== "dual" && printTarget !== panel.storageKey);
            const isCleared = Boolean(clearedPanels[panel.storageKey]);
            const overrideEntries = panelOverrides[panel.storageKey];
            const entryLookup = isCleared ? {} : overrideEntries ?? panel.entries;
            const flattenedEntries = Object.values(entryLookup).flat();
            const panelCoverage = buildCoverageSummary(flattenedEntries);
            const entryTypeCounts = flattenedEntries.reduce<Record<string, number>>((acc, entry) => {
              acc[entry.visitType] = (acc[entry.visitType] ?? 0) + 1;
              return acc;
            }, {});
            const panelVisitCount = flattenedEntries.filter((entry) => entry.visitType !== "Off").length;
            const totalRequired = panel.dueSummary.reduce((sum, due) => sum + due.count, 0);
            const totalScheduled = panel.dueSummary.reduce(
              (sum, due) => sum + (entryTypeCounts[due.type] ?? 0),
              0,
            );
            const auditHeadline = totalRequired > 0 ? `${totalScheduled}/${totalRequired}` : `${totalScheduled}`;
            const periodRangeLabel = formatPeriodRangeLabel(panel.info.startDate, panel.info.endDate);
            const isCopySource = copyBuffer?.storageKey === panel.storageKey;
            return (
              <div
                key={panel.storageKey}
                className={`dm-period-panel dm-print-surface rounded-2xl border border-white/5 bg-slate-950/60 p-3 md:p-4 print:border-slate-300 print:bg-white print:text-slate-900 ${hideDuringPrint ? "print:hidden" : ""}`}
              >
                <div>
                  <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">{panel.label}</p>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold text-white">
                      <span className="dm-print-surface rounded-full border border-emerald-300/80 bg-gradient-to-r from-emerald-500/50 via-teal-500/30 to-cyan-500/20 px-6 py-2 text-base font-bold uppercase tracking-[0.45em] text-emerald-50 shadow-lg shadow-emerald-500/30 print:border-slate-400 print:bg-white print:text-slate-900">
                        Period {panel.info.period}
                      </span>
                      <div className="flex flex-wrap items-center gap-2 text-[10px]">
                        <button
                          type="button"
                          onClick={() =>
                            handleSubmitToRd(
                              panel,
                              flattenedEntries,
                              panelCoverage,
                              auditHeadline,
                              periodRangeLabel,
                              entryTypeCounts,
                              panelVisitCount,
                            )
                          }
                          className="rounded-full border border-cyan-400/70 px-5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.25em] text-cyan-100 transition hover:border-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 print:border-slate-400 print:bg-white print:text-slate-900"
                        >
                          Submit to RD
                        </button>
                        <button
                          type="button"
                          onClick={handleConfigureRdEmail}
                          className="text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-400 underline-offset-4 transition hover:text-emerald-200"
                        >
                          {rdEmail ? "Update email" : "Set RD email"}
                        </button>
                        {rdEmail && (
                          <span className="text-[10px] font-normal text-slate-400"> {rdEmail}</span>
                        )}
                      </div>
                      <span className="text-[11px] font-normal text-slate-200">
                        {panel.role === "current" ? `Period ending ${periodRangeLabel}` : periodRangeLabel}
                        <span className="ml-3 font-semibold text-white">Days scheduled: {panelVisitCount}</span>
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2 print:hidden">
                      <button
                        type="button"
                        onClick={handlePrintDualView}
                        className="rounded-full border border-slate-700/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-200 transition hover:border-amber-300"
                        aria-label="Print dual-period schedule"
                      >
                        Print dual view
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCopyPaste(panel)}
                        className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] transition ${
                          isCopySource
                            ? "border-cyan-300 bg-cyan-500/20 text-cyan-100"
                            : "border-slate-700/70 text-slate-200 hover:border-cyan-300"
                        }`}
                      >
                        Copy/Paste
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAiSchedule(panel)}
                        className="rounded-full border border-violet-400/50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-violet-200 transition hover:border-violet-300"
                      >
                        AI schedule
                      </button>
                      <button
                        type="button"
                        onClick={() => handleClearToggle(panel)}
                        className="rounded-full border border-cyan-400/50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-cyan-200 transition hover:border-cyan-300"
                      >
                        {isCleared ? "Restore period" : "Clear period"}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="dm-print-surface mt-4 rounded-2xl border border-slate-800/60 bg-slate-900/30 p-3 print:border-slate-300 print:bg-white print:text-slate-900">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">
                          Shop coverage this period
                        </p>
                        {visibleVisitMix.length > 0 ? (
                          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                            <span className="font-semibold text-emerald-200">Visit mix:&nbsp;</span>
                            <span className="text-slate-200">
                              {visibleVisitMix.map((mix) => `${mix.type}  ${mix.count}`).join(" · ")}
                            </span>
                          </p>
                        ) : (
                          <p className="text-[10px] uppercase tracking-[0.3em] text-slate-600">Visit mix pending</p>
                        )}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {panelCoverage.map((shop) => (
                          <span
                            key={`${panel.storageKey}-coverage-${shop.shopId}`}
                            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] text-slate-100 print:border-slate-300 print:bg-white print:text-slate-900 ${shop.toneClass}`}
                          >
                            <span className="font-semibold text-white/90">{shop.label}</span>
                            <span className="text-slate-200">{shop.count} visits</span>
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="dm-print-surface rounded-2xl border border-slate-800/60 bg-slate-900/40 p-3 text-left text-slate-200 print:border-slate-300 print:bg-white print:text-slate-900 lg:w-64">
                      <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">
                        Required audits scheduled <span className="text-emerald-200">{auditHeadline}</span>
                      </p>
                      <ul className="mt-2 space-y-1 text-[11px]">
                        {panel.dueSummary.map((item) => {
                          const scheduled = entryTypeCounts[item.type] ?? 0;
                          const metRequirement = scheduled >= item.count;
                          return (
                            <li
                              key={`${panel.storageKey}-${item.type}`}
                              className="flex items-center justify-between gap-4"
                            >
                              <span>{item.type}</span>
                              <span className={metRequirement ? "text-emerald-300" : "text-slate-500"}>
                                {scheduled}/{item.count}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </div>
                </div>
                {renderCalendar(panel.grid, entryLookup, panel.storageKey)}
              </div>
            );
          })}
        </div>
        {showLegend && (
          <div className={`${printTarget ? "print:hidden" : ""} mt-3 flex flex-wrap gap-3 text-[10px] text-slate-400`}>
            <span className="inline-flex items-center gap-1">
              <span className={`h-2 w-2 rounded-full ${DM_STATUS_DOTS.complete}`} /> Complete
            </span>
            <span className="inline-flex items-center gap-1">
              <span className={`h-2 w-2 rounded-full ${DM_STATUS_DOTS.locked}`} /> Locked
            </span>
            <span className="inline-flex items-center gap-1">
              <span className={`h-2 w-2 rounded-full ${DM_STATUS_DOTS.planned}`} /> Planned
            </span>
          </div>
        )}
      </div>
    </Fragment>
  );
}

export type DmCoverageTrackerProps = PlannerDataInputs & { scale?: number; anchorDate?: Date };

export function DmCoverageTracker({ scale = 1, anchorDate, ...props }: DmCoverageTrackerProps) {
  const {
    activePeriodInfo,
    coverageSummary,
    dueChecklist,
    visitMix,
    coverageHighlight,
    totalVisits,
    adminBlocks,
    coverageMix,
  } = useDmSchedulePlannerData(props, anchorDate);
  const coverageTiles = coverageSummary.slice(0, 12);

  const card = (
    <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-4 text-white">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-white/60">Coverage + tracker</p>
          <p className="text-xs text-white/80">Mirror the mobile locks and visit pacing.</p>
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-[0.25em] text-cyan-200">{coverageHighlight}</span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-3 text-white/85">
          <p className="text-[10px] uppercase tracking-[0.3em] text-white/60">Days scheduled</p>
          <p className="mt-1 text-2xl font-semibold text-white">{totalVisits}</p>
          <p className="text-[10px] text-white/55">Target 12</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-3 text-white/85">
          <p className="text-[10px] uppercase tracking-[0.3em] text-white/60">Admin / project</p>
          <p className="mt-1 text-2xl font-semibold text-white">{adminBlocks}</p>
          <p className="text-[10px] text-white/55">Home office days</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-3 text-white/85">
          <p className="text-[10px] uppercase tracking-[0.3em] text-white/60">Period</p>
          <p className="mt-1 text-lg font-semibold text-white">
            {activePeriodInfo.weekOfPeriod}/{activePeriodInfo.weeksInPeriod} weeks
          </p>
          <p className="text-[10px] text-white/55">Live pacing</p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-3 text-white/85">
          <p className="text-[10px] uppercase tracking-[0.3em] text-white/65">Required visits</p>
          <ul className="mt-2 space-y-2">
            {dueChecklist.map((item) => (
              <li
                key={item.type}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-900/40 px-3 py-2"
              >
                <div>
                  <p className="text-[11px] text-white/70">{item.type}</p>
                  <p className="text-sm font-semibold text-white">
                    {item.actual} / {item.required}
                  </p>
                </div>
                <span className={`text-[10px] font-semibold ${item.met ? "text-emerald-300" : "text-amber-300"}`}>
                  {item.met ? "On target" : "Need locks"}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-3 text-white/85">
          <p className="text-[10px] uppercase tracking-[0.3em] text-white/65">Visit mix</p>
          <ul className="mt-2 space-y-2 text-sm text-white/85">
            {visitMix.map((mix) => (
              <li key={mix.type} className="flex items-center justify-between">
                <span>{mix.type}</span>
                <span className="text-white/65">{mix.count}</span>
              </li>
            ))}
            {!visitMix.length && <li className="text-white/60">No visits logged yet.</li>}
          </ul>
        </div>
      </div>

      <div className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[10px] uppercase tracking-[0.3em] text-white/65">Shop coverage grid</p>
          <p className="text-[10px] text-white/60">Showing up to 12 shops</p>
        </div>
        {coverageTiles.length ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {coverageTiles.map((shop) => (
              <Tooltip
                key={shop.shopId}
                content={
                  <div className="space-y-1 text-sm text-white">
                    <p className="font-semibold">{shop.label}</p>
                    <p className="text-white/80">
                      Scheduled: {coverageMix[String(shop.shopId)]?.standard ?? 0} Standard •{" "}
                      {coverageMix[String(shop.shopId)]?.quarterly ?? 0} Quarterly •{" "}
                      {coverageMix[String(shop.shopId)]?.admin ?? 0} Admin •{" "}
                      {coverageMix[String(shop.shopId)]?.plan ?? 0} Plan To Win
                    </p>
                    <p className="text-white/60">
                      {coverageMix[String(shop.shopId)]?.total ? "Live mix" : "No visits scheduled yet"}
                    </p>
                  </div>
                }
              >
                <div
                  className={`flex min-h-[80px] flex-col justify-between rounded-2xl border border-white/10 px-3 py-2 text-left ${shop.toneClass}`}
                >
                  <div>
                    <p className="text-[11px] text-white/80">{shop.label}</p>
                    <p className="text-lg font-semibold text-white">{shop.count} visits</p>
                  </div>
                  <p className={`text-[10px] font-semibold ${shop.badgeClass}`}>{shop.statusLabel}</p>
                </div>
              </Tooltip>
            ))}
          </div>
        ) : (
          <div className="mt-3 rounded-2xl border border-dashed border-white/15 bg-slate-900/40 p-4 text-sm text-white/70">
            Map shops to see coverage pacing.
          </div>
        )}
      </div>
    </div>
  );

  if (scale !== 1) {
    const s = String(scale).replace('.', '_').replace(/[^0-9_\-]/g, '');
    return (
      <div className="flex justify-center">
        <style>{`.dm-scale-${s}{transform: scale(${scale}); transform-origin: top center;}`}</style>
        <div className={`w-full dm-scale-${s}`}>
          {card}
        </div>
      </div>
    );
  }

  return card;
}

type DayVisitQuickPanelProps = {
  day: PeriodDay;
  entries: SampleScheduleEntry[];
  onClose: () => void;
  onEdit: (entry: SampleScheduleEntry) => void;
  onAdd: (dayIso: string, shop: string, visitType: string) => void;
  defaultShop?: string | null;
};

const VISIT_TYPE_OPTIONS = Object.keys(DM_VISIT_BADGES);

function DayVisitQuickPanel({ day, entries, onClose, onEdit, onAdd, defaultShop }: DayVisitQuickPanelProps) {
  const [shopInput, setShopInput] = useState(() => entries[0]?.shopId ?? defaultShop ?? "");
  const [visitTypeInput, setVisitTypeInput] = useState(() => entries[0]?.visitType ?? VISIT_TYPE_OPTIONS[0] ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);

   
  useEffect(() => {
    setShopInput(entries[0]?.shopId ?? defaultShop ?? "");
    setVisitTypeInput(entries[0]?.visitType ?? VISIT_TYPE_OPTIONS[0] ?? "");
  }, [entries, defaultShop]);
   

  const handleSubmit = useCallback(
    (event: FormEvent) => {
      event.preventDefault();
      if (!visitTypeInput) return;
      if (isSubmitting) return;
      setIsSubmitting(true);
      try {
        onAdd(day.iso, shopInput.trim(), visitTypeInput);
      } finally {
        // close the panel after initiating navigation; the component may unmount during route change
        onClose();
      }
    },
    [day.iso, visitTypeInput, shopInput, onAdd, onClose, isSubmitting],
  );

  const formattedDate = shortDateFormatter.format(day.date);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/70 px-4 py-10 backdrop-blur-sm print:hidden"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-xs rounded-3xl border border-slate-800/80 bg-slate-950/90 p-4 text-slate-100 shadow-2xl shadow-black/40"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Quick add visit for ${formattedDate}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[10px] uppercase tracking-[0.35em] text-slate-500">Quick add visit</p>
            <h3 className="text-xl font-semibold text-white">{formattedDate}</h3>
            <p className="text-[11px] text-slate-500">Tap a lock to edit or drop a new one.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-700 px-2 py-0.5 text-[11px] uppercase tracking-[0.25em] text-slate-300"
            aria-label="Close quick add"
          >
            
          </button>
        </div>

        <div className="mt-3 space-y-2">
          <p className="text-[10px] uppercase tracking-[0.35em] text-slate-500">Existing visits</p>
          <div className="max-h-32 overflow-y-auto rounded-2xl border border-slate-800/70 bg-slate-900/40 p-2">
            {entries.length ? (
              <ul className="space-y-2 text-sm">
                {entries.map((entry) => (
                  <li
                    key={`${entry.iso}-${entry.shopId}-${entry.visitType}-${entry.locationLabel}`}
                    className="flex items-center justify-between gap-2 rounded-xl border border-slate-800/60 bg-slate-950/40 px-2 py-1.5"
                  >
                    <div>
                      <p className="text-xs font-semibold text-white">{entry.visitType}</p>
                      <p className="text-[11px] text-slate-400">{formatShopLabel(entry.locationLabel)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onEdit(entry)}
                      className="rounded-full border border-cyan-400/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-200"
                    >
                      Edit
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[12px] text-slate-500">No visits locked yet.</p>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <p className="text-[10px] uppercase tracking-[0.35em] text-slate-500">Add visit</p>
          <div className="space-y-1">
            <label className="text-[11px] text-slate-400" htmlFor="day-inline-shop">
              Shop number
            </label>
            <input
              id="day-inline-shop"
              type="text"
              value={shopInput}
              onChange={(event) => setShopInput(event.target.value)}
              placeholder="1501"
              className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-3 py-1.5 text-sm text-white placeholder:text-slate-600"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] text-slate-400" htmlFor="day-inline-visit-type">
              Visit type
            </label>
            <select
              id="day-inline-visit-type"
              value={visitTypeInput}
              onChange={(event) => setVisitTypeInput(event.target.value)}
              className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-3 py-1.5 text-sm text-white"
            >
              {VISIT_TYPE_OPTIONS.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="text-[11px] font-semibold text-slate-400 underline-offset-4"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`rounded-full border border-emerald-400/70 bg-emerald-500/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-200 ${
                isSubmitting ? "opacity-60 cursor-not-allowed" : ""
              }`}
            >
              {isSubmitting ? "Adding" : "Add visit"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}








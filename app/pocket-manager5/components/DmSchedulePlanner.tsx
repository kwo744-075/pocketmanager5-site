"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  DM_DAY_NAMES,
  DM_STATUS_DOTS,
  DM_VISIT_BADGES,
  buildCoverageSummary,
  buildPeriodGrid,
  buildSampleSchedule,
  buildDueChecklist,
  buildVisitMix,
  DAY_MS,
  DM_RUNNING_PERIOD_WINDOW,
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
  viewScope: "dmSchedule:viewScope",
  clearedPanels: "dmSchedule:clearedPanels",
  panelOverrides: "dmSchedule:panelOverrides",
  yearViewYear: "dmSchedule:yearViewYear",
} as const;

const PRINT_SCALE = 0.78;
const YEAR_VIEW_MIN_YEAR = 2026;
const YEAR_VIEW_MAX_YEAR = 2030;
const MIN_SCHEDULE_TIMESTAMP = Date.UTC(2026, 0, 1);

type RunningVisitMixEntry = {
  type: string;
  count: number;
  percentage: number;
};

type RunningVisitMixSummary = {
  entries: RunningVisitMixEntry[];
  totalVisits: number;
  label: string;
};

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
  weekProgress: number;
  visitCompletionPct: number;
  today: Date;
  runningVisitMixSummary: RunningVisitMixSummary;
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

  const activePeriodInfo = periodInfoProp ?? periodInfo;
  const activeCalendarGrid = calendarGridProp ?? calendarGrid;
  const activeEntries = scheduleEntriesProp ?? scheduleEntries;

  const derivedEntriesByDate = useMemo(
    () => entriesByDateProp ?? groupEntriesByDate(activeEntries),
    [entriesByDateProp, activeEntries],
  );

  const periodRange = useMemo(() => {
    if (periodRangeProp) return periodRangeProp;
    return `${shortDateFormatter.format(activePeriodInfo.startDate)} – ${shortDateFormatter.format(activePeriodInfo.endDate)}`;
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

  const historicalEntries = historicalEntriesProp;

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
    () => `${shortDateFormatter.format(nextPeriodInfo.startDate)} – ${shortDateFormatter.format(nextPeriodInfo.endDate)}`,
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

  const totalVisits = useMemo(
    () => activeEntries.filter((entry) => entry.visitType !== "Off").length,
    [activeEntries],
  );

  const adminBlocks = useMemo(
    () =>
      activeEntries.filter((entry) => entry.visitType === "Admin" || entry.visitType === "Project Day").length,
    [activeEntries],
  );

  const weekProgress = useMemo(() => {
    if (!activePeriodInfo.weeksInPeriod) return 0;
    return Math.min(100, Math.round((activePeriodInfo.weekOfPeriod / activePeriodInfo.weeksInPeriod) * 100));
  }, [activePeriodInfo.weekOfPeriod, activePeriodInfo.weeksInPeriod]);

  const visitCompletionPct = useMemo(() => {
    const required = dueChecklist.reduce((total, item) => total + item.required, 0);
    if (!required) return 0;
    const satisfied = dueChecklist.reduce((total, item) => total + Math.min(item.actual, item.required), 0);
    return Math.min(100, Math.round((satisfied / required) * 100));
  }, [dueChecklist]);

  const trailingPeriods = useMemo(() => {
    const periods: RetailPeriodInfo[] = [];
    let cursor = activePeriodInfo;
    for (let index = 0; index < DM_RUNNING_PERIOD_WINDOW; index += 1) {
      periods.push(cursor);
      const previousAnchor = new Date(cursor.startDate.getTime() - DAY_MS);
      cursor = getRetailPeriodInfo(previousAnchor);
    }
    return periods.reverse();
  }, [activePeriodInfo]);

  const runningVisitMixSummary = useMemo<RunningVisitMixSummary>(() => {
    if (!trailingPeriods.length) {
      return { entries: [], totalVisits: 0, label: "Running 12 periods" };
    }

    const earliest = trailingPeriods[0];
    const latest = trailingPeriods[trailingPeriods.length - 1];
    const rangeLabel = earliest && latest
      ? `${shortDateFormatter.format(earliest.startDate)} – ${shortDateFormatter.format(latest.endDate)}`
      : "Running 12 periods";

    const summarizeEntries = (entries: SampleScheduleEntry[]): RunningVisitMixSummary => {
      const totals: Record<string, number> = {};
      entries.forEach((entry) => {
        if (entry.visitType === "Off") return;
        totals[entry.visitType] = (totals[entry.visitType] ?? 0) + 1;
      });
      const totalVisits = Object.values(totals).reduce((sum, count) => sum + count, 0);
      const topEntries = Object.entries(totals)
        .map(([type, count]) => ({
          type,
          count,
          percentage: totalVisits ? Math.round((count / totalVisits) * 100) : 0,
        }))
        .sort((a, b) => b.percentage - a.percentage)
        .slice(0, 4);

      return {
        entries: topEntries,
        totalVisits,
        label: rangeLabel,
      };
    };

    const startTs = earliest.startDate.getTime();
    const endTs = latest.endDate.getTime();

    if (historicalEntries?.length) {
      const scopedEntries = historicalEntries.filter((entry) => {
        const entryTs = entry.date.getTime();
        return entryTs >= startTs && entryTs <= endTs;
      });
      if (scopedEntries.length) {
        return summarizeEntries(scopedEntries);
      }
    }

    const syntheticEntries: SampleScheduleEntry[] = [];
    trailingPeriods.forEach((info) => {
      const isActivePeriod =
        info.startDate.getTime() === activePeriodInfo.startDate.getTime() &&
        info.endDate.getTime() === activePeriodInfo.endDate.getTime();
      const entriesForPeriod = isActivePeriod
        ? activeEntries
        : buildSampleSchedule(info.startDate, info.weeksInPeriod);
      syntheticEntries.push(...entriesForPeriod);
    });

    return summarizeEntries(syntheticEntries);
  }, [trailingPeriods, historicalEntries, activeEntries, activePeriodInfo]);

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
    weekProgress,
    visitCompletionPct,
    runningVisitMixSummary,
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
  const [viewScope, setViewScope] = useState<"dual" | "year">("dual");
  const [printTarget, setPrintTarget] = useState<string | null>(null);
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

  const derivedDefaultYear = useMemo(() => {
    const fallbackYear = today.getFullYear();
    const baseYear = activePeriodInfo ? activePeriodInfo.endDate.getFullYear() : fallbackYear;
    const inferredYear = activePeriodInfo?.period === 12 ? baseYear + 1 : baseYear;
    const minYear = YEAR_VIEW_MIN_YEAR;
    return Math.min(YEAR_VIEW_MAX_YEAR, Math.max(minYear, inferredYear));
  }, [activePeriodInfo, today]);

  const [yearViewYear, setYearViewYear] = useState<number>(() => derivedDefaultYear);

  const clampYearValue = useCallback(
    (value: number) => {
      const minYear = YEAR_VIEW_MIN_YEAR;
      return Math.min(YEAR_VIEW_MAX_YEAR, Math.max(minYear, value));
    },
    [],
  );

  useEffect(() => {
    let isActive = true;
    defer(() => {
      if (!isActive) return;
      setYearViewYear((previous) => clampYearValue(previous));
      if (typeof window === "undefined") return;
      const storedYear = window.localStorage.getItem(STORAGE_KEYS.yearViewYear);
      if (!storedYear) return;
      const parsed = Number.parseInt(storedYear, 10);
      if (Number.isNaN(parsed)) return;
      setYearViewYear(clampYearValue(parsed));
    });
    return () => {
      isActive = false;
    };
  }, [clampYearValue, derivedDefaultYear]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEYS.yearViewYear, yearViewYear.toString());
  }, [yearViewYear]);

  const yearOptions = useMemo(() => {
    const startYear = YEAR_VIEW_MIN_YEAR;
    const options: number[] = [];
    for (let year = startYear; year <= YEAR_VIEW_MAX_YEAR; year += 1) {
      options.push(year);
    }
    return options;
  }, []);

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
        const storedScope = window.localStorage.getItem(STORAGE_KEYS.viewScope);
        if (storedScope === "dual" || storedScope === "year") {
          setViewScope(storedScope);
        }

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
      } catch (error) {
        console.warn("Unable to hydrate DM schedule state", error);
      }
    });
    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEYS.viewScope, viewScope);
  }, [viewScope]);

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

  const handleDaySelection = useCallback(
    (day: PeriodDay, entries: SampleScheduleEntry[]) => {
      if (!selectedDate) {
        setInternalSelectedDate(day.iso);
      }

      if (onDaySelect) {
        onDaySelect(day, entries);
      }

      setSelectedDayDetail({ day, entries });
    },
    [selectedDate, onDaySelect],
  );

  const handleCloseDayDetail = useCallback(() => {
    setSelectedDayDetail(null);
  }, []);

  const handleEditVisit = useCallback(
    (entry: SampleScheduleEntry) => {
      const params = new URLSearchParams({ date: entry.iso });
      if (entry.shopId) {
        params.set("shop", entry.shopId);
      }
      router.push(`/pocket-manager5/forms/${computedFormSlug}?${params.toString()}`);
    },
    [router, computedFormSlug],
  );

  const handleAddVisit = useCallback(
    (dayIso: string, shop: string, visitType: string) => {
      const params = new URLSearchParams({ date: dayIso });
      if (shop) {
        params.set("shop", shop);
      }
      if (visitType) {
        params.set("visitType", visitType);
      }
      if (shopNumber && !params.has("shop")) {
        params.set("shop", shopNumber);
      }
      router.push(`/pocket-manager5/forms/${computedFormSlug}?${params.toString()}`);
    },
    [router, computedFormSlug, shopNumber],
  );

  const renderCalendar = useCallback(
    (grid: PeriodDay[][], entryLookup: Record<string, SampleScheduleEntry[]>, panelKey: string) => {
      const MAX_VISIBLE = 3;
      return (
        <div className="mt-4 rounded-2xl border border-slate-900/30 bg-slate-950/30 p-3 print:border-slate-300 print:bg-white print:text-slate-900">
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
                  const isSelected = activeSelectedDate === day.iso;
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
                      onClick={() => handleDaySelection(day, dayEntries)}
                      className={`rounded-2xl border px-2 py-2 text-left text-slate-100 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 print:border-slate-300 print:bg-white print:text-slate-900 ${cardTone}`}
                    >
                      <div className="flex items-center justify-between text-[11px] font-semibold">
                        <span className={dayLabelTone}>{day.dayNumber}</span>
                        <div className="flex gap-1 text-[9px] uppercase tracking-[0.25em]">
                          {day.isToday && <span className="text-emerald-300">Today</span>}
                          {isSelected && !day.isToday && <span className="text-cyan-300">Editing</span>}
                        </div>
                      </div>
                      <div className="mt-1 space-y-1">
                        {visibleEntries.map((entry) => (
                          <div
                            key={`${panelKey}-${entry.iso}-${entry.visitType}-${entry.locationLabel}`}
                            className={`flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold leading-none print:border-slate-300 print:bg-white print:text-slate-900 ${
                              DM_VISIT_BADGES[entry.visitType] ?? "border-slate-700/60 text-slate-200"
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                entry.status ? DM_STATUS_DOTS[entry.status] : DM_STATUS_DOTS.planned
                              }`}
                            />
                            <div className="flex w-full items-center justify-between gap-2">
                              <span className="truncate">{formatShopLabel(entry.locationLabel)}</span>
                              <span className="text-right uppercase text-white/80">{entry.visitType}</span>
                            </div>
                          </div>
                        ))}
                        {overflow > 0 && <p className="text-[9px] text-slate-500">+{overflow} more</p>}
                        {dayEntries.length === 0 && <p className="text-[9px] text-slate-600">Open</p>}
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
    [activeSelectedDate, handleDaySelection],
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

  const handlePrintPanel = useCallback((panel: PlannerPeriodPanel) => {
    setPrintTarget(panel.storageKey);
  }, []);

    const yearPanels = useMemo<PlannerPeriodPanel[]>(() => {
      if (!yearViewYear) return [];

      const startOfYear = new Date(yearViewYear, 0, 1);
      let anchorInfo = getRetailPeriodInfo(startOfYear);
      let guard = 0;
      while (
        guard < 24 &&
        (anchorInfo.period !== 1 || anchorInfo.startDate.getFullYear() < yearViewYear)
      ) {
        const nextAnchor = new Date(anchorInfo.endDate.getTime() + DAY_MS);
        anchorInfo = getRetailPeriodInfo(nextAnchor);
        guard += 1;
      }

      const panels: PlannerPeriodPanel[] = [];
      let cursorInfo = anchorInfo;
      for (let idx = 0; idx < 12; idx += 1) {
        const storageKey = getPeriodStorageKey(cursorInfo);
        const existingPanel = periodPanels.find(
          (panel) => panel.storageKey === storageKey,
        );

        if (existingPanel) {
          panels.push({
            ...existingPanel,
            storageKey,
            role: "year",
            label: `Period ${cursorInfo.period}`,
          });
        } else {
          const syntheticEntries = buildSampleSchedule(cursorInfo.startDate, cursorInfo.weeksInPeriod);
          panels.push({
            storageKey,
            role: "year",
            label: `Period ${cursorInfo.period}`,
            info: cursorInfo,
            grid: buildPeriodGrid(cursorInfo.startDate, cursorInfo.weeksInPeriod, today),
            entries: groupEntriesByDate(syntheticEntries),
            dueSummary: summarizeDueVisits(cursorInfo.period),
            range: `${shortDateFormatter.format(cursorInfo.startDate)} – ${shortDateFormatter.format(cursorInfo.endDate)}`,
          });
        }

        const nextAnchor = new Date(cursorInfo.endDate.getTime() + DAY_MS);
        cursorInfo = getRetailPeriodInfo(nextAnchor);
      }

      return panels;
    }, [yearViewYear, periodPanels, today]);

  const visibleVisitMix = visitMix.filter((mix) => mix.count > 0);
  const printCoverageNotes = coverageSummary.slice(0, 8);

  const panelsToRender = viewScope === "year" ? yearPanels : periodPanels;

  const VIEW_SCOPE_OPTIONS: { id: "dual" | "year"; label: string }[] = [
    { id: "dual", label: "2 periods" },
    { id: "year", label: "Full year" },
  ];

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
        }
      `}</style>
      <div className="dm-print-root space-y-5">
        <div className="rounded-3xl border border-slate-800/70 bg-slate-950/70 p-4 print:border-slate-300 print:bg-white print:text-slate-900 print:shadow-none">
          <div className={`${printTarget ? "print:hidden" : ""} flex flex-wrap items-center justify-between gap-3`}>
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-slate-500">
                <span>Select year</span>
                <div className="flex flex-wrap gap-2 text-[12px] tracking-normal">
                  {yearOptions.map((year) => (
                    <button
                      key={`year-option-${year}`}
                      type="button"
                      onClick={() => setYearViewYear(year)}
                      className={`rounded-full border px-3 py-1 text-[12px] font-semibold transition ${
                        yearViewYear === year
                          ? "border-emerald-400/60 bg-emerald-400/10 text-emerald-200"
                          : "border-slate-800/70 text-slate-400 hover:border-slate-500/70"
                      }`}
                    >
                      {year}
                    </button>
                  ))}
                </div>
              </div>
              {viewScope !== "year" && (
                <span className="text-[9px] uppercase tracking-[0.2em] text-slate-600">Switch to full year to view all 12 panels</span>
              )}
            </div>
            <div className="inline-flex rounded-full border border-slate-800/70 bg-slate-900/50 p-0.5 text-[10px] font-semibold uppercase tracking-[0.25em]">
              {VIEW_SCOPE_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setViewScope(option.id)}
                  className={`rounded-full px-3 py-1 transition ${
                    viewScope === option.id ? "bg-slate-800 text-emerald-200" : "text-slate-500"
                  }`}
                >
                  {option.label}
                </button>
              ))}
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

        <div className="mt-4 space-y-4">
          {panelsToRender.map((panel) => {
            const hideDuringPrint = Boolean(printTarget && printTarget !== panel.storageKey);
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
                className={`rounded-2xl border border-white/5 bg-slate-950/60 p-3 md:p-4 print:border-slate-300 print:bg-white print:text-slate-900 ${hideDuringPrint ? "print:hidden" : ""}`}
              >
                <div>
                  <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">{panel.label}</p>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold text-white">
                      <span className="rounded-full bg-emerald-500/90 px-2.5 py-0.5 tracking-wide">Period {panel.info.period}</span>
                      <span className="rounded-full border border-cyan-400/70 px-2.5 py-0.5 uppercase tracking-wide text-cyan-200">
                        Submit to RD
                      </span>
                      <span className="text-[11px] font-normal text-slate-200">
                        {panel.role === "current" ? `Period ending ${periodRangeLabel}` : periodRangeLabel}
                        <span className="ml-3 font-semibold text-white">Days scheduled: {panelVisitCount}</span>
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2 print:hidden">
                      <button
                        type="button"
                        onClick={() => handlePrintPanel(panel)}
                        className="rounded-full border border-slate-700/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-200 transition hover:border-amber-300"
                        aria-label={`Print schedule for period ${panel.info.period}`}
                      >
                        Print
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
                        onClick={() => handleClearToggle(panel)}
                        className="rounded-full border border-cyan-400/50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-cyan-200 transition hover:border-cyan-300"
                      >
                        {isCleared ? "Restore period" : "Clear period"}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="mt-4 rounded-2xl border border-slate-800/60 bg-slate-900/30 p-3 print:border-slate-300 print:bg-white print:text-slate-900">
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
                              {visibleVisitMix.map((mix) => `${mix.type} – ${mix.count}`).join(" · ")}
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
                    <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-3 text-left text-slate-200 print:border-slate-300 print:bg-white print:text-slate-900 lg:w-64">
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

export type DmCoverageTrackerProps = PlannerDataInputs & { scale?: number };

export type DmVisitMixRunningSummaryProps = PlannerDataInputs & {
  className?: string;
  anchorDate?: Date;
};

export function DmVisitMixRunningSummary({ className, anchorDate, ...plannerInputs }: DmVisitMixRunningSummaryProps) {
  const { runningVisitMixSummary } = useDmSchedulePlannerData(plannerInputs, anchorDate);
  const { entries, totalVisits, label } = runningVisitMixSummary;

  return (
    <div
      className={`rounded-3xl border border-slate-800/80 bg-slate-950/70 p-4 shadow-2xl shadow-black/30 ${
        className ?? ""
      }`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Running 12 periods</p>
        <span className="text-[10px] text-slate-500">{label}</span>
      </div>
      <p className="mt-1 text-[11px] text-slate-400">{totalVisits} visits logged</p>
      <ul className="mt-3 space-y-2">
        {entries.map((entry) => (
          <li key={entry.type}>
            <div className="flex items-center justify-between text-sm text-slate-100">
              <span>{entry.type}</span>
              <span className="font-semibold text-emerald-200">{entry.percentage}%</span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-emerald-400"
                style={{ width: `${Math.min(100, Math.max(entry.percentage, 4))}%` }}
              />
            </div>
          </li>
        ))}
        {!entries.length && <li className="text-xs text-slate-500">No visit mix data yet.</li>}
      </ul>
    </div>
  );
}

export function DmCoverageTracker({ scale = 1, ...props }: DmCoverageTrackerProps) {
  const {
    activePeriodInfo,
    coverageSummary,
    dueChecklist,
    visitMix,
    coverageHighlight,
    totalVisits,
    adminBlocks,
    weekProgress,
    visitCompletionPct,
  } = useDmSchedulePlannerData(props);
  const coverageTiles = coverageSummary.slice(0, 12);

  const card = (
    <div className="rounded-3xl border border-slate-800/70 bg-slate-950/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Coverage + tracker</p>
          <p className="text-xs text-slate-300">Mirror the mobile locks and visit pacing.</p>
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-[0.25em] text-cyan-200">{coverageHighlight}</span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-800/70 bg-slate-950/60 p-2">
              <p className="text-[9px] uppercase tracking-[0.35em] text-slate-500">Days scheduled</p>
          <p className="mt-1 text-xl font-semibold text-white">{totalVisits}</p>
          <p className="text-[10px] text-slate-500">Target 12</p>
        </div>
        <div className="rounded-2xl border border-slate-800/70 bg-slate-950/60 p-2">
          <p className="text-[9px] uppercase tracking-[0.35em] text-slate-500">Admin / project</p>
          <p className="mt-1 text-xl font-semibold text-white">{adminBlocks}</p>
          <p className="text-[10px] text-slate-500">Home office days</p>
        </div>
        <div className="rounded-2xl border border-slate-800/70 bg-slate-950/60 p-2">
          <p className="text-[9px] uppercase tracking-[0.35em] text-slate-500">Week progress</p>
          <p className="text-xs text-slate-400">
            W{activePeriodInfo.weekOfPeriod} / {activePeriodInfo.weeksInPeriod}
          </p>
          <div className="mt-2 h-1.5 rounded-full bg-slate-800">
            <div className="h-full rounded-full bg-emerald-400" style={{ width: `${weekProgress}%` }} />
          </div>
        </div>
        <div className="rounded-2xl border border-slate-800/70 bg-slate-950/60 p-2">
          <p className="text-[9px] uppercase tracking-[0.35em] text-slate-500">Visit completion</p>
          <p className="text-xs text-slate-400">{visitCompletionPct}% to plan</p>
          <div className="mt-2 h-1.5 rounded-full bg-slate-800">
            <div className="h-full rounded-full bg-cyan-400" style={{ width: `${visitCompletionPct}%` }} />
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-800/70 bg-slate-950/60 p-3">
          <p className="text-[10px] uppercase tracking-[0.35em] text-slate-500">Required visits</p>
          <ul className="mt-2 space-y-2">
            {dueChecklist.map((item) => (
              <li
                key={item.type}
                className="flex items-center justify-between rounded-xl border border-slate-800/60 bg-slate-900/40 px-3 py-2"
              >
                <div>
                  <p className="text-[11px] text-slate-400">{item.type}</p>
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
        <div className="rounded-2xl border border-slate-800/70 bg-slate-950/60 p-3">
          <p className="text-[10px] uppercase tracking-[0.35em] text-slate-500">Visit mix</p>
          <ul className="mt-2 space-y-2 text-sm text-slate-200">
            {visitMix.map((mix) => (
              <li key={mix.type} className="flex items-center justify-between">
                <span>{mix.type}</span>
                <span className="text-slate-400">{mix.count}</span>
              </li>
            ))}
            {!visitMix.length && <li className="text-slate-500">No visits logged yet.</li>}
          </ul>
        </div>
      </div>

      <div className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[10px] uppercase tracking-[0.35em] text-slate-500">Shop coverage grid</p>
          <p className="text-[10px] text-slate-500">Showing up to 12 shops</p>
        </div>
        {coverageTiles.length ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {coverageTiles.map((shop) => (
              <div
                key={shop.shopId}
                className={`flex min-h-[110px] flex-col justify-between rounded-2xl border px-3 py-2 text-left ${shop.toneClass}`}
              >
                <div>
                  <p className="text-[11px] text-slate-200/80">{shop.label}</p>
                  <p className="text-xl font-semibold text-white">{shop.count} visits</p>
                </div>
                <p className={`text-[10px] font-semibold ${shop.badgeClass}`}>{shop.statusLabel}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-3 rounded-2xl border border-dashed border-slate-700/70 bg-slate-900/40 p-4 text-sm text-slate-400">
            Map shops to see coverage pacing.
          </div>
        )}
      </div>
    </div>
  );

  if (scale !== 1) {
    return (
      <div className="flex justify-center">
        <div
          style={{ transform: `scale(${scale})`, transformOrigin: "top center" }}
          className="w-full"
        >
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

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setShopInput(entries[0]?.shopId ?? defaultShop ?? "");
    setVisitTypeInput(entries[0]?.visitType ?? VISIT_TYPE_OPTIONS[0] ?? "");
  }, [entries, defaultShop]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleSubmit = useCallback(
    (event: FormEvent) => {
      event.preventDefault();
      if (!visitTypeInput) return;
      onAdd(day.iso, shopInput.trim(), visitTypeInput);
      onClose();
    },
    [day.iso, visitTypeInput, shopInput, onAdd, onClose],
  );

  return (
    <div className="print:hidden rounded-3xl border border-slate-800/80 bg-slate-950/70 p-5 shadow-2xl shadow-black/30">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.35em] text-slate-500">Quick add visit</p>
          <h3 className="text-2xl font-semibold text-white">{shortDateFormatter.format(day.date)}</h3>
          <p className="text-xs text-slate-500">Tap an existing visit to open the full form.</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-slate-700 px-3 py-1 text-[11px] uppercase tracking-[0.25em] text-slate-300"
        >
          Close
        </button>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-800/60 bg-slate-900/40 p-3">
        <p className="text-[10px] uppercase tracking-[0.35em] text-slate-500">Existing visits</p>
        {entries.length ? (
          <ul className="mt-3 space-y-2">
            {entries.map((entry) => (
              <li
                key={`${entry.iso}-${entry.shopId}-${entry.visitType}-${entry.locationLabel}`}
                className="flex items-center justify-between rounded-xl border border-slate-800/70 bg-slate-950/40 px-3 py-2 text-sm text-slate-100"
              >
                <div>
                  <p className="font-semibold">{entry.visitType}</p>
                  <p className="text-[12px] text-slate-400">{formatShopLabel(entry.locationLabel)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onEdit(entry)}
                  className="rounded-full border border-cyan-400/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-200"
                >
                  Edit
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-slate-500">No visits locked yet.</p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        <p className="text-[10px] uppercase tracking-[0.35em] text-slate-500">Add another visit</p>
        <div className="space-y-2">
          <label className="text-xs text-slate-400" htmlFor="day-inline-shop">
            Shop number
          </label>
          <input
            id="day-inline-shop"
            type="text"
            value={shopInput}
            onChange={(event) => setShopInput(event.target.value)}
            placeholder="1501"
            className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-600"
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs text-slate-400" htmlFor="day-inline-visit-type">
            Visit type
          </label>
          <select
            id="day-inline-visit-type"
            value={visitTypeInput}
            onChange={(event) => setVisitTypeInput(event.target.value)}
            className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white"
          >
            {VISIT_TYPE_OPTIONS.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-700 px-4 py-2 text-[12px] font-semibold text-slate-300"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded-full border border-emerald-400/70 bg-emerald-500/10 px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.2em] text-emerald-200"
          >
            Add visit
          </button>
        </div>
      </form>
    </div>
  );
}

"use client";

import { useCallback, useMemo, useState } from "react";
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
  groupEntriesByDate,
  getRetailPeriodInfo,
  getVisitRequirementsForPeriod,
  shortDateFormatter,
  type PeriodDay,
  type RetailPeriodInfo,
  type SampleScheduleEntry,
} from "./dmScheduleUtils";

const numericPeriodDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "numeric",
  day: "numeric",
  year: "numeric",
});

const formatPeriodRangeLabel = (start: Date, end: Date) =>
  `${numericPeriodDateFormatter.format(start)} - ${numericPeriodDateFormatter.format(end)}`;

export const useSampleScheduleData = () => {
  const today = useMemo(() => new Date(), []);
  const periodInfo = useMemo(() => getRetailPeriodInfo(today), [today]);
  const scheduleEntries = useMemo(
    () => buildSampleSchedule(periodInfo.startDate, periodInfo.weeksInPeriod),
    [periodInfo.startDate, periodInfo.weeksInPeriod],
  );
  const calendarGrid = useMemo(
    () => buildPeriodGrid(periodInfo.startDate, periodInfo.weeksInPeriod, today),
    [periodInfo.startDate, periodInfo.weeksInPeriod, today],
  );

  return {
    today,
    periodInfo,
    scheduleEntries,
    calendarGrid,
  } as const;
};

type DmSchedulePlannerProps = {
  scheduleEntries?: SampleScheduleEntry[];
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
  onPeriodClear?: (periodKey: "current" | "next", cleared: boolean) => void;
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
>;

type PlannerPeriodPanel = {
  key: "current" | "next";
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
  coverageHeadline: string;
  totalVisits: number;
  adminBlocks: number;
  weekProgress: number;
  visitCompletionPct: number;
};

const useDmSchedulePlannerData = (inputs: PlannerDataInputs = {}): PlannerData => {
  const { today, periodInfo, scheduleEntries, calendarGrid } = useSampleScheduleData();
  const {
    scheduleEntries: scheduleEntriesProp,
    calendarGrid: calendarGridProp,
    periodInfo: periodInfoProp,
    periodRange: periodRangeProp,
    entriesByDate: entriesByDateProp,
    visitMix: visitMixProp,
    dueChecklist: dueChecklistProp,
    coverageSummary: coverageSummaryProp,
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
        key: "current",
        label: "Current period",
        info: activePeriodInfo,
        grid: activeCalendarGrid,
        entries: derivedEntriesByDate,
        dueSummary: currentDueSummary,
        range: periodRange,
      },
      {
        key: "next",
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

  const coverageHeadline = useMemo(() => {
    if (!coverageSummary.length) return "No shops mapped";
    const shopsWithTwo = coverageSummary.filter((shop) => shop.count >= 2).length;
    return `${shopsWithTwo}/${coverageSummary.length} shops at 2+ visits`;
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

  return {
    activePeriodInfo,
    activeEntries,
    derivedEntriesByDate,
    periodPanels,
    visitMix,
    dueChecklist,
    coverageSummary,
    coverageHeadline,
    totalVisits,
    adminBlocks,
    weekProgress,
    visitCompletionPct,
  };
};

export function DmSchedulePlanner({
  scheduleEntries: scheduleEntriesProp,
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
  onPeriodClear,
}: DmSchedulePlannerProps) {
  const router = useRouter();
  const [internalSelectedDate, setInternalSelectedDate] = useState<string | null>(null);
  const [clearedPanels, setClearedPanels] = useState<Record<PlannerPeriodPanel["key"], boolean>>({
    current: false,
    next: false,
  });
  const { periodPanels, visitMix, coverageSummary, coverageHeadline } = useDmSchedulePlannerData({
    scheduleEntries: scheduleEntriesProp,
    calendarGrid: calendarGridProp,
    periodInfo: periodInfoProp,
    periodRange: periodRangeProp,
    entriesByDate: entriesByDateProp,
    visitMix: visitMixProp,
    dueChecklist: dueChecklistProp,
    coverageSummary: coverageSummaryProp,
  });

  const computedFormSlug = entryFormSlug ?? "dm-visit-plan";

  const handleClearToggle = useCallback(
    (panelKey: PlannerPeriodPanel["key"]) => {
      setClearedPanels((prev) => {
        const nextValue = !prev[panelKey];
        onPeriodClear?.(panelKey, nextValue);
        return { ...prev, [panelKey]: nextValue };
      });
    },
    [onPeriodClear],
  );

  const handleDaySelection = useCallback(
    (day: PeriodDay, entries: SampleScheduleEntry[]) => {
      if (onDaySelect) {
        onDaySelect(day, entries);
        return;
      }

      setInternalSelectedDate(day.iso);
      const params = new URLSearchParams();
      params.set("date", day.iso);
      if (shopNumber) {
        params.set("shop", shopNumber);
      }

      router.push(`/pocket-manager5/forms/${computedFormSlug}?${params.toString()}`);
    },
    [computedFormSlug, onDaySelect, router, shopNumber],
  );

  const activeSelectedDate = selectedDate ?? internalSelectedDate;

  const renderCalendar = useCallback(
    (grid: PeriodDay[][], entryLookup: Record<string, SampleScheduleEntry[]>, panelKey: string) => (
      <div className="mt-3 space-y-1.5">
        {grid.map((week, weekIdx) => (
          <div key={`${panelKey}-week-${weekIdx}`} className="grid grid-cols-7 gap-1.5">
            {week.map((day) => {
              const dayEntries = entryLookup[day.iso] ?? [];
              const visibleEntries = dayEntries.slice(0, 2);
              const overflow = Math.max(dayEntries.length - visibleEntries.length, 0);
              const isSelected = activeSelectedDate === day.iso;
              const focusRing = isSelected ? "ring-1 ring-cyan-300" : day.isToday ? "ring-1 ring-emerald-400/50" : "";
              const opacity = day.isPast && !day.isToday ? "opacity-80" : "";

              return (
                <button
                  key={`${panelKey}-${day.iso}`}
                  type="button"
                  onClick={() => handleDaySelection(day, dayEntries)}
                  className={`rounded-xl border border-slate-800/70 bg-slate-900/40 p-2 text-left transition hover:border-emerald-400/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300 ${focusRing} ${opacity}`}
                >
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span className={day.isPast ? "text-slate-600" : undefined}>{day.dayNumber}</span>
                    {day.isToday && <span className="text-[9px] font-semibold text-emerald-300">Today</span>}
                    {isSelected && !day.isToday && <span className="text-[9px] font-semibold text-cyan-300">Editing</span>}
                  </div>
                  <div className="mt-1 space-y-1">
                    {visibleEntries.map((entry) => (
                      <div
                        key={`${panelKey}-${entry.iso}-${entry.visitType}-${entry.locationLabel}`}
                        className={`flex items-center gap-1 rounded-full border px-1.5 py-0.5 ${
                          DM_VISIT_BADGES[entry.visitType] ?? "border-slate-700/60 text-slate-200"
                        }`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${DM_STATUS_DOTS[entry.status]}`} />
                        <div className="flex w-full items-center justify-between gap-2 text-[9px] font-semibold leading-none">
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
    ),
    [activeSelectedDate, handleDaySelection],
  );

  const visibleVisitMix = visitMix.filter((mix) => mix.count > 0);
  const coverageTiles = coverageSummary.slice(0, 6);

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-slate-800/70 bg-slate-950/70 p-4">
        {visibleVisitMix.length > 0 && (
          <p className="mb-4 text-[12px] text-slate-300">
            <span className="font-semibold uppercase tracking-[0.3em] text-emerald-200">Visit mix:&nbsp;</span>
            <span className="text-slate-100">
              {visibleVisitMix.map((mix) => `${mix.type} – ${mix.count}`).join(" · ")}
            </span>
          </p>
        )}
        <div className="grid grid-cols-7 gap-1 text-[10px] uppercase tracking-[0.3em] text-slate-500">
          {DM_DAY_NAMES.map((day) => (
            <span key={day} className="text-center">
              {day}
            </span>
          ))}
        </div>
        <div className="mt-3 space-y-4">
          {periodPanels.map((panel) => {
            const isCleared = clearedPanels[panel.key];
            const entryLookup = isCleared ? {} : panel.entries;
            const flattenedEntries = Object.values(entryLookup).flat();
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
            return (
              <div key={panel.key} className="rounded-2xl border border-white/5 bg-slate-950/60 p-3 md:p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">{panel.label}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-semibold text-white">
                      <span className="rounded-full bg-blue-500/90 px-2.5 py-0.5 tracking-wide">Q{panel.info.quarter}</span>
                      <span className="rounded-full bg-emerald-500/90 px-2.5 py-0.5 tracking-wide">P{panel.info.period}</span>
                      <span className="rounded-full bg-amber-500/90 px-2.5 py-0.5 tracking-wide">Wk{panel.info.weekOfPeriod}</span>
                    </div>
                    <p className="mt-2 text-[11px] text-slate-300">
                      {panel.key === "current" ? `Period ending ${periodRangeLabel}` : periodRangeLabel}
                    </p>
                    <p className="mt-1 text-xs text-slate-300">Visits locked: {panelVisitCount}</p>
                  </div>
                  <div className="flex flex-col items-end gap-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleClearToggle(panel.key)}
                      className="rounded-full border border-cyan-400/50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-cyan-200 transition hover:border-cyan-300"
                    >
                      {isCleared ? "Restore period" : "Clear period"}
                    </button>
                    <div className="min-w-[180px]">
                      <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">
                        Required audits scheduled {auditHeadline}
                      </p>
                      <ul className="mt-1 space-y-0.5 text-[11px] text-slate-200">
                        {panel.dueSummary.map((item) => {
                          const scheduled = entryTypeCounts[item.type] ?? 0;
                          const metRequirement = scheduled >= item.count;
                          return (
                            <li key={`${panel.key}-${item.type}`} className="flex items-center justify-between gap-2">
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
                {renderCalendar(panel.grid, entryLookup, panel.key)}
              </div>
            );
          })}
        </div>
        {showLegend && (
          <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-slate-400">
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
        {coverageTiles.length > 0 && (
          <div className="mt-6 space-y-3">
            <div className="flex flex-wrap items-center justify-between text-[10px] uppercase tracking-[0.3em] text-slate-500">
              <span>Shop coverage snapshot</span>
              <span className="text-emerald-200">{coverageHeadline}</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {coverageTiles.map((shop) => (
                <div
                  key={shop.shopId}
                  className={`rounded-2xl border border-slate-800/60 bg-slate-950/40 px-3 py-2 text-left ${shop.toneClass}`}
                >
                  <p className="text-[11px] text-slate-200/80">{shop.label}</p>
                  <p className="text-lg font-semibold text-white">{shop.count} visits</p>
                  <p className={`text-[10px] font-semibold ${shop.badgeClass}`}>{shop.statusLabel}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export type DmCoverageTrackerProps = PlannerDataInputs & { scale?: number };

export function DmCoverageTracker({ scale = 1, ...props }: DmCoverageTrackerProps) {
  const {
    activePeriodInfo,
    coverageSummary,
    dueChecklist,
    visitMix,
    coverageHeadline,
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
        <span className="text-[11px] font-semibold uppercase tracking-[0.25em] text-cyan-200">{coverageHeadline}</span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-800/70 bg-slate-950/60 p-2">
          <p className="text-[9px] uppercase tracking-[0.35em] text-slate-500">Visits locked</p>
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

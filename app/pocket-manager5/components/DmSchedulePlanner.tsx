"use client";

import { useMemo } from "react";
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
  shortDateFormatter,
  type PeriodDay,
  type RetailPeriodInfo,
  type SampleScheduleEntry,
} from "./dmScheduleUtils";

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
}: DmSchedulePlannerProps) {
  const { periodInfo, scheduleEntries, calendarGrid } = useSampleScheduleData();

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

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-slate-800/70 bg-slate-950/70 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
          <span className="font-semibold text-slate-200">Q{activePeriodInfo.quarter} · Period {activePeriodInfo.period}</span>
          <span>{periodRange}</span>
        </div>
        <div className="mt-4 grid grid-cols-7 gap-1 text-[10px] uppercase tracking-[0.3em] text-slate-500">
          {DM_DAY_NAMES.map((day) => (
            <span key={day} className="text-center">
              {day}
            </span>
          ))}
        </div>
        <div className="mt-2 space-y-1.5">
          {activeCalendarGrid.map((week, weekIdx) => (
            <div key={`week-${weekIdx}`} className="grid grid-cols-7 gap-1.5">
              {week.map((day) => {
                const dayEntries = derivedEntriesByDate[day.iso] ?? [];
                const visibleEntries = dayEntries.slice(0, 2);
                const overflow = Math.max(dayEntries.length - visibleEntries.length, 0);
                const isSelected = selectedDate === day.iso;
                const focusRing = isSelected ? "ring-1 ring-cyan-300" : day.isToday ? "ring-1 ring-emerald-400/50" : "";
                const opacity = day.isPast && !day.isToday ? "opacity-80" : "";

                return (
                  <button
                    key={day.iso}
                    type="button"
                    onClick={() => onDaySelect?.(day, dayEntries)}
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
                          key={`${entry.iso}-${entry.visitType}-${entry.locationLabel}`}
                          className={`flex items-center gap-1 rounded-full border px-1.5 py-0.5 ${
                            DM_VISIT_BADGES[entry.visitType] ?? "border-slate-700/60 text-slate-200"
                          }`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${DM_STATUS_DOTS[entry.status]}`} />
                          <span className="text-[9px] font-semibold leading-none">{entry.visitType}</span>
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
      </div>

      <div className="space-y-4">
        <div className="rounded-2xl border border-slate-800/70 bg-slate-950/60 p-4">
          <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Period tracker</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-slate-400">Visits locked</p>
              <p className="text-2xl font-semibold text-white">{totalVisits}</p>
              <p className="text-[11px] text-slate-500">Target 12</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Admin / project</p>
              <p className="text-2xl font-semibold text-white">{adminBlocks}</p>
              <p className="text-[11px] text-slate-500">Home office days</p>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <div>
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Week progress</span>
                <span>
                  W{activePeriodInfo.weekOfPeriod} / {activePeriodInfo.weeksInPeriod}
                </span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-slate-800">
                <div className="h-full rounded-full bg-emerald-400" style={{ width: `${weekProgress}%` }} />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Visit completion</span>
                <span>{visitCompletionPct}%</span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-slate-800">
                <div className="h-full rounded-full bg-cyan-400" style={{ width: `${visitCompletionPct}%` }} />
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800/70 bg-slate-950/60 p-4">
          <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Visit plan</p>
          <ul className="mt-3 space-y-2">
            {dueChecklist.map((item) => (
              <li
                key={item.type}
                className="flex items-center justify-between rounded-xl border border-slate-800/60 bg-slate-900/40 px-3 py-2"
              >
                <div>
                  <p className="text-xs text-slate-400">{item.type}</p>
                  <p className="text-sm font-semibold text-white">
                    {item.actual} / {item.required}
                  </p>
                </div>
                <span className={`text-[11px] font-semibold ${item.met ? "text-emerald-300" : "text-amber-300"}`}>
                  {item.met ? "On target" : "Need locks"}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-3 border-t border-slate-800/60 pt-3">
            <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Visit mix</p>
            <ul className="mt-2 space-y-1 text-sm text-slate-200">
              {visitMix.map((mix) => (
                <li key={mix.type} className="flex items-center justify-between">
                  <span>{mix.type}</span>
                  <span className="text-slate-400">{mix.count}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800/70 bg-slate-950/60 p-4">
          <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Coverage grid</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {coverageSummary.map((shop) => (
              <div key={shop.shopId} className={`rounded-2xl border px-3 py-2 ${shop.toneClass}`}>
                <p className="text-xs text-slate-300">{shop.label}</p>
                <p className="text-lg font-semibold text-white">{shop.count} visits</p>
                <p className={`text-[11px] font-semibold ${shop.badgeClass}`}>{shop.statusLabel}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

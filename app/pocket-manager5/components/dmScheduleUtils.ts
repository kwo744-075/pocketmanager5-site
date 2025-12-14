import { getRetailCalendarInfo } from "@/lib/retailTimestamp";

export const shortDateFormatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
export const DAY_MS = 24 * 60 * 60 * 1000;
export const DM_DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
export const DM_VISIT_BADGES: Record<string, string> = {
  "Plan To Win": "border-cyan-400/40 bg-cyan-500/10 text-cyan-100",
  "Standard Visit": "border-emerald-400/40 bg-emerald-500/10 text-emerald-100",
  "Quarterly Audit": "border-amber-400/40 bg-amber-500/10 text-amber-100",
  "Training Visit": "border-pink-400/40 bg-pink-500/10 text-pink-100",
  "1 on 1": "border-fuchsia-400/40 bg-fuchsia-500/10 text-fuchsia-100",
  Admin: "border-slate-500/50 bg-slate-500/10 text-slate-100",
  "Project Day": "border-sky-400/40 bg-sky-500/10 text-sky-100",
  "Full throttle Friday": "border-rose-400/40 bg-rose-500/10 text-rose-100",
  "Discussion Visit": "border-indigo-400/40 bg-indigo-500/10 text-indigo-100",
  Off: "border-slate-700/60 bg-slate-800/50 text-slate-300",
};

export const DM_STATUS_DOTS = {
  complete: "bg-emerald-300",
  locked: "bg-cyan-300",
  planned: "bg-slate-400",
} as const;

export const DM_SCHEDULE_LOCATIONS = {
  "1501": { label: "#1501 Mason", short: "Shop 1501" },
  "1502": { label: "#1502 Dayton", short: "Shop 1502" },
  "1503": { label: "#1503 Lima", short: "Shop 1503" },
  "1504": { label: "#1504 Perrysburg", short: "Shop 1504" },
  "1505": { label: "#1505 Oxford", short: "Shop 1505" },
  home: { label: "Home Office", short: "Home" },
} as const;

export type StaticScheduleLocationId = keyof typeof DM_SCHEDULE_LOCATIONS;
export type ScheduleLocationId = StaticScheduleLocationId | (string & {});
export const DM_COVERAGE_SHOPS: ScheduleLocationId[] = ["1501", "1502", "1503", "1504", "1505"];

export type ScheduleBlueprint = {
  week: number;
  weekday: number;
  shopId: ScheduleLocationId;
  visitType: string;
  focus: string;
  status: "planned" | "locked" | "complete";
};

export const DM_SCHEDULE_BLUEPRINT: ScheduleBlueprint[] = [
  { week: 0, weekday: 1, shopId: "1501", visitType: "Plan To Win", focus: "Launch PTW kit + scorecard", status: "complete" },
  { week: 0, weekday: 2, shopId: "home", visitType: "Admin", focus: "Payroll, invoices, supply follow-ups", status: "complete" },
  { week: 0, weekday: 3, shopId: "1502", visitType: "Standard Visit", focus: "Zero Zeros follow-up", status: "complete" },
  { week: 0, weekday: 4, shopId: "home", visitType: "1 on 1", focus: "ASM coaching + succession", status: "complete" },
  { week: 0, weekday: 5, shopId: "home", visitType: "Off", focus: "Travel buffer / family day", status: "locked" },
  { week: 1, weekday: 1, shopId: "1503", visitType: "Quarterly Audit", focus: "Full audit wave", status: "locked" },
  { week: 1, weekday: 3, shopId: "1504", visitType: "Standard Visit", focus: "Contest check + cadence", status: "locked" },
  { week: 1, weekday: 5, shopId: "1505", visitType: "Training Visit", focus: "New SM certification ride", status: "planned" },
  { week: 2, weekday: 2, shopId: "1502", visitType: "Discussion Visit", focus: "P&L deep dive", status: "planned" },
  { week: 2, weekday: 4, shopId: "home", visitType: "Project Day", focus: "Workbook cleanup + claims", status: "planned" },
  { week: 3, weekday: 1, shopId: "1501", visitType: "Standard Visit", focus: "Mid-period reset", status: "planned" },
  { week: 3, weekday: 3, shopId: "home", visitType: "Admin", focus: "Expense approvals + Solink", status: "planned" },
  { week: 3, weekday: 5, shopId: "home", visitType: "Off", focus: "Travel / float day", status: "planned" },
  { week: 4, weekday: 2, shopId: "1504", visitType: "Plan To Win", focus: "Q refresh + hiring blitz", status: "planned" },
  { week: 4, weekday: 4, shopId: "home", visitType: "Admin", focus: "Close period + recap", status: "planned" },
];

const SHOP_COUNT = DM_COVERAGE_SHOPS.length;
const VISIT_REQUIREMENT_PATTERN: Record<1 | 2 | 3, Record<string, number>> = {
  1: { "Plan To Win": 1, "Standard Visit": 1 },
  2: { "Standard Visit": 2 },
  3: { "Standard Visit": 1, "Quarterly Audit": 1 },
};

export type RetailPeriodInfo = {
  period: number;
  quarter: number;
  weekOfPeriod: number;
  weeksInPeriod: number;
  startDate: Date;
  endDate: Date;
};

export type PeriodDay = {
  date: Date;
  iso: string;
  dayNumber: number;
  isToday: boolean;
  isPast: boolean;
  isWeekend: boolean;
};

export type SampleScheduleEntry = {
  date: Date;
  iso: string;
  visitType: string;
  shopId: ScheduleLocationId;
  focus?: string | null;
  status?: "planned" | "locked" | "complete";
  locationLabel: string;
};

export const DM_RUNNING_PERIOD_WINDOW = 12;

export const getRetailPeriodInfo = (targetDate: Date = new Date()): RetailPeriodInfo => {
  const { period, quarter, weekOfPeriod, weeksInPeriod, periodStart, periodEnd } = getRetailCalendarInfo(targetDate);
  return {
    period,
    quarter,
    weekOfPeriod,
    weeksInPeriod,
    startDate: periodStart,
    endDate: periodEnd,
  };
};

export const buildPeriodGrid = (startDate: Date, weeksInPeriod: number, today: Date): PeriodDay[][] => {
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const days: PeriodDay[][] = [];

  for (let week = 0; week < weeksInPeriod; week += 1) {
    const row: PeriodDay[] = [];
    for (let weekday = 0; weekday < 7; weekday += 1) {
      const cellDate = new Date(startDate);
      cellDate.setDate(startDate.getDate() + week * 7 + weekday);
      const iso = cellDate.toISOString().split("T")[0];
      const cellMidnight = new Date(cellDate.getFullYear(), cellDate.getMonth(), cellDate.getDate());
      row.push({
        date: cellDate,
        iso,
        dayNumber: cellDate.getDate(),
        isToday: cellMidnight.getTime() === todayMidnight.getTime(),
        isPast: cellMidnight.getTime() < todayMidnight.getTime(),
        isWeekend: cellDate.getDay() === 0 || cellDate.getDay() === 6,
      });
    }
    days.push(row);
  }

  return days;
};

export const buildSampleSchedule = (startDate: Date, weeksInPeriod: number): SampleScheduleEntry[] =>
  DM_SCHEDULE_BLUEPRINT.filter((item) => item.week < weeksInPeriod)
    .map((item) => {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + item.week * 7 + item.weekday);
      const location = DM_SCHEDULE_LOCATIONS[item.shopId as StaticScheduleLocationId] ?? {
        label: `Shop ${String(item.shopId)}`,
        short: String(item.shopId),
      };
      return {
        date,
        iso: date.toISOString().split("T")[0],
        visitType: item.visitType,
        shopId: item.shopId,
        focus: item.focus,
        status: item.status,
        locationLabel: location.label,
      };
    })
    .sort((a, b) => a.date.getTime() - b.date.getTime());

export const groupEntriesByDate = (entries: SampleScheduleEntry[]) =>
  entries.reduce<Record<string, SampleScheduleEntry[]>>((acc, entry) => {
    acc[entry.iso] = acc[entry.iso] ? [...acc[entry.iso], entry] : [entry];
    return acc;
  }, {});

export const buildCoverageSummary = (entries: SampleScheduleEntry[]) => {
  const coverageStyles = {
    strong: { container: "border-emerald-400/40 bg-emerald-500/10", badge: "text-emerald-300" },
    watch: { container: "border-amber-400/40 bg-amber-500/10", badge: "text-amber-300" },
    gap: { container: "border-yellow-400/40 bg-yellow-500/10", badge: "text-yellow-200" },
  } as const;

  return DM_COVERAGE_SHOPS.map((shopId) => {
    const shopMeta = DM_SCHEDULE_LOCATIONS[shopId as StaticScheduleLocationId];
    const count = entries.filter((entry) => entry.shopId === shopId).length;
    const tone = count >= 2 ? "strong" : count === 1 ? "watch" : "gap";
    const toneStyles = coverageStyles[tone];
    const statusLabel = tone === "strong" ? "Good coverage" : tone === "watch" ? "Needs touch" : "No visits yet";
    return {
      shopId,
      label: shopMeta.short,
      count,
      toneClass: toneStyles.container,
      badgeClass: toneStyles.badge,
      statusLabel,
    };
  });
};

export const buildVisitMix = (entries: SampleScheduleEntry[]) => {
  const mix = entries.reduce<Record<string, number>>((acc, entry) => {
    if (entry.visitType === "Off") return acc;
    acc[entry.visitType] = (acc[entry.visitType] ?? 0) + 1;
    return acc;
  }, {});

  return Object.entries(mix)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([type, count]) => ({ type, count }));
};

export const getVisitRequirementsForPeriod = (period: number, shopCount: number = SHOP_COUNT) => {
  const positionInCycle = ((period - 1) % 3) + 1;
  const perShopRequirements = VISIT_REQUIREMENT_PATTERN[positionInCycle as 1 | 2 | 3] ?? VISIT_REQUIREMENT_PATTERN[1];
  const totalShops = Math.max(shopCount, 1);

  return Object.entries(perShopRequirements).map(([type, perShopCount]) => ({
    type,
    required: perShopCount * totalShops,
  }));
};

export const buildDueChecklist = (entries: SampleScheduleEntry[], period: number) => {
  const requirements = getVisitRequirementsForPeriod(period);
  const actualCounts = entries.reduce<Record<string, number>>((acc, entry) => {
    acc[entry.visitType] = (acc[entry.visitType] ?? 0) + 1;
    return acc;
  }, {});

  return requirements.map(({ type, required }) => ({
    type,
    required,
    actual: actualCounts[type] ?? 0,
    met: (actualCounts[type] ?? 0) >= required,
  }));
};

export const getPeriodStorageKey = (info: RetailPeriodInfo) => {
  const startIso = info.startDate.toISOString().split("T")[0];
  const endIso = info.endDate.toISOString().split("T")[0];
  return `period:${info.period}:q${info.quarter}:${startIso}:${endIso}`;
};

export const buildRetailPeriodSequence = (aroundDate: Date = new Date(), total: number = 12): RetailPeriodInfo[] => {
  const seed = getRetailPeriodInfo(aroundDate);
  const seen = new Set<string>();
  const sequence: RetailPeriodInfo[] = [];

  const append = (info: RetailPeriodInfo, position: "end" | "start") => {
    const key = getPeriodStorageKey(info);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    if (position === "start") {
      sequence.unshift(info);
    } else {
      sequence.push(info);
    }
    return true;
  };

  append(seed, "end");

  let forwardCursor = seed;
  while (sequence.length < total) {
    const next = getRetailPeriodInfo(new Date(forwardCursor.endDate.getTime() + DAY_MS));
    const added = append(next, "end");
    if (!added) {
      break;
    }
    forwardCursor = next;
  }

  let backwardCursor = seed;
  while (sequence.length < total) {
    const previous = getRetailPeriodInfo(new Date(backwardCursor.startDate.getTime() - DAY_MS));
    const added = append(previous, "start");
    if (!added) {
      break;
    }
    backwardCursor = previous;
  }

  return sequence;
};

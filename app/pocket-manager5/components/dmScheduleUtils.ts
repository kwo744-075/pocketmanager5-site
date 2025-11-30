export const shortDateFormatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
export const DM_DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
export const DM_VISIT_BADGES: Record<string, string> = {
  "Plan To Win": "border-cyan-400/40 bg-cyan-500/10 text-cyan-100",
  "Standard Visit": "border-emerald-400/40 bg-emerald-500/10 text-emerald-100",
  "Quarterly Audit": "border-amber-400/40 bg-amber-500/10 text-amber-100",
  "Training Visit": "border-pink-400/40 bg-pink-500/10 text-pink-100",
  "1 on 1": "border-fuchsia-400/40 bg-fuchsia-500/10 text-fuchsia-100",
  Admin: "border-slate-500/50 bg-slate-500/10 text-slate-100",
  "Project Day": "border-sky-400/40 bg-sky-500/10 text-sky-100",
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

export type ScheduleLocationId = keyof typeof DM_SCHEDULE_LOCATIONS;
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

const RETAIL_PERIOD_PATTERN = [5, 4, 4, 5, 4, 4, 5, 4, 4, 5, 4, 4] as const;
const MS_IN_DAY = 86_400_000;

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
  focus: string;
  status: "planned" | "locked" | "complete";
  locationLabel: string;
};

export const getRetailPeriodInfo = (targetDate: Date = new Date()): RetailPeriodInfo => {
  const fiscalAnchor = new Date(targetDate.getFullYear() - 1, 11, 31);
  while (fiscalAnchor.getDay() !== 0) {
    fiscalAnchor.setDate(fiscalAnchor.getDate() - 1);
  }

  const cursorStart = new Date(fiscalAnchor);
  for (let index = 0; index < RETAIL_PERIOD_PATTERN.length; index += 1) {
    const weeks = RETAIL_PERIOD_PATTERN[index];
    const periodEnd = new Date(cursorStart);
    periodEnd.setDate(periodEnd.getDate() + weeks * 7 - 1);

    if (targetDate >= cursorStart && targetDate <= periodEnd) {
      const weeksIntoPeriod = Math.floor((targetDate.getTime() - cursorStart.getTime()) / MS_IN_DAY / 7) + 1;
      return {
        period: index + 1,
        quarter: Math.floor(index / 3) + 1,
        weekOfPeriod: Math.max(weeksIntoPeriod, 1),
        weeksInPeriod: weeks,
        startDate: new Date(cursorStart),
        endDate: periodEnd,
      };
    }

    cursorStart.setDate(cursorStart.getDate() + weeks * 7);
  }

  const fallbackWeeks = RETAIL_PERIOD_PATTERN[RETAIL_PERIOD_PATTERN.length - 1];
  const fallbackStart = new Date(cursorStart);
  const fallbackEnd = new Date(cursorStart);
  fallbackEnd.setDate(fallbackEnd.getDate() + fallbackWeeks * 7 - 1);
  return {
    period: 12,
    quarter: 4,
    weekOfPeriod: fallbackWeeks,
    weeksInPeriod: fallbackWeeks,
    startDate: fallbackStart,
    endDate: fallbackEnd,
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
      const location = DM_SCHEDULE_LOCATIONS[item.shopId];
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
    gap: { container: "border-rose-400/40 bg-rose-500/10", badge: "text-rose-300" },
  } as const;

  return DM_COVERAGE_SHOPS.map((shopId) => {
    const shopMeta = DM_SCHEDULE_LOCATIONS[shopId];
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

export const getVisitsDueForPeriod = (period: number): string[] => {
  const visitsDue: string[] = [];
  const positionInCycle = ((period - 1) % 3) + 1;

  switch (positionInCycle) {
    case 1:
      visitsDue.push("Plan To Win");
      visitsDue.push("Standard Visit");
      break;
    case 2:
      visitsDue.push("Standard Visit");
      visitsDue.push("Standard Visit");
      break;
    case 3:
      visitsDue.push("Quarterly Audit");
      visitsDue.push("Standard Visit");
      break;
    default:
      break;
  }

  return visitsDue;
};

export const buildDueChecklist = (entries: SampleScheduleEntry[], period: number) => {
  const dueCounts = getVisitsDueForPeriod(period).reduce<Record<string, number>>((acc, visit) => {
    acc[visit] = (acc[visit] ?? 0) + 1;
    return acc;
  }, {});

  const actualCounts = entries.reduce<Record<string, number>>((acc, entry) => {
    acc[entry.visitType] = (acc[entry.visitType] ?? 0) + 1;
    return acc;
  }, {});

  return Object.entries(dueCounts).map(([type, required]) => {
    const actual = actualCounts[type] ?? 0;
    return {
      type,
      required,
      actual,
      met: actual >= required,
    };
  });
};

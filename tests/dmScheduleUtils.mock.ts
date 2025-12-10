export const DM_SCHEDULE_LOCATIONS = {
  "1501": { short: "1501" },
  "1502": { short: "1502" },
  "1503": { short: "1503" },
} as const;

export type ScheduleLocationId = keyof typeof DM_SCHEDULE_LOCATIONS;

export type SampleScheduleEntry = {
  date: Date;
  iso: string;
  visitType: string;
  shopId: ScheduleLocationId;
  focus: string | null;
  status: "planned" | "locked" | "complete";
  locationLabel: string;
};

export function buildPeriodGrid(start: Date, weeks: number, today: Date) {
  // Emit a simple 7-day-per-row grid for the requested week count.
  const msPerDay = 24 * 60 * 60 * 1000;
  type PeriodCell = {
    iso: string;
    isToday: boolean;
    isPast: boolean;
    isWeekend: boolean;
  };

  const grid: PeriodCell[][] = [];
  for (let w = 0; w < weeks; w++) {
    const row: PeriodCell[] = [];
    for (let d = 0; d < 7; d++) {
      const day = new Date(start.getTime() + (w * 7 + d) * msPerDay);
      const iso = day.toISOString().slice(0, 10);
      row.push({
        iso,
        isToday: iso === today.toISOString().slice(0, 10),
        isPast: day.getTime() < today.getTime(),
        isWeekend: day.getDay() === 0 || day.getDay() === 6,
      });
    }
    grid.push(row);
  }
  return grid;
}

export function buildDueChecklist(entries: SampleScheduleEntry[], shopCount: number) {
  // Minimal behavior used by tests: count types and compute required = shopCount
  const types = Array.from(new Set(entries.map((e) => e.visitType)));
  return types.map((t) => {
    const actual = entries.filter((e) => e.visitType === t).length;
    return { type: t, required: shopCount, actual, met: actual >= shopCount };
  });
}

export function buildCoverageSummary(entries: SampleScheduleEntry[]) {
  // Emit one row per known shop id in DM_SCHEDULE_LOCATIONS
  return Object.keys(DM_SCHEDULE_LOCATIONS).map((id) => {
    const count = entries.filter((e) => String(e.shopId) === id).length;
    let statusLabel = "No visits yet";
    if (count >= 2) statusLabel = "Good coverage";
    else if (count === 1) statusLabel = "Needs touch";
    return { shopId: id, count, statusLabel };
  });
}

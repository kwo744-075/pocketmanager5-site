import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPeriodGrid,
  buildDueChecklist,
  buildCoverageSummary,
  DM_SCHEDULE_LOCATIONS,
  type SampleScheduleEntry,
  type ScheduleLocationId,
} from "@shared/features/dm-schedule/dmScheduleUtils";

const makeEntry = (
  options: {
    iso: string;
    shopId: ScheduleLocationId;
    visitType?: string;
    focus?: string | null;
    status?: "planned" | "locked" | "complete";
  } & Partial<Pick<SampleScheduleEntry, "locationLabel">>,
): SampleScheduleEntry => {
  const location = DM_SCHEDULE_LOCATIONS[options.shopId as keyof typeof DM_SCHEDULE_LOCATIONS];
  const label = options.locationLabel ?? location?.short ?? options.shopId;
  return {
    date: new Date(`${options.iso}T00:00:00Z`),
    iso: options.iso,
    visitType: options.visitType ?? "Standard Visit",
    shopId: options.shopId,
    focus: options.focus ?? null,
    status: options.status ?? "planned",
    locationLabel: label,
  } satisfies SampleScheduleEntry;
};

test("buildPeriodGrid marks today, weekends, and past days", () => {
  const start = new Date("2025-01-01T00:00:00Z");
  const today = new Date("2025-01-05T00:00:00Z");
  const grid = buildPeriodGrid(start, 2, today);

  assert.equal(grid.length, 2);
  grid.forEach((row) => assert.equal(row.length, 7));

  const allDays = grid.flat();
  const jan2 = allDays.find((day) => day.iso === "2025-01-02");
  assert.ok(jan2?.isPast);
  assert.equal(jan2?.isWeekend, false);

  const jan5 = allDays.find((day) => day.iso === "2025-01-05");
  assert.ok(jan5?.isToday, "should flag supplied today");
  assert.equal(jan5?.isWeekend, true);

  const jan8 = allDays.find((day) => day.iso === "2025-01-08");
  assert.equal(jan8?.isPast, false, "future dates remain upcoming");
});

test("buildDueChecklist scales required visits by shop count", () => {
  const entries: SampleScheduleEntry[] = [
    makeEntry({ iso: "2025-01-02", shopId: "1501", visitType: "Plan To Win" }),
    makeEntry({ iso: "2025-01-03", shopId: "1502", visitType: "Plan To Win" }),
    makeEntry({ iso: "2025-01-04", shopId: "1503", visitType: "Plan To Win" }),
    ...Array.from({ length: 6 }).map((_, idx) =>
      makeEntry({ iso: `2025-01-${10 + idx}`, shopId: "1501", visitType: "Standard Visit" }),
    ),
  ];

  const checklist = buildDueChecklist(entries, 1);
  const planToWin = checklist.find((item) => item.type === "Plan To Win");
  const standardVisit = checklist.find((item) => item.type === "Standard Visit");

  assert.equal(planToWin?.required, 5, "one per shop for five covered shops");
  assert.equal(planToWin?.actual, 3);
  assert.equal(planToWin?.met, false);

  assert.equal(standardVisit?.required, 5);
  assert.equal(standardVisit?.actual, 6);
  assert.equal(standardVisit?.met, true);
});

test("buildCoverageSummary classifies coverage strength per shop", () => {
  const entries: SampleScheduleEntry[] = [
    makeEntry({ iso: "2025-01-02", shopId: "1501" }),
    makeEntry({ iso: "2025-01-04", shopId: "1501" }),
    makeEntry({ iso: "2025-01-03", shopId: "1502" }),
  ];

  const summary = buildCoverageSummary(entries);
  assert.equal(summary.length, 5, "should emit one row per coverage shop");

  const shop1501 = summary.find((item) => item.shopId === "1501");
  assert.equal(shop1501?.count, 2);
  assert.equal(shop1501?.statusLabel, "Good coverage");

  const shop1502 = summary.find((item) => item.shopId === "1502");
  assert.equal(shop1502?.count, 1);
  assert.equal(shop1502?.statusLabel, "Needs touch");

  const shop1503 = summary.find((item) => item.shopId === "1503");
  assert.equal(shop1503?.count, 0);
  assert.equal(shop1503?.statusLabel, "No visits yet");
});

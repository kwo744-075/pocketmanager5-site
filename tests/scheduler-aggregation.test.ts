import test from "node:test";
import assert from "node:assert/strict";
import { calculateHours, aggregateShifts, type ShiftRow } from "@/lib/scheduleUtils";

test("calculateHours computes differences across midnight and with breaks", () => {
  assert.equal(calculateHours("09:00", "17:00", 30), 7.5);
  assert.equal(calculateHours("22:00", "02:00", 0), 4);
  assert.equal(calculateHours(null, "02:00", 0), 0);
});

test("aggregateShifts aggregates totals and per-day hours", () => {
  const shifts: ShiftRow[] = [
    { employee_id: "e1", shop_id: "s", date: "2025-12-01", start_time: "09:00", end_time: "17:00", break_minutes: 30 },
    { employee_id: "e1", shop_id: "s", date: "2025-12-02", start_time: "10:00", end_time: "15:00", break_minutes: 0 },
    { employee_id: "e2", shop_id: "s", date: "2025-12-01", start_time: "08:00", end_time: "12:00", break_minutes: 0 },
  ];

  const map = aggregateShifts(shifts, "2025-12-01", "2025-12-07");
  const e1 = map.get("e1");
  const e2 = map.get("e2");

  assert.ok(e1, "e1 should be present");
  assert.ok(e2, "e2 should be present");
  assert.equal(Math.round((e1!.total + Number.EPSILON) * 10) / 10, 12.5);
  assert.equal(Math.round((e2!.total + Number.EPSILON) * 10) / 10, 4);
  assert.equal(e1!.dayHours["2025-12-01"], 7.5);
  assert.equal(e1!.dayHours["2025-12-02"], 5);
});

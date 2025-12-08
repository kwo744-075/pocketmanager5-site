export type ShiftRow = {
  id?: string;
  employee_id: string;
  shop_id: string;
  date: string; // ISO YYYY-MM-DD
  start_time?: string | null;
  end_time?: string | null;
  break_minutes?: number | null;
  kind?: string | null;
};

export function calculateHours(start?: string | null, end?: string | null, breakMinutes?: number | null) {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map((v) => Number(v) || 0);
  const [eh, em] = end.split(":").map((v) => Number(v) || 0);
  let startTotal = sh * 60 + sm;
  let endTotal = eh * 60 + em;
  let diff = endTotal - startTotal;
  if (diff < 0) diff += 24 * 60;
  return Math.max(0, (diff - (breakMinutes ?? 0)) / 60);
}

export type Aggregation = {
  total: number;
  overtime: number;
  dayHours: Record<string, number>; // iso -> hours
};

export function aggregateShifts(shifts: ShiftRow[], weekStartIso: string, weekEndIso: string) {
  const byEmployee = new Map<string, Aggregation>();

  // initialize map entries when encountered
  for (const s of shifts) {
    if (s.kind && s.kind !== "shift") continue;
    const emp = s.employee_id;
    const day = s.date; // ISO
    const hours = calculateHours(s.start_time ?? null, s.end_time ?? null, s.break_minutes ?? 0);
    const cur = byEmployee.get(emp) ?? { total: 0, overtime: 0, dayHours: {} };
    cur.total += hours;
    cur.dayHours[day] = (cur.dayHours[day] ?? 0) + hours;
    byEmployee.set(emp, cur);
  }

  // finalize overtime (simple >40 rule)
  for (const [emp, agg] of byEmployee.entries()) {
    agg.overtime = Math.max(0, agg.total - 40);
    byEmployee.set(emp, agg);
  }

  return byEmployee;
}

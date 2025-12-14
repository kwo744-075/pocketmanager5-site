import { supabase } from "@/lib/supabaseClient";

const DEFAULT_FORMULATION_FACTOR = 0.79;
const DAY_KEYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;

const toISODate = (date: Date) => {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy.toISOString().split("T")[0];
};

const startOfWeek = (input: Date) => {
  const date = new Date(input);
  const day = date.getDay();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - day);
  return date;
};

const normalizeShopKey = (value: string | number | null | undefined) => {
  if (value == null) return null;
  const str = typeof value === "number" ? value.toString() : value.trim();
  if (!str || str.toLowerCase() === "default" || str === "null") {
    return null;
  }
  return str;
};

const calculateShiftHours = (startTime?: string | null, endTime?: string | null, breakMinutes?: number | null) => {
  if (!startTime || !endTime) return 0;
  const [startHour, startMin] = startTime.split(":").map((value) => Number(value) || 0);
  const [endHour, endMin] = endTime.split(":").map((value) => Number(value) || 0);
  const startTotal = startHour * 60 + startMin;
  const endTotal = endHour * 60 + endMin;
  let diff = endTotal - startTotal;
  if (diff < 0) {
    diff += 24 * 60;
  }
  const adjusted = diff - (breakMinutes ?? 0);
  return Math.max(0, adjusted / 60);
};

const monthsBetween = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const now = new Date();
  let months = (now.getFullYear() - date.getFullYear()) * 12 + (now.getMonth() - date.getMonth());
  if (now.getDate() < date.getDate()) {
    months -= 1;
  }
  return Math.max(0, months);
};

export type StaffPreview = {
  id: string;
  name: string;
  role: string | null;
  status: string | null;
  tenureMonths: number | null;
  hiredAt: string | null;
};

export type TrainingPreview = {
  completionPct: number;
  completed: number;
  inProgress: number;
  notStarted: number;
  inProgressList: Array<{ id: string; name: string; status: string | null; updatedAt: string | null }>;
};

export type MeetingPreview = {
  id: string;
  meetingDate: string | null;
  meetingTime: string | null;
  meetingType: string | null;
  attendeesCount: number;
  agenda: string | null;
};

export type CoachingPreview = {
  histogram: Array<{ date: string; count: number }>;
  recent: Array<{ id: string; staffName: string | null; reason: string | null; coachedAt: string | null }>;
};

export type TermedPreview = {
  id: string;
  name: string | null;
  termedAt: string | null;
  reason: string | null;
  rehireStatus: string | null;
};

export type DevelopmentPreview = {
  active: number;
  completed: number;
  onHold: number;
};

export type PeopleFeaturePreview = {
  shopNumber: string | null;
  hasData: boolean;
  roster: StaffPreview[];
  training: TrainingPreview;
  meetings: MeetingPreview[];
  coaching: CoachingPreview;
  termed: TermedPreview[];
  development: DevelopmentPreview;
};

export const EMPTY_PEOPLE_PREVIEW: PeopleFeaturePreview = {
  shopNumber: null,
  hasData: false,
  roster: [],
  training: {
    completionPct: 0,
    completed: 0,
    inProgress: 0,
    notStarted: 0,
    inProgressList: [],
  },
  meetings: [],
  coaching: {
    histogram: [],
    recent: [],
  },
  termed: [],
  development: {
    active: 0,
    completed: 0,
    onHold: 0,
  },
};

export async function fetchPeopleFeaturePreview(shopNumberInput: string | number | null | undefined): Promise<PeopleFeaturePreview> {
  const shopNumber = normalizeShopKey(shopNumberInput);
  if (!shopNumber) {
    return { ...EMPTY_PEOPLE_PREVIEW };
  }

  try {
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [staffResult, trainingResult, meetingsResult, coachingResult, termedResult, developmentResult] = await Promise.all([
      supabase
        .from("shop_staff")
        .select("id, staff_name, primary_role, status, date_of_hired")
        .eq("shop_id", shopNumber)
        .order("staff_name", { ascending: true })
        .limit(25),
      supabase
        .from("employee_training")
        .select("id, staff_name, training_status, updated_at")
        .eq("shop_id", shopNumber)
        .limit(100),
      supabase
        .from("employee_meetings")
        .select("id, meeting_type, meeting_date, meeting_time, attendees, agenda_text")
        .eq("shop_id", shopNumber)
        .order("meeting_date", { ascending: false })
        .order("meeting_time", { ascending: false })
        .limit(8),
      supabase
        .from("coaching_logs")
        .select("id, staff_name, coached_at, reason")
        .eq("shop_id", shopNumber)
        .gte("coached_at", thirtyDaysAgo.toISOString())
        .order("coached_at", { ascending: false })
        .limit(60),
      supabase
        .from("termed_employees")
        .select("id, staff_name, termed_at, reason, rehire_status")
        .eq("shop_id", shopNumber)
        .order("termed_at", { ascending: false })
        .limit(10),
      supabase
        .from("employee_development")
        .select("id, status")
        .eq("shop_id", shopNumber),
    ]);

    const roster: StaffPreview[] = (staffResult.data ?? []).map((row) => ({
      id: row.id,
      name: row.staff_name ?? "Unnamed",
      role: row.primary_role ?? null,
      status: row.status ?? null,
      tenureMonths: monthsBetween(row.date_of_hired),
      hiredAt: row.date_of_hired ?? null,
    }));

    const trainingRows = trainingResult.data ?? [];
    const totalTraining = trainingRows.length || 0;
    const completed = trainingRows.filter((row) => row.training_status === "completed").length;
    const inProgress = trainingRows.filter((row) => row.training_status === "in_progress").length;
    const notStarted = Math.max(totalTraining - completed - inProgress, 0);
    const completionPct = totalTraining ? Math.round((completed / totalTraining) * 100) : 0;

    const inProgressList = trainingRows
      .filter((row) => row.training_status === "in_progress")
      .slice(0, 6)
      .map((row) => ({
        id: row.id,
        name: row.staff_name ?? "Unnamed",
        status: row.training_status ?? null,
        updatedAt: row.updated_at ?? null,
      }));

    const meetings: MeetingPreview[] = (meetingsResult.data ?? []).map((row) => ({
      id: row.id,
      meetingDate: row.meeting_date ?? null,
      meetingTime: row.meeting_time ?? null,
      meetingType: row.meeting_type ?? null,
      attendeesCount: Array.isArray(row.attendees) ? row.attendees.length : 0,
      agenda: row.agenda_text ?? null,
    }));

    const histogramMap = new Map<string, number>();
    for (let i = 29; i >= 0; i -= 1) {
      const day = new Date(today);
      day.setDate(today.getDate() - i);
      histogramMap.set(toISODate(day), 0);
    }

    (coachingResult.data ?? []).forEach((row) => {
      if (!row.coached_at) return;
      const dayKey = row.coached_at.split("T")[0];
      if (histogramMap.has(dayKey)) {
        histogramMap.set(dayKey, (histogramMap.get(dayKey) ?? 0) + 1);
      }
    });

    const coaching: CoachingPreview = {
      histogram: Array.from(histogramMap.entries()).map(([date, count]) => ({ date, count })),
      recent: (coachingResult.data ?? []).slice(0, 5).map((row) => ({
        id: row.id,
        staffName: row.staff_name ?? null,
        reason: row.reason ?? null,
        coachedAt: row.coached_at ?? null,
      })),
    };

    const termed: TermedPreview[] = (termedResult.data ?? []).map((row) => ({
      id: row.id,
      name: row.staff_name ?? "Unnamed",
      termedAt: row.termed_at ?? null,
      reason: row.reason ?? null,
      rehireStatus: row.rehire_status ?? null,
    }));

    const developmentCounts = (developmentResult.data ?? []).reduce(
      (acc, row) => {
        const status = (row.status ?? "").toLowerCase();
        if (status === "completed") acc.completed += 1;
        else if (status === "on_hold") acc.onHold += 1;
        else acc.active += 1;
        return acc;
      },
      { active: 0, completed: 0, onHold: 0 }
    );

    const hasData = roster.length > 0 || totalTraining > 0 || meetings.length > 0 || (coachingResult.data ?? []).length > 0;

    return {
      shopNumber,
      hasData,
      roster,
      training: {
        completionPct,
        completed,
        inProgress,
        notStarted,
        inProgressList,
      },
      meetings,
      coaching,
      termed,
      development: developmentCounts,
    };
  } catch (error) {
    console.error("[peopleFeatureData] fetchPeopleFeaturePreview", error);
    return { ...EMPTY_PEOPLE_PREVIEW, shopNumber };
  }
}

export type SchedulingEmployeeSummary = {
  id: string;
  name: string;
  role: string | null;
  shifts: number;
  hours: number;
};

export type SchedulingDailyCoverage = {
  date: string;
  shiftCount: number;
  hours: number;
  allowedHours?: number;
};

export type LegacyScheduleRow = {
  id: string;
  staffName: string;
  position: string | null;
  totalHours: number;
  overtimeHours: number;
};

export type EmployeeSchedulingPreview = {
  shopNumber: string | null;
  weekStartISO: string;
  weekEndISO: string;
  simpleScheduler: {
    totalShifts: number;
    totalHours: number;
    employees: SchedulingEmployeeSummary[];
    dailyCoverage: SchedulingDailyCoverage[];
    lastShiftDate: string | null;
  };
  legacyScheduler: {
    rows: LegacyScheduleRow[];
    totalHours: number;
    overtimeHours: number;
  };
  projections: {
    totalAllowedHours: number;
    daily: SchedulingDailyCoverage[];
  };
};

export const EMPTY_SCHEDULING_PREVIEW: EmployeeSchedulingPreview = {
  shopNumber: null,
  weekStartISO: toISODate(startOfWeek(new Date())),
  weekEndISO: toISODate(new Date(startOfWeek(new Date()).getTime() + 6 * 24 * 60 * 60 * 1000)),
  simpleScheduler: {
    totalShifts: 0,
    totalHours: 0,
    employees: [],
    dailyCoverage: [],
    lastShiftDate: null,
  },
  legacyScheduler: {
    rows: [],
    totalHours: 0,
    overtimeHours: 0,
  },
  projections: {
    totalAllowedHours: 0,
    daily: [],
  },
};

export async function fetchEmployeeSchedulingPreview(shopNumberInput: string | number | null | undefined): Promise<EmployeeSchedulingPreview> {
  const shopNumber = normalizeShopKey(shopNumberInput);
  const weekStart = startOfWeek(new Date());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const weekStartISO = toISODate(weekStart);
  const weekEndISO = toISODate(weekEnd);
  const weekDates = DAY_KEYS.map((_, idx) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + idx);
    return toISODate(date);
  });

  if (!shopNumber) {
    return { ...EMPTY_SCHEDULING_PREVIEW, weekStartISO, weekEndISO };
  }

  try {
    const [shiftResult, staffResult, projectionsResult, legacySchedulesResult] = await Promise.all([
      supabase
        .from("employee_shifts")
        .select("id, employee_id, date, start_time, end_time, break_minutes, kind")
        .eq("shop_id", shopNumber)
        .gte("date", weekStartISO)
        .lte("date", weekEndISO)
        .limit(200),
      supabase
        .from("shop_staff")
        .select("id, staff_name, primary_role")
        .eq("shop_id", shopNumber)
        .limit(100),
      supabase
        .from("weekly_projections")
        .select("sunday_cars, monday_cars, tuesday_cars, wednesday_cars, thursday_cars, friday_cars, saturday_cars, formulation_factor")
        .eq("shop_id", shopNumber)
        .eq("week_start_date", weekStartISO)
        .maybeSingle(),
      supabase
        .from("employee_schedules")
        .select("id, week_start_date, position, total_hours, overtime_hours, shop_staff!inner(staff_name)")
        .eq("shop_id", shopNumber)
        .eq("week_start_date", weekStartISO)
        .limit(50),
    ]);

    const staffLookup = new Map<string, { name: string; role: string | null }>();
    (staffResult.data ?? []).forEach((row) => {
      staffLookup.set(row.id, {
        name: row.staff_name ?? "Unnamed",
        role: row.primary_role ?? null,
      });
    });

    const dailyCoverageMap = new Map<string, { shiftCount: number; hours: number }>();
    weekDates.forEach((date) => {
      dailyCoverageMap.set(date, { shiftCount: 0, hours: 0 });
    });

    const employeeMap = new Map<string, { shifts: number; hours: number }>();
    let totalShifts = 0;
    let totalHours = 0;
    let lastShiftDate: string | null = null;

    (shiftResult.data ?? []).forEach((row) => {
      if (row.kind && row.kind !== "shift") {
        return;
      }
      const hours = calculateShiftHours(row.start_time, row.end_time, row.break_minutes);
      totalHours += hours;
      totalShifts += 1;
      const mapEntry = dailyCoverageMap.get(row.date);
      if (mapEntry) {
        mapEntry.shiftCount += 1;
        mapEntry.hours += hours;
      }
      if (row.employee_id) {
        const emp = employeeMap.get(row.employee_id) ?? { shifts: 0, hours: 0 };
        emp.shifts += 1;
        emp.hours += hours;
        employeeMap.set(row.employee_id, emp);
      }
      if (row.date && (!lastShiftDate || row.date > lastShiftDate)) {
        lastShiftDate = row.date;
      }
    });

    const dailyCoverage: SchedulingDailyCoverage[] = weekDates.map((date) => {
      const entry = dailyCoverageMap.get(date) ?? { shiftCount: 0, hours: 0 };
      return {
        date,
        shiftCount: entry.shiftCount,
        hours: Math.round(entry.hours * 10) / 10,
      };
    });

    const employees: SchedulingEmployeeSummary[] = Array.from(employeeMap.entries())
      .map(([id, stats]) => {
        const meta = staffLookup.get(id);
        return {
          id,
          name: meta?.name ?? "Unnamed",
          role: meta?.role ?? null,
          shifts: stats.shifts,
          hours: Math.round(stats.hours * 10) / 10,
        };
      })
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 12);

    const projection = projectionsResult.data;
    const formulationFactor = projection?.formulation_factor ?? DEFAULT_FORMULATION_FACTOR;
    const projectionDaily: SchedulingDailyCoverage[] = weekDates.map((date, idx) => {
      const key = `${DAY_KEYS[idx]}_cars` as const;
      const cars = projection?.[key] ?? 0;
      const allowedHours = Math.round(cars * formulationFactor * 10) / 10;
      return {
        date,
        shiftCount: cars,
        hours: allowedHours,
        allowedHours,
      };
    });
    const totalAllowedHours = projectionDaily.reduce((sum, item) => sum + (item.allowedHours ?? 0), 0);

    // Attach allowed hours to actual coverage for easy comparison
    const coverageWithAllowed = dailyCoverage.map((entry, idx) => ({
      ...entry,
      allowedHours: projectionDaily[idx]?.allowedHours,
    }));

    const legacyRows: LegacyScheduleRow[] = (legacySchedulesResult.data ?? []).map((row) => ({
      id: row.id,
      staffName: row.shop_staff?.[0]?.staff_name ?? "Unnamed",
      position: row.position ?? null,
      totalHours: Number(row.total_hours ?? 0),
      overtimeHours: Number(row.overtime_hours ?? 0),
    }));

    const legacyTotals = legacyRows.reduce(
      (acc, row) => {
        acc.totalHours += row.totalHours;
        acc.overtimeHours += row.overtimeHours;
        return acc;
      },
      { totalHours: 0, overtimeHours: 0 }
    );

    return {
      shopNumber,
      weekStartISO,
      weekEndISO,
      simpleScheduler: {
        totalShifts,
        totalHours: Math.round(totalHours * 10) / 10,
        employees,
        dailyCoverage: coverageWithAllowed,
        lastShiftDate,
      },
      legacyScheduler: {
        rows: legacyRows,
        totalHours: Math.round(legacyTotals.totalHours * 10) / 10,
        overtimeHours: Math.round(legacyTotals.overtimeHours * 10) / 10,
      },
      projections: {
        totalAllowedHours: Math.round(totalAllowedHours * 10) / 10,
        daily: projectionDaily,
      },
    };
  } catch (error) {
    console.error("[peopleFeatureData] fetchEmployeeSchedulingPreview", error);
    return { ...EMPTY_SCHEDULING_PREVIEW, shopNumber, weekStartISO, weekEndISO };
  }
}

export type DmSchedulePreview = {
  shopNumber: string | null;
  hasData: boolean;
  upcoming: Array<{ id: string; date: string | null; visitType: string | null; location: string | null; notes: string | null }>;
  recentLogs: Array<{ id: string; logDate: string | null; logType: string | null; score: number | null; submittedBy: string | null }>;
};

export const EMPTY_DM_SCHEDULE_PREVIEW: DmSchedulePreview = {
  shopNumber: null,
  hasData: false,
  upcoming: [],
  recentLogs: [],
};

export async function fetchDmSchedulePreview(shopNumberInput: string | number | null | undefined): Promise<DmSchedulePreview> {
  const shopNumber = normalizeShopKey(shopNumberInput);
  if (!shopNumber) {
    return { ...EMPTY_DM_SCHEDULE_PREVIEW };
  }

  try {
    const today = toISODate(new Date());
    const [scheduleResult, logResult] = await Promise.all([
      supabase
        .from("dm_schedule")
        .select("id, date, visit_type, location_text, notes")
        .eq("location_id", shopNumber)
        .gte("date", today)
        .order("date", { ascending: true })
        .limit(15),
      supabase
        .from("dm_logbook")
        .select("id, log_date, log_type, scoring_percentage, submitted_by")
        .eq("shop_number", shopNumber)
        .order("log_date", { ascending: false })
        .limit(10),
    ]);

    const upcoming = (scheduleResult.data ?? []).map((row) => ({
      id: row.id,
      date: row.date ?? null,
      visitType: row.visit_type ?? null,
      location: row.location_text ?? null,
      notes: row.notes ?? null,
    }));

    const recentLogs = (logResult.data ?? []).map((row) => ({
      id: row.id,
      logDate: row.log_date ?? null,
      logType: row.log_type ?? null,
      score: typeof row.scoring_percentage === "number" ? row.scoring_percentage : null,
      submittedBy: row.submitted_by ?? null,
    }));

    return {
      shopNumber,
      hasData: upcoming.length > 0 || recentLogs.length > 0,
      upcoming,
      recentLogs,
    };
  } catch (error) {
    console.error("[peopleFeatureData] fetchDmSchedulePreview", error);
    return { ...EMPTY_DM_SCHEDULE_PREVIEW, shopNumber };
  }
}

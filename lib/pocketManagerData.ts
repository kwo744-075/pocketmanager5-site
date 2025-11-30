import { supabase } from "@/lib/supabaseClient";
import type { PostgrestError } from "@supabase/supabase-js";

export type VisitScheduleItem = {
  id: string;
  date: string;
  visitType: string | null;
  location: string | null;
  notes: string | null;
};

export type VisitLogItem = {
  id: string;
  date: string | null;
  type: string;
  score: number | null;
  submittedBy: string | null;
};

export type PocketManagerSnapshot = {
  updatedAt: string;
  labor: {
    carsToday: number;
    allowedToday: number;
    usedToday: number;
    varianceToday: number;
    weeklyAllowed: number;
    weeklyUsed: number;
    turnedCars: number;
  };
  staffing: {
    currentCount: number;
    staffedToParPct: number;
    avgTenureMonths: number;
    termsYTD: number;
  };
  training: {
    completionPct: number;
    inTrainingCount: number;
  };
  cadence: {
    dailyPct: number;
    weeklyPct: number;
    challengesToday: number;
    challengesWeek: number;
  };
  visits: {
    upcoming: VisitScheduleItem[];
    recent: VisitLogItem[];
  };
  admin: {
    claimsToday: number;
    claimsWeek: number;
    solinksToday: number;
  };
  inventory: {
    totalItems: number;
    oilsItems: number;
    lastCountDate: string | null;
    pendingOrders: number;
  };
  alerts: string[];
};

export const EMPTY_SNAPSHOT: PocketManagerSnapshot = {
  updatedAt: new Date(0).toISOString(),
  labor: {
    carsToday: 0,
    allowedToday: 0,
    usedToday: 0,
    varianceToday: 0,
    weeklyAllowed: 0,
    weeklyUsed: 0,
    turnedCars: 0,
  },
  staffing: {
    currentCount: 0,
    staffedToParPct: 0,
    avgTenureMonths: 0,
    termsYTD: 0,
  },
  training: {
    completionPct: 0,
    inTrainingCount: 0,
  },
  cadence: {
    dailyPct: 0,
    weeklyPct: 0,
    challengesToday: 0,
    challengesWeek: 0,
  },
  visits: {
    upcoming: [],
    recent: [],
  },
  admin: {
    claimsToday: 0,
    claimsWeek: 0,
    solinksToday: 0,
  },
  inventory: {
    totalItems: 0,
    oilsItems: 0,
    lastCountDate: null,
    pendingOrders: 0,
  },
  alerts: [],
};

const STAFFING_PAR_TARGET = 15;

type LaborTrackingRow = {
  total_cars: number | null;
  allowed_hours: number | null;
  current_hours: number | null;
  variance: number | null;
};

type LaborWeekRow = {
  allowed_hours: number | null;
  current_hours: number | null;
};

type StaffRow = {
  id: string;
  date_of_hired: string | null;
};

type TrainingRow = {
  id: string;
  training_status: string | null;
};

type CadenceRow = {
  id: string;
  completed: boolean | null;
};

type ChallengeRow = {
  id: string;
};

type ScheduleRow = {
  id: string;
  date: string;
  visit_type: string | null;
  location_text: string | null;
  notes: string | null;
};

type DmLogRow = {
  id: string;
  log_type: string | null;
  log_date: string | null;
  scoring_percentage: number | null;
  submitted_by: string | null;
};

type InventoryRow = {
  count_date: string | null;
  floor_count: number | null;
  storage_count: number | null;
  category: string | null;
};

type SupplyOrderRow = {
  id: string;
  status: string | null;
};

type ClaimRow = { id: string };
type SolinkRow = { id: string };
type TurnedRow = { id: string };
type TermedRow = { id: string };

const toISODate = (date: Date) => date.toISOString().split("T")[0];

const startOfWeek = (date: Date) => {
  const result = new Date(date);
  const day = result.getDay();
  result.setHours(0, 0, 0, 0);
  result.setDate(result.getDate() - day);
  return result;
};

const startOfYear = (date: Date) => {
  const result = new Date(date.getFullYear(), 0, 1);
  result.setHours(0, 0, 0, 0);
  return result;
};

async function handleSingle<T>(promise: PromiseLike<{ data: T | null; error: PostgrestError | null }>, label: string) {
  try {
    const { data, error } = await promise;
    if (error && error.code !== "PGRST116") {
      console.error(`[PocketManagerSnapshot] ${label} error`, error);
      return null;
    }
    return data ?? null;
  } catch (err) {
    console.error(`[PocketManagerSnapshot] ${label} exception`, err);
    return null;
  }
}

async function handleList<T>(promise: PromiseLike<{ data: T[] | null; error: PostgrestError | null }>, label: string) {
  try {
    const { data, error } = await promise;
    if (error && error.code !== "PGRST116") {
      console.error(`[PocketManagerSnapshot] ${label} error`, error);
      return [] as T[];
    }
    return (data ?? []) as T[];
  } catch (err) {
    console.error(`[PocketManagerSnapshot] ${label} exception`, err);
    return [] as T[];
  }
}

const calculateAvgTenure = (hireDates: (string | null)[]) => {
  if (!hireDates.length) return 0;
  const now = new Date();
  let totalMonths = 0;
  let valid = 0;

  hireDates.forEach((date) => {
    if (!date) return;
    const hireDate = new Date(date);
    if (Number.isNaN(hireDate.getTime())) return;
    let months = (now.getFullYear() - hireDate.getFullYear()) * 12 + (now.getMonth() - hireDate.getMonth());
    if (now.getDate() < hireDate.getDate()) {
      months -= 1;
    }
    if (months < 0) months = 0;
    totalMonths += months;
    valid += 1;
  });

  if (!valid) return 0;
  return Math.round(totalMonths / valid);
};

export async function fetchPocketManagerSnapshot(shopNumberInput: number | string | null | undefined): Promise<PocketManagerSnapshot> {
  const shopKey = typeof shopNumberInput === "number" ? String(shopNumberInput) : shopNumberInput?.toString() ?? null;
  if (!shopKey) {
    return { ...EMPTY_SNAPSHOT };
  }

  const now = new Date();
  const todayISO = toISODate(now);
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const weekStartDate = startOfWeek(now);
  const weekStartISO = toISODate(weekStartDate);
  const yearStartISO = toISODate(startOfYear(now));

  const [
    laborToday,
    laborWeekRows,
    staffRows,
    trainingRows,
    cadenceTodayRows,
    cadenceWeekRows,
    challengesTodayRows,
    challengesWeekRows,
    scheduleRows,
    dmLogRows,
    inventoryRows,
    supplyOrders,
    claimsTodayRows,
    claimsWeekRows,
    solinkRows,
    turnedRows,
    termsRows,
  ] = await Promise.all([
    handleSingle<LaborTrackingRow>(
      supabase
        .from("labor_tracking")
        .select("total_cars, allowed_hours, current_hours, variance")
        .eq("shop_id", shopKey)
        .eq("date", todayISO)
        .maybeSingle(),
      "labor_tracking today"
    ),
    handleList<LaborWeekRow>(
      supabase
        .from("labor_tracking")
        .select("allowed_hours, current_hours")
        .eq("shop_id", shopKey)
        .gte("date", weekStartISO)
        .lte("date", todayISO),
      "labor_tracking week"
    ),
    handleList<StaffRow>(
      supabase
        .from("shop_staff")
        .select("id, date_of_hired")
        .eq("shop_id", shopKey),
      "shop_staff"
    ),
    handleList<TrainingRow>(
      supabase
        .from("employee_training")
        .select("id, training_status")
        .eq("shop_id", shopKey),
      "employee_training"
    ),
    handleList<CadenceRow>(
      supabase
        .from("daily_cadence")
        .select("id, completed")
        .eq("shop_id", shopKey)
        .eq("date", todayISO),
      "daily_cadence today"
    ),
    handleList<CadenceRow>(
      supabase
        .from("daily_cadence")
        .select("id, completed")
        .eq("shop_id", shopKey)
        .gte("date", weekStartISO)
        .lte("date", todayISO),
      "daily_cadence week"
    ),
    handleList<ChallengeRow>(
      supabase
        .from("challenges_log")
        .select("id")
        .eq("shop_id", shopKey)
        .gte("created_at", todayStart.toISOString()),
      "challenges today"
    ),
    handleList<ChallengeRow>(
      supabase
        .from("challenges_log")
        .select("id")
        .eq("shop_id", shopKey)
        .gte("created_at", weekStartDate.toISOString()),
      "challenges week"
    ),
    handleList<ScheduleRow>(
      supabase
        .from("dm_schedule")
        .select("id, date, visit_type, location_text, notes")
        .eq("location_id", shopKey)
        .gte("date", todayISO)
        .order("date", { ascending: true })
        .limit(5),
      "dm_schedule"
    ),
    handleList<DmLogRow>(
      supabase
        .from("dm_logbook")
        .select("id, log_type, log_date, scoring_percentage, submitted_by")
        .eq("shop_number", shopKey)
        .order("created_at", { ascending: false })
        .limit(5),
      "dm_logbook"
    ),
    handleList<InventoryRow>(
      supabase
        .from("inventory_counts_v2")
        .select("count_date, floor_count, storage_count, category")
        .eq("shop_id", shopKey)
        .order("count_date", { ascending: false })
        .limit(120),
      "inventory_counts_v2"
    ),
    handleList<SupplyOrderRow>(
      supabase
        .from("supply_orders")
        .select("id, status")
        .eq("shop_id", shopKey)
        .in("status", ["pending", "submitted"]),
      "supply_orders"
    ),
    handleList<ClaimRow>(
      supabase
        .from("claims")
        .select("id")
        .eq("shop_id", shopKey)
        .gte("created_at", todayStart.toISOString()),
      "claims today"
    ),
    handleList<ClaimRow>(
      supabase
        .from("claims")
        .select("id")
        .eq("shop_id", shopKey)
        .gte("created_at", weekStartDate.toISOString()),
      "claims week"
    ),
    handleList<SolinkRow>(
      supabase
        .from("solink_audits")
        .select("id")
        .eq("shop_id", shopKey)
        .gte("created_at", todayStart.toISOString()),
      "solink_audits"
    ),
    handleList<TurnedRow>(
      supabase
        .from("turned_logs")
        .select("id")
        .eq("shop_id", shopKey)
        .gte("created_at", todayStart.toISOString()),
      "turned_logs"
    ),
    handleList<TermedRow>(
      supabase
        .from("termed_employees")
        .select("id")
        .eq("shop_id", shopKey)
        .gte("date_of_termination", yearStartISO),
      "termed_employees"
    ),
  ]);

  const weeklyAllowed = laborWeekRows.reduce((sum, row) => sum + Number(row.allowed_hours ?? 0), 0);
  const weeklyUsed = laborWeekRows.reduce((sum, row) => sum + Number(row.current_hours ?? 0), 0);

  const staffCount = staffRows.length;
  const hireDates = staffRows.map((row) => row.date_of_hired ?? null);
  const avgTenureMonths = calculateAvgTenure(hireDates);
  const staffedToParPct = STAFFING_PAR_TARGET > 0 ? Math.round((staffCount / STAFFING_PAR_TARGET) * 100) : 0;

  const completedTraining = trainingRows.filter((row) => row.training_status === "completed").length;
  const inTrainingCount = trainingRows.filter((row) => row.training_status === "in_progress").length;
  const trainingCompletionPct = trainingRows.length
    ? Math.round((completedTraining / trainingRows.length) * 100)
    : 0;

  const cadenceDailyPct = cadenceTodayRows.length
    ? Math.round(
        (cadenceTodayRows.filter((row) => row.completed).length / cadenceTodayRows.length) * 100
      )
    : 0;
  const cadenceWeeklyPct = cadenceWeekRows.length
    ? Math.round(
        (cadenceWeekRows.filter((row) => row.completed).length / cadenceWeekRows.length) * 100
      )
    : 0;

  let inventoryTotal = 0;
  let inventoryOils = 0;
  let latestCountDate: string | null = null;
  if (inventoryRows.length) {
    latestCountDate = inventoryRows[0]?.count_date ?? null;
    const latestRows = inventoryRows.filter((row) => row.count_date === latestCountDate);
    latestRows.forEach((row) => {
      const floor = Number(row.floor_count || 0);
      const storage = Number(row.storage_count || 0);
      const total = floor + storage;
      inventoryTotal += total;
      if ((row.category ?? "").toLowerCase() === "oils") {
        inventoryOils += total;
      }
    });
  }

  const laborVarianceToday = Number(laborToday?.variance ?? 0);
  const challengesToday = challengesTodayRows.length;
  const challengesWeek = challengesWeekRows.length;

  const alerts: string[] = [];
  if (laborVarianceToday > 0) {
    alerts.push(`Labor is over plan by ${laborVarianceToday.toFixed(1)} hrs`);
  }
  if (cadenceTodayRows.length > 0 && cadenceDailyPct < 80) {
    alerts.push("Cadence completion is below goal today");
  }
  if (trainingRows.length > 0 && trainingCompletionPct < 85) {
    alerts.push("Training compliance below 85%");
  }

  return {
    updatedAt: now.toISOString(),
    labor: {
      carsToday: Number(laborToday?.total_cars ?? 0),
      allowedToday: Number(laborToday?.allowed_hours ?? 0),
      usedToday: Number(laborToday?.current_hours ?? 0),
      varianceToday: laborVarianceToday,
      weeklyAllowed,
      weeklyUsed,
      turnedCars: turnedRows.length,
    },
    staffing: {
      currentCount: staffCount,
      staffedToParPct,
      avgTenureMonths,
      termsYTD: termsRows.length,
    },
    training: {
      completionPct: trainingCompletionPct,
      inTrainingCount,
    },
    cadence: {
      dailyPct: cadenceDailyPct,
      weeklyPct: cadenceWeeklyPct,
      challengesToday,
      challengesWeek,
    },
    visits: {
      upcoming: scheduleRows.map((row) => ({
        id: row.id,
        date: row.date,
        visitType: row.visit_type ?? null,
        location: row.location_text ?? null,
        notes: row.notes ?? null,
      })),
      recent: dmLogRows.map((row) => ({
        id: row.id,
        date: row.log_date ?? null,
        type: row.log_type ?? "dm_visit",
        score: row.scoring_percentage ?? null,
        submittedBy: row.submitted_by ?? null,
      })),
    },
    admin: {
      claimsToday: claimsTodayRows.length,
      claimsWeek: claimsWeekRows.length,
      solinksToday: solinkRows.length,
    },
    inventory: {
      totalItems: inventoryTotal,
      oilsItems: inventoryOils,
      lastCountDate: latestCountDate,
      pendingOrders: supplyOrders.length,
    },
    alerts,
  };
}

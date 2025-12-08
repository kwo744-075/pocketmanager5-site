import { pulseSupabase } from "@/lib/supabaseClient";
import { buildTotalsSelectColumns, runSelectWithFuelFilterFallback } from "@/lib/fuelFilterFallback";

export type PulseTotals = {
  cars: number;
  sales: number;
  big4: number;
  coolants: number;
  diffs: number;
  fuelFilters: number;
  donations: number;
  mobil1: number;
};

export type PulseTotalsResult = {
  daily: PulseTotals;
  weekly: PulseTotals;
};

type TotalsRow = {
  total_cars: number | null;
  total_sales: number | null;
  total_big4: number | null;
  total_coolants: number | null;
  total_diffs: number | null;
  total_fuel_filters: number | null;
  total_donations: number | null;
  total_mobil1: number | null;
};

const EMPTY_TOTALS: PulseTotals = {
  cars: 0,
  sales: 0,
  big4: 0,
  coolants: 0,
  diffs: 0,
  fuelFilters: 0,
  donations: 0,
  mobil1: 0,
};

const todayISO = () => new Date().toISOString().split("T")[0];

const getWeekStartISO = () => {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day;
  const first = new Date(now.setDate(diff));
  return first.toISOString().split("T")[0];
};

const buildTotals = (row: TotalsRow | null): PulseTotals => ({
  cars: row?.total_cars ?? 0,
  sales: row?.total_sales ?? 0,
  big4: row?.total_big4 ?? 0,
  coolants: row?.total_coolants ?? 0,
  diffs: row?.total_diffs ?? 0,
  fuelFilters: row?.total_fuel_filters ?? 0,
  donations: row?.total_donations ?? 0,
  mobil1: row?.total_mobil1 ?? 0,
});

export async function fetchShopTotals(shopId: string): Promise<PulseTotalsResult> {
  const dailyDate = todayISO();
  const weekStart = getWeekStartISO();

  const [dailyResponse, weeklyResponse] = await Promise.all([
    runSelectWithFuelFilterFallback<TotalsRow | null>((includeFuelFilters) =>
      pulseSupabase
        .from("shop_daily_totals")
        .select(buildTotalsSelectColumns(includeFuelFilters))
        .eq("shop_id", shopId)
        .eq("check_in_date", dailyDate)
        .maybeSingle()
    ),
    runSelectWithFuelFilterFallback<TotalsRow | null>((includeFuelFilters) =>
      pulseSupabase
        .from("shop_wtd_totals")
        .select(buildTotalsSelectColumns(includeFuelFilters))
        .eq("shop_id", shopId)
        .eq("week_start", weekStart)
        .order("current_date", { ascending: false })
        .limit(1)
        .maybeSingle()
    ),
  ]);

  return {
    daily: buildTotals(dailyResponse.data ?? null),
    weekly: buildTotals(weeklyResponse.data ?? null),
  };
}

export { EMPTY_TOTALS };

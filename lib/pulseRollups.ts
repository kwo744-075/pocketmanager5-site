import { pulseSupabase } from "@/lib/supabaseClient";

const toSafeNumber = (value: number | null | undefined): number => value ?? 0;

export type RollupSlice = {
  cars: number;
  sales: number;
  aro: number | null;
  big4Pct: number | null;
  coolantsPct: number | null;
  diffsPct: number | null;
  mobil1Pct: number | null;
  fuelFilters: number;
  donations: number;
};

export type RollupSummary = {
  scope: "SHOP" | "DISTRICT" | "REGION" | "DIVISION";
  label: string;
  daily: RollupSlice;
  weekly: RollupSlice;
};

type TotalsRow = {
  total_cars: number | null;
  total_sales: number | null;
  total_big4: number | null;
  total_coolants?: number | null;
  total_diffs?: number | null;
  total_fuel_filters?: number | null;
  total_donations?: number | null;
  total_mobil1?: number | null;
  daily_aro?: number | null;
  daily_big4_percent?: number | null;
  daily_coolant_percent?: number | null;
  daily_diffs_percent?: number | null;
  daily_mobil1_percent?: number | null;
  wtd_aro?: number | null;
  wtd_big4_percent?: number | null;
  wtd_coolant_percent?: number | null;
  wtd_diffs_percent?: number | null;
  wtd_mobil1_percent?: number | null;
  district_name?: string | null;
  region_name?: string | null;
  division_name?: string | null;
};

type RollupFetchInput = {
  districtId?: string | null;
  regionId?: string | null;
  divisionId?: string | null;
  districtLabel?: string | null;
  regionLabel?: string | null;
  divisionLabel?: string | null;
  dailyDate: string;
  weekStart: string;
};

const resolvePercent = (
  provided: number | null | undefined,
  numerator: number | null | undefined,
  denominator: number
) => {
  if (typeof provided === "number") {
    return provided;
  }
  const safeNumerator = toSafeNumber(numerator);
  if (denominator <= 0) {
    return null;
  }
  return (safeNumerator / denominator) * 100;
};

const buildDailySlice = (row: TotalsRow | null): RollupSlice => {
  if (!row) {
    return {
      cars: 0,
      sales: 0,
      aro: null,
      big4Pct: null,
      coolantsPct: null,
      diffsPct: null,
      mobil1Pct: null,
      fuelFilters: 0,
      donations: 0,
    };
  }
  const cars = toSafeNumber(row.total_cars);
  const sales = toSafeNumber(row.total_sales);
  const big4 = toSafeNumber(row.total_big4);
  const aro = row.daily_aro ?? (cars > 0 ? sales / cars : null);
  const coolants = toSafeNumber(row.total_coolants);
  const diffs = toSafeNumber(row.total_diffs);
  const mobil1 = toSafeNumber(row.total_mobil1);
  const fuelFilters = toSafeNumber(row.total_fuel_filters);
  return {
    cars,
    sales,
    aro,
    big4Pct: resolvePercent(row.daily_big4_percent, big4, cars),
    coolantsPct: resolvePercent(row.daily_coolant_percent, coolants, cars),
    diffsPct: resolvePercent(row.daily_diffs_percent, diffs, cars),
    mobil1Pct: resolvePercent(row.daily_mobil1_percent, mobil1, cars),
    fuelFilters,
    donations: toSafeNumber(row.total_donations),
  };
};

const buildWeeklySlice = (row: TotalsRow | null): RollupSlice => {
  if (!row) {
    return {
      cars: 0,
      sales: 0,
      aro: null,
      big4Pct: null,
      coolantsPct: null,
      diffsPct: null,
      mobil1Pct: null,
      fuelFilters: 0,
      donations: 0,
    };
  }
  const cars = toSafeNumber(row.total_cars);
  const sales = toSafeNumber(row.total_sales);
  const big4 = toSafeNumber(row.total_big4);
  const aro = row.wtd_aro ?? (cars > 0 ? sales / cars : null);
  const coolants = toSafeNumber(row.total_coolants);
  const diffs = toSafeNumber(row.total_diffs);
  const mobil1 = toSafeNumber(row.total_mobil1);
  const fuelFilters = toSafeNumber(row.total_fuel_filters);
  return {
    cars,
    sales,
    aro,
    big4Pct: resolvePercent(row.wtd_big4_percent, big4, cars),
    coolantsPct: resolvePercent(row.wtd_coolant_percent, coolants, cars),
    diffsPct: resolvePercent(row.wtd_diffs_percent, diffs, cars),
    mobil1Pct: resolvePercent(row.wtd_mobil1_percent, mobil1, cars),
    fuelFilters,
    donations: toSafeNumber(row.total_donations),
  };
};

const buildRollupSummary = (
  scope: RollupSummary["scope"],
  label: string,
  dailyRow: TotalsRow | null,
  weeklyRow: TotalsRow | null
): RollupSummary => ({
  scope,
  label,
  daily: buildDailySlice(dailyRow),
  weekly: buildWeeklySlice(weeklyRow),
});

const handleResponse = async <T>(promise: PromiseLike<{ data: T | null; error: { code?: string } | null }>) => {
  const response = await promise;
  if (response.error && response.error.code !== "PGRST116") {
    throw response.error;
  }
  return response.data;
};

export async function fetchHierarchyRollups({
  districtId,
  regionId,
  divisionId,
  districtLabel,
  regionLabel,
  divisionLabel,
  dailyDate,
  weekStart,
}: RollupFetchInput): Promise<{
  district: RollupSummary | null;
  region: RollupSummary | null;
  division: RollupSummary | null;
}> {
  const [districtDaily, districtWeekly, regionDaily, regionWeekly, divisionDaily, divisionWeekly] = await Promise.all([
    districtId
      ? handleResponse<TotalsRow>(
          pulseSupabase
            .from("district_daily_totals")
            .select(
              "total_cars,total_sales,total_big4,total_coolants,total_diffs,total_fuel_filters,total_donations,total_mobil1,daily_aro,daily_big4_percent,daily_coolant_percent,daily_diffs_percent,daily_mobil1_percent,district_name"
            )
            .eq("district_id", districtId)
            .eq("check_in_date", dailyDate)
            .maybeSingle()
        )
      : Promise.resolve(null),
    districtId
      ? handleResponse<TotalsRow>(
          pulseSupabase
            .from("district_wtd_totals")
            .select(
              "total_cars,total_sales,total_big4,total_coolants,total_diffs,total_fuel_filters,total_donations,total_mobil1,wtd_aro,wtd_big4_percent,wtd_coolant_percent,wtd_diffs_percent,wtd_mobil1_percent,district_name"
            )
            .eq("district_id", districtId)
            .eq("week_start", weekStart)
            .order("current_date", { ascending: false })
            .limit(1)
            .maybeSingle()
        )
      : Promise.resolve(null),
    regionId
      ? handleResponse<TotalsRow>(
          pulseSupabase
            .from("region_daily_totals")
            .select(
              "total_cars,total_sales,total_big4,total_coolants,total_diffs,total_fuel_filters,total_donations,total_mobil1,daily_aro,daily_big4_percent,daily_coolant_percent,daily_diffs_percent,daily_mobil1_percent,region_name"
            )
            .eq("region_id", regionId)
            .eq("check_in_date", dailyDate)
            .maybeSingle()
        )
      : Promise.resolve(null),
    regionId
      ? handleResponse<TotalsRow>(
          pulseSupabase
            .from("region_wtd_totals")
            .select(
              "total_cars,total_sales,total_big4,total_coolants,total_diffs,total_fuel_filters,total_donations,total_mobil1,wtd_aro,wtd_big4_percent,wtd_coolant_percent,wtd_diffs_percent,wtd_mobil1_percent,region_name"
            )
            .eq("region_id", regionId)
            .eq("week_start", weekStart)
            .order("current_date", { ascending: false })
            .limit(1)
            .maybeSingle()
        )
      : Promise.resolve(null),
    divisionId
      ? handleResponse<TotalsRow>(
          pulseSupabase
            .from("division_daily_totals")
            .select(
              "total_cars,total_sales,total_big4,total_coolants,total_diffs,total_fuel_filters,total_donations,total_mobil1,daily_aro,daily_big4_percent,daily_coolant_percent,daily_diffs_percent,daily_mobil1_percent,division_name"
            )
            .eq("division_id", divisionId)
            .eq("check_in_date", dailyDate)
            .maybeSingle()
        )
      : Promise.resolve(null),
    divisionId
      ? handleResponse<TotalsRow>(
          pulseSupabase
            .from("division_wtd_totals")
            .select(
              "total_cars,total_sales,total_big4,total_coolants,total_diffs,total_fuel_filters,total_donations,total_mobil1,wtd_aro,wtd_big4_percent,wtd_coolant_percent,wtd_diffs_percent,wtd_mobil1_percent,division_name"
            )
            .eq("division_id", divisionId)
            .eq("week_start", weekStart)
            .order("current_date", { ascending: false })
            .limit(1)
            .maybeSingle()
        )
      : Promise.resolve(null),
  ]);

  const district = districtId
    ? buildRollupSummary(
        "DISTRICT",
        districtLabel ?? districtDaily?.district_name ?? districtWeekly?.district_name ?? "Your district",
        districtDaily,
        districtWeekly
      )
    : null;

  const region = regionId
    ? buildRollupSummary(
        "REGION",
        regionLabel ?? regionDaily?.region_name ?? regionWeekly?.region_name ?? "Your region",
        regionDaily,
        regionWeekly
      )
    : null;

  const division = divisionId
    ? buildRollupSummary(
        "DIVISION",
        divisionLabel ?? divisionDaily?.division_name ?? divisionWeekly?.division_name ?? "Your division",
        divisionDaily,
        divisionWeekly
      )
    : null;

  return { district, region, division };
}

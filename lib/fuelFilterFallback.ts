export type PostgrestErrorShape = {
  code?: string;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

export type PostgrestResponseShape<T> = {
  data: T;
  error: PostgrestErrorShape | null;
};

export class FuelFilterSchemaError extends Error {
  constructor(message?: string | null) {
    super(message ?? "Fuel filter column missing in schema cache");
    this.name = "FuelFilterSchemaError";
  }
}

const containsFuelFilterKeyword = (value: unknown) =>
  typeof value === "string" && value.toLowerCase().includes("fuel_filters");

const isFuelFilterSchemaIssue = (error: unknown): boolean => {
  if (!error) return false;
  if (error instanceof FuelFilterSchemaError) {
    return true;
  }
  if (typeof error === "string") {
    return containsFuelFilterKeyword(error);
  }
  if (typeof error === "object") {
    const candidate = error as Partial<PostgrestErrorShape> & { message?: string };
    return (
      containsFuelFilterKeyword(candidate.message) ||
      containsFuelFilterKeyword(candidate.details) ||
      containsFuelFilterKeyword(candidate.hint)
    );
  }
  return false;
};

export const buildCheckInSelectColumns = (includeFuelFilters: boolean) => {
  const columns = ["time_slot", "cars", "sales", "big4", "coolants", "diffs"];
  if (includeFuelFilters) {
    columns.push("fuel_filters");
  }
  columns.push("donations", "mobil1", "temperature", "is_submitted", "submitted_at");
  return columns.join(",");
};

type TotalsColumnOptions = {
  leading?: string[];
  trailing?: string[];
};

export const buildTotalsSelectColumns = (
  includeFuelFilters: boolean,
  options?: TotalsColumnOptions,
) => {
  const columns = [...(options?.leading ?? [])];
  columns.push("total_cars", "total_sales", "total_big4", "total_coolants", "total_diffs");
  if (includeFuelFilters) {
    columns.push("total_fuel_filters");
  }
  columns.push("total_donations", "total_mobil1");
  if (options?.trailing?.length) {
    columns.push(...options.trailing);
  }
  return columns.join(",");
};

export const runSelectWithFuelFilterFallback = async <T>(
  factory: (includeFuelFilters: boolean) => Promise<PostgrestResponseShape<T>>,
): Promise<PostgrestResponseShape<T>> => {
  const attempt = async (includeFuelFilters: boolean): Promise<PostgrestResponseShape<T>> => {
    const response = await factory(includeFuelFilters);
    const error = response.error;
    if (error && error.code !== "PGRST116") {
      if (includeFuelFilters && isFuelFilterSchemaIssue(error)) {
        throw new FuelFilterSchemaError(error.message);
      }
      throw error;
    }
    return response;
  };

  try {
    return await attempt(true);
  } catch (error) {
    if (isFuelFilterSchemaIssue(error)) {
      console.warn("Fuel filter column missing from schema cache; retrying without it.");
      return attempt(false);
    }
    throw error;
  }
};

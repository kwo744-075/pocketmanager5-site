export type CachedHierarchySummary = {
  login?: string | null;
  scope_level?: string | null;
  division_name?: string | null;
  region_name?: string | null;
  district_name?: string | null;
  shop_number?: string | null;
  shops_in_district?: number | null;
  districts_in_region?: number | null;
  shops_in_region?: number | null;
  regions_in_division?: number | null;
  shops_in_division?: number | null;
};

const HIERARCHY_CACHE_KEY = "hierarchySummary";

export const normalizeLogin = (login?: string | null) => login?.trim().toLowerCase() ?? null;

export const readHierarchySummaryCache = (): CachedHierarchySummary | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(HIERARCHY_CACHE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as CachedHierarchySummary;
  } catch (err) {
    console.warn("hierarchySummary cache parse error", err);
    return null;
  }
};

export const writeHierarchySummaryCache = (summary: CachedHierarchySummary | null) => {
  if (typeof window === "undefined") {
    return;
  }

  if (!summary) {
    window.localStorage.removeItem(HIERARCHY_CACHE_KEY);
    return;
  }

  try {
    window.localStorage.setItem(HIERARCHY_CACHE_KEY, JSON.stringify(summary));
  } catch (err) {
    console.warn("hierarchySummary cache write error", err);
  }
};

export const getCachedSummaryForLogin = (
  login?: string | null
): CachedHierarchySummary | null => {
  const normalizedLogin = normalizeLogin(login);
  if (!normalizedLogin) {
    return null;
  }

  const cached = readHierarchySummaryCache();
  if (!cached) {
    return null;
  }

  const cachedLogin = normalizeLogin(cached.login ?? null);
  return cachedLogin === normalizedLogin ? cached : null;
};

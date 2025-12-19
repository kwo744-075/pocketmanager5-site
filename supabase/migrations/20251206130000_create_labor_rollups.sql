-- Migration: labor scope rollups + district compliance helpers
-- Provides RPC helpers so Pocket Manager can power region/district/shop labor dashboards.

-- Ensure shops has the columns expected by these rollup functions
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shops') THEN
    EXECUTE 'ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS shop_name text';
    EXECUTE 'ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS district_name text';
    EXECUTE 'ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS region_name text';
  END IF;
END$$;

CREATE OR REPLACE FUNCTION public.labor_scope_rollup(
  p_scope text DEFAULT 'district',
  p_region text DEFAULT NULL,
  p_district text DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_limit integer DEFAULT 100,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  scope text,
  scope_key text,
  scope_name text,
  district_name text,
  region_name text,
  shop_number text,
  total_entries bigint,
  allowed_hours numeric,
  actual_hours numeric,
  variance_hours numeric,
  avg_expected_pct numeric,
  avg_actual_pct numeric,
  latest_entry date
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
WITH normalized AS (
  SELECT
    le.date,
    COALESCE(le.expected_labor_pct, 0) AS expected_labor_pct,
    COALESCE(le.actual_labor_pct, 0) AS actual_labor_pct,
    COALESCE(s.district_name, 'Unassigned') AS district_name,
    COALESCE(s.region_name, 'Unassigned') AS region_name,
    COALESCE(s.shop_number, le.shop_id) AS shop_number,
    COALESCE(s.shop_name, 'Shop ' || COALESCE(s.shop_number, le.shop_id)) AS shop_name
  FROM labor_entries le
  LEFT JOIN shops s ON s.shop_number = le.shop_id
  WHERE (p_region IS NULL OR (s.region_name IS NOT NULL AND s.region_name = p_region))
    AND (p_district IS NULL OR (s.district_name IS NOT NULL AND s.district_name = p_district))
),
selector AS (
  SELECT
    CASE
      WHEN lower(coalesce(p_scope, '')) = 'region' THEN 'region'
      WHEN lower(coalesce(p_scope, '')) = 'shop' THEN 'shop'
      ELSE 'district'
    END AS scope_level,
    n.*
  FROM normalized n
),
grouped AS (
  SELECT
    scope_level,
    CASE
      WHEN scope_level = 'region' THEN region_name
      WHEN scope_level = 'shop' THEN shop_number
      ELSE district_name
    END AS scope_key_value,
    CASE
      WHEN scope_level = 'region' THEN region_name
      WHEN scope_level = 'shop' THEN shop_name
      ELSE district_name
    END AS scope_display,
    MIN(district_name) AS sample_district,
    MIN(region_name) AS sample_region,
    MIN(shop_number) AS sample_shop,
    COUNT(*)::bigint AS total_entries,
    SUM(expected_labor_pct)::numeric AS allowed_hours,
    SUM(actual_labor_pct)::numeric AS actual_hours,
    SUM(actual_labor_pct - expected_labor_pct)::numeric AS variance_hours,
    AVG(expected_labor_pct)::numeric AS avg_expected_pct,
    AVG(actual_labor_pct)::numeric AS avg_actual_pct,
    MAX(date) AS latest_entry
  FROM selector
  GROUP BY scope_level, scope_key_value, scope_display
)
SELECT
  scope_level AS scope,
  scope_key_value AS scope_key,
  scope_display AS scope_name,
  CASE
    WHEN scope_level = 'district' THEN scope_display
    WHEN scope_level = 'shop' THEN sample_district
    ELSE NULL
  END AS district_name,
  CASE
    WHEN scope_level = 'region' THEN scope_display
    ELSE sample_region
  END AS region_name,
  CASE WHEN scope_level = 'shop' THEN sample_shop ELSE NULL END AS shop_number,
  total_entries,
  ROUND(allowed_hours, 2) AS allowed_hours,
  ROUND(actual_hours, 2) AS actual_hours,
  ROUND(variance_hours, 2) AS variance_hours,
  ROUND(avg_expected_pct, 2) AS avg_expected_pct,
  ROUND(avg_actual_pct, 2) AS avg_actual_pct,
  latest_entry
FROM grouped
WHERE (p_search IS NULL OR scope_display ILIKE '%' || p_search || '%')
ORDER BY scope_display
LIMIT GREATEST(COALESCE(p_limit, 50), 1)
OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$$;

GRANT EXECUTE ON FUNCTION public.labor_scope_rollup(text, text, text, text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.labor_scope_rollup(text, text, text, text, integer, integer) TO service_role;


CREATE OR REPLACE FUNCTION public.labor_district_compliance(
  p_region text DEFAULT NULL,
  p_week_start date DEFAULT date_trunc('week', current_date)::date
)
RETURNS TABLE (
  district_name text,
  region_name text,
  week_start date,
  week_end date,
  entries_this_week bigint,
  allowed_hours numeric,
  total_hours numeric,
  overtime_hours numeric,
  latest_entry date
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
WITH params AS (
  SELECT
    p_week_start AS week_start,
    (p_week_start + INTERVAL '6 days')::date AS week_end
),
normalized AS (
  SELECT
    COALESCE(s.district_name, 'Unassigned') AS district_name,
    COALESCE(s.region_name, 'Unassigned') AS region_name,
    le.date,
    COALESCE(le.expected_labor_pct, 0) AS expected_labor_pct,
    COALESCE(le.actual_labor_pct, 0) AS actual_labor_pct
  FROM labor_entries le
  LEFT JOIN shops s ON s.shop_number = le.shop_id
  WHERE (p_region IS NULL OR s.region_name = p_region)
),
scoped AS (
  SELECT n.*, p.week_start, p.week_end
  FROM normalized n
  CROSS JOIN params p
)
SELECT
  district_name,
  region_name,
  week_start,
  week_end,
  COUNT(*) FILTER (WHERE date BETWEEN week_start AND week_end)::bigint AS entries_this_week,
  ROUND(COALESCE(SUM(expected_labor_pct) FILTER (WHERE date BETWEEN week_start AND week_end), 0), 2) AS allowed_hours,
  ROUND(COALESCE(SUM(actual_labor_pct) FILTER (WHERE date BETWEEN week_start AND week_end), 0), 2) AS total_hours,
  ROUND(COALESCE(SUM(GREATEST(actual_labor_pct - expected_labor_pct, 0)) FILTER (WHERE date BETWEEN week_start AND week_end), 0), 2) AS overtime_hours,
  MAX(date) FILTER (WHERE date BETWEEN week_start AND week_end) AS latest_entry
FROM scoped
GROUP BY district_name, region_name, week_start, week_end
ORDER BY district_name;
$$;

GRANT EXECUTE ON FUNCTION public.labor_district_compliance(text, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.labor_district_compliance(text, date) TO service_role;

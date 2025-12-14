-- Ensure canonical rollup functions/triggers for shop daily and WTD totals
-- Creates `update_shop_daily_totals` and `update_shop_wtd_totals`, triggers,
-- and includes backfill for `fuel_filters`.
-- Intended to be run on the target Supabase/Postgres database with a
-- service-role account (has permission to create functions/triggers).

-- 1) Daily totals function
CREATE OR REPLACE FUNCTION update_shop_daily_totals()
RETURNS TRIGGER AS $$
DECLARE
  v_shop_id UUID;
  v_check_in_date DATE;
BEGIN
  v_shop_id := NEW.shop_id;
  v_check_in_date := NEW.check_in_date;

  INSERT INTO shop_daily_totals (
    shop_id,
    check_in_date,
    total_cars,
    total_sales,
    total_big4,
    total_coolants,
    total_diffs,
    total_donations,
    total_mobil1,
    total_staffing,
    total_fuel_filters,
    last_submission_time,
    last_submission_slot,
    checkins_completed,
    updated_at
  )
  SELECT 
    v_shop_id,
    v_check_in_date,
    COALESCE(SUM(cars), 0),
    COALESCE(SUM(sales), 0),
    COALESCE(SUM(big4), 0),
    COALESCE(SUM(coolants), 0),
    COALESCE(SUM(diffs), 0),
    COALESCE(SUM(donations), 0),
    COALESCE(SUM(mobil1), 0),
    COALESCE(SUM(staffing), 0),
    COALESCE(SUM(fuel_filters), 0),
    NEW.submitted_at,
    NEW.time_slot,
    COUNT(*),
    NOW()
  FROM check_ins
  WHERE shop_id = v_shop_id
    AND check_in_date = v_check_in_date
    AND is_submitted = true
  ON CONFLICT (shop_id, check_in_date)
  DO UPDATE SET
    total_cars = EXCLUDED.total_cars,
    total_sales = EXCLUDED.total_sales,
    total_big4 = EXCLUDED.total_big4,
    total_coolants = EXCLUDED.total_coolants,
    total_diffs = EXCLUDED.total_diffs,
    total_donations = EXCLUDED.total_donations,
    total_mobil1 = EXCLUDED.total_mobil1,
    total_staffing = EXCLUDED.total_staffing,
    total_fuel_filters = EXCLUDED.total_fuel_filters,
    last_submission_time = EXCLUDED.last_submission_time,
    last_submission_slot = EXCLUDED.last_submission_slot,
    checkins_completed = EXCLUDED.checkins_completed,
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2) WTD totals function
CREATE OR REPLACE FUNCTION update_shop_wtd_totals()
RETURNS TRIGGER AS $$
DECLARE
  v_shop_id UUID;
  v_check_in_date DATE;
  v_week_start DATE;
  v_total_cars INTEGER;
  v_total_sales NUMERIC;
  v_total_big4 INTEGER;
  v_total_coolants INTEGER;
  v_total_diffs INTEGER;
  v_total_donations NUMERIC;
  v_total_mobil1 INTEGER;
  v_total_fuel_filters INTEGER;
  v_days_with_data INTEGER;
BEGIN
  v_shop_id := NEW.shop_id;
  v_check_in_date := NEW.check_in_date;
  v_week_start := DATE_TRUNC('week', v_check_in_date)::DATE;

  SELECT
    COALESCE(SUM(total_cars), 0),
    COALESCE(SUM(total_sales), 0),
    COALESCE(SUM(total_big4), 0),
    COALESCE(SUM(total_coolants), 0),
    COALESCE(SUM(total_diffs), 0),
    COALESCE(SUM(total_donations), 0),
    COALESCE(SUM(total_mobil1), 0),
    COALESCE(SUM(total_fuel_filters), 0),
    COUNT(*)
  INTO
    v_total_cars, v_total_sales, v_total_big4, v_total_coolants, v_total_diffs, v_total_donations, v_total_mobil1, v_total_fuel_filters, v_days_with_data
  FROM shop_daily_totals
  WHERE shop_id = v_shop_id
    AND check_in_date >= v_week_start
    AND check_in_date <= v_check_in_date;

  INSERT INTO shop_wtd_totals (
    shop_id, week_start, current_date,
    total_cars, total_sales, total_big4, total_coolants, total_diffs, total_donations, total_mobil1, total_fuel_filters,
    days_with_data, last_updated, updated_at
  ) VALUES (
    v_shop_id, v_week_start, v_check_in_date,
    v_total_cars, v_total_sales, v_total_big4, v_total_coolants, v_total_diffs, v_total_donations, v_total_mobil1, v_total_fuel_filters,
    v_days_with_data, NOW(), NOW()
  )
  ON CONFLICT (shop_id, week_start)
  DO UPDATE SET
    current_date = EXCLUDED.current_date,
    total_cars = EXCLUDED.total_cars,
    total_sales = EXCLUDED.total_sales,
    total_big4 = EXCLUDED.total_big4,
    total_coolants = EXCLUDED.total_coolants,
    total_diffs = EXCLUDED.total_diffs,
    total_donations = EXCLUDED.total_donations,
    total_mobil1 = EXCLUDED.total_mobil1,
    total_fuel_filters = EXCLUDED.total_fuel_filters,
    days_with_data = EXCLUDED.days_with_data,
    last_updated = NOW(),
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3) Create triggers (only when is_submitted = true)
DROP TRIGGER IF EXISTS trigger_update_shop_daily_totals ON check_ins;
CREATE TRIGGER trigger_update_shop_daily_totals
  AFTER INSERT OR UPDATE ON check_ins
  FOR EACH ROW
  WHEN (NEW.is_submitted = true)
  EXECUTE FUNCTION update_shop_daily_totals();

DROP TRIGGER IF EXISTS trigger_update_shop_wtd_totals ON check_ins;
CREATE TRIGGER trigger_update_shop_wtd_totals
  AFTER INSERT OR UPDATE ON check_ins
  FOR EACH ROW
  WHEN (NEW.is_submitted = true)
  EXECUTE FUNCTION update_shop_wtd_totals();

-- 4) Optional backfill: ensure totals include fuel_filters (safe idempotent updates)
-- Update daily totals from existing check_ins
UPDATE shop_daily_totals s
SET total_fuel_filters = COALESCE(src.total_fuel_filters, 0)
FROM (
  SELECT shop_id, check_in_date, COALESCE(SUM(fuel_filters), 0) AS total_fuel_filters
  FROM check_ins
  WHERE is_submitted = true
  GROUP BY shop_id, check_in_date
) AS src
WHERE s.shop_id = src.shop_id AND s.check_in_date = src.check_in_date;

-- Update WTD totals by recalculating per-week aggregates
WITH recalculated AS (
  SELECT
    shop_id,
    DATE_TRUNC('week', check_in_date)::DATE AS week_start,
    COALESCE(SUM(fuel_filters),0) AS total_fuel_filters,
    COUNT(DISTINCT check_in_date) AS days_with_data
  FROM check_ins
  WHERE is_submitted = true
  GROUP BY shop_id, DATE_TRUNC('week', check_in_date)::DATE
)
INSERT INTO shop_wtd_totals (shop_id, week_start, current_date, total_fuel_filters, days_with_data, last_updated, updated_at)
SELECT r.shop_id, r.week_start, NOW()::date, r.total_fuel_filters, r.days_with_data, NOW(), NOW()
FROM recalculated r
ON CONFLICT (shop_id, week_start) DO UPDATE
SET total_fuel_filters = EXCLUDED.total_fuel_filters,
    days_with_data = EXCLUDED.days_with_data,
    last_updated = NOW(),
    updated_at = NOW();

-- End of ensure_rollups.sql

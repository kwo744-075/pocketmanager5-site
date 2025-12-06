-- 2025-12-06 00:10:00: Add fuel_filters to check-in caches and rollups
-- This migration is a copy of the prepared migration to add `fuel_filters` to `check_ins` and propagate totals
-- into daily/WTD and higher-level rollups. It is intended to be applied to the linked Supabase project.

-- 1) Ensure base column exists on check_ins
ALTER TABLE IF EXISTS check_ins
  ADD COLUMN IF NOT EXISTS fuel_filters INTEGER;

UPDATE check_ins
SET fuel_filters = COALESCE(fuel_filters, 0)
WHERE fuel_filters IS NULL;

ALTER TABLE IF EXISTS check_ins
  ALTER COLUMN fuel_filters SET DEFAULT 0,
  ALTER COLUMN fuel_filters SET NOT NULL;

-- Helper to add a column if a relation exists and the column is missing
DO $$
DECLARE
  rel_name text;
  col_name text := 'total_fuel_filters';
BEGIN
  FOR rel_name IN (
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN (
        'shop_daily_totals',
        'shop_wtd_totals',
        'shop_wtd_evening_totals',
        'district_daily_totals',
        'district_wtd_totals',
        'region_daily_totals',
        'region_wtd_totals'
      )
  ) LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = rel_name
        AND column_name = col_name
    ) THEN
      EXECUTE format('ALTER TABLE %I ADD COLUMN %I INTEGER NOT NULL DEFAULT 0', rel_name, col_name);
    END IF;
  END LOOP;
END $$;

-- 2) Recreate trigger function for daily totals with fuel_filters
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

-- 3) Recreate trigger function for WTD totals with fuel_filters (runs on every submitted check-in)
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

-- 4) Ensure triggers exist (keeps behavior unchanged: daily on all submissions, WTD on all submissions)
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

-- 5) Backfill totals with fuel_filters to keep existing rollups consistent
UPDATE shop_daily_totals s
SET total_fuel_filters = COALESCE(src.total_fuel_filters, 0)
FROM (
  SELECT shop_id, check_in_date, COALESCE(SUM(fuel_filters), 0) AS total_fuel_filters
  FROM check_ins
  WHERE is_submitted = true
  GROUP BY shop_id, check_in_date
) src
WHERE s.shop_id = src.shop_id
  AND s.check_in_date = src.check_in_date;

UPDATE shop_wtd_totals w
SET total_fuel_filters = COALESCE(src.total_fuel_filters, 0)
FROM (
  SELECT shop_id, week_start, COALESCE(SUM(total_fuel_filters), 0) AS total_fuel_filters
  FROM shop_daily_totals
  GROUP BY shop_id, week_start
) src
WHERE w.shop_id = src.shop_id
  AND w.week_start = src.week_start;

-- Evening WTD cache (if present)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'shop_wtd_evening_totals'
  ) THEN
    UPDATE shop_wtd_evening_totals w
    SET total_fuel_filters = COALESCE(src.total_fuel_filters, 0)
    FROM (
      SELECT shop_id, week_start, COALESCE(SUM(total_fuel_filters), 0) AS total_fuel_filters
      FROM shop_daily_totals
      GROUP BY shop_id, week_start
    ) src
    WHERE w.shop_id = src.shop_id
      AND w.week_start = src.week_start;
  END IF;
END $$;

-- District / region rollups (best-effort backfill)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'district_daily_totals') THEN
    UPDATE district_daily_totals d
    SET total_fuel_filters = COALESCE(src.total_fuel_filters, 0)
    FROM (
      SELECT district_id, check_in_date, COALESCE(SUM(total_fuel_filters), 0) AS total_fuel_filters
      FROM shop_daily_totals s
      JOIN shops sh ON sh.id = s.shop_id
      WHERE sh.district_id IS NOT NULL
      GROUP BY district_id, check_in_date
    ) src
    WHERE d.district_id = src.district_id
      AND d.check_in_date = src.check_in_date;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'district_wtd_totals') THEN
    UPDATE district_wtd_totals d
    SET total_fuel_filters = COALESCE(src.total_fuel_filters, 0)
    FROM (
      SELECT district_id, week_start, COALESCE(SUM(total_fuel_filters), 0) AS total_fuel_filters
      FROM shop_wtd_totals s
      JOIN shops sh ON sh.id = s.shop_id
      WHERE sh.district_id IS NOT NULL
      GROUP BY district_id, week_start
    ) src
    WHERE d.district_id = src.district_id
      AND d.week_start = src.week_start;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'region_daily_totals') THEN
    UPDATE region_daily_totals r
    SET total_fuel_filters = COALESCE(src.total_fuel_filters, 0)
    FROM (
      SELECT region_id, check_in_date, COALESCE(SUM(total_fuel_filters), 0) AS total_fuel_filters
      FROM shop_daily_totals s
      JOIN shops sh ON sh.id = s.shop_id
      WHERE sh.region_id IS NOT NULL
      GROUP BY region_id, check_in_date
    ) src
    WHERE r.region_id = src.region_id
      AND r.check_in_date = src.check_in_date;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'region_wtd_totals') THEN
    UPDATE region_wtd_totals r
    SET total_fuel_filters = COALESCE(src.total_fuel_filters, 0)
    FROM (
      SELECT region_id, week_start, COALESCE(SUM(total_fuel_filters), 0) AS total_fuel_filters
      FROM shop_wtd_totals s
      JOIN shops sh ON sh.id = s.shop_id
      WHERE sh.region_id IS NOT NULL
      GROUP BY region_id, week_start
    ) src
    WHERE r.region_id = src.region_id
      AND r.week_start = src.week_start;
  END IF;
END $$;

-- Done: fuel_filters now flows through check_ins, daily, WTD, and higher-level rollups.

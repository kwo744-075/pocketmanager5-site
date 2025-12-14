-- 2025-12-06 00:10:00: Add fuel_filters to check-in caches and rollups

/* ---------------------------------------------------------
   1) Ensure fuel_filters column on check_ins (guarded)
--------------------------------------------------------- */
DO $$
BEGIN
  IF to_regclass('public.check_ins') IS NOT NULL THEN

    ALTER TABLE public.check_ins
      ADD COLUMN IF NOT EXISTS fuel_filters INTEGER;

    UPDATE public.check_ins
    SET fuel_filters = COALESCE(fuel_filters, 0)
    WHERE fuel_filters IS NULL;

    ALTER TABLE public.check_ins
      ALTER COLUMN fuel_filters SET DEFAULT 0,
      ALTER COLUMN fuel_filters SET NOT NULL;

  ELSE
    RAISE NOTICE 'relation public.check_ins does not exist; skipping fuel_filters setup';
  END IF;
END $$;

/* ---------------------------------------------------------
   2) Ensure total_fuel_filters exists on rollup tables
--------------------------------------------------------- */
DO $$
DECLARE
  rel_name text;
BEGIN
  FOR rel_name IN (
    SELECT table_name
    FROM information_schema.tables
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
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = rel_name
        AND column_name = 'total_fuel_filters'
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD COLUMN total_fuel_filters INTEGER NOT NULL DEFAULT 0',
        rel_name
      );
    END IF;
  END LOOP;
END $$;

/* ---------------------------------------------------------
   3) Daily totals trigger function
--------------------------------------------------------- */
CREATE OR REPLACE FUNCTION update_shop_daily_totals()
RETURNS TRIGGER AS $$
DECLARE
  v_shop_id UUID := NEW.shop_id;
  v_check_in_date DATE := NEW.check_in_date;
BEGIN
  INSERT INTO public.shop_daily_totals (
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
  FROM public.check_ins
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

/* ---------------------------------------------------------
   4) WTD totals trigger function (FIXED current_date)
--------------------------------------------------------- */
CREATE OR REPLACE FUNCTION update_shop_wtd_totals()
RETURNS TRIGGER AS $$
DECLARE
  v_shop_id UUID := NEW.shop_id;
  v_check_in_date DATE := NEW.check_in_date;
  v_week_start DATE := DATE_TRUNC('week', NEW.check_in_date)::DATE;
BEGIN
  INSERT INTO public.shop_wtd_totals (
    shop_id,
    week_start,
    "current_date",
    total_cars,
    total_sales,
    total_big4,
    total_coolants,
    total_diffs,
    total_donations,
    total_mobil1,
    total_fuel_filters,
    days_with_data,
    last_updated,
    updated_at
  )
  SELECT
    v_shop_id,
    v_week_start,
    v_check_in_date,
    COALESCE(SUM(total_cars), 0),
    COALESCE(SUM(total_sales), 0),
    COALESCE(SUM(total_big4), 0),
    COALESCE(SUM(total_coolants), 0),
    COALESCE(SUM(total_diffs), 0),
    COALESCE(SUM(total_donations), 0),
    COALESCE(SUM(total_mobil1), 0),
    COALESCE(SUM(total_fuel_filters), 0),
    COUNT(*),
    NOW(),
    NOW()
  FROM public.shop_daily_totals
  WHERE shop_id = v_shop_id
    AND check_in_date >= v_week_start
    AND check_in_date <= v_check_in_date
  ON CONFLICT (shop_id, week_start)
  DO UPDATE SET
    "current_date" = EXCLUDED."current_date",
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

/* ---------------------------------------------------------
   5) Triggers (only if check_ins exists)
--------------------------------------------------------- */
DO $$
BEGIN
  IF to_regclass('public.check_ins') IS NOT NULL THEN

    DROP TRIGGER IF EXISTS trigger_update_shop_daily_totals ON public.check_ins;
    CREATE TRIGGER trigger_update_shop_daily_totals
      AFTER INSERT OR UPDATE ON public.check_ins
      FOR EACH ROW
      WHEN (NEW.is_submitted = true)
      EXECUTE FUNCTION update_shop_daily_totals();

    DROP TRIGGER IF EXISTS trigger_update_shop_wtd_totals ON public.check_ins;
    CREATE TRIGGER trigger_update_shop_wtd_totals
      AFTER INSERT OR UPDATE ON public.check_ins
      FOR EACH ROW
      WHEN (NEW.is_submitted = true)
      EXECUTE FUNCTION update_shop_wtd_totals();

  ELSE
    RAISE NOTICE 'check_ins not present; skipping trigger creation';
  END IF;
END $$;

/* ---------------------------------------------------------
   6) Backfills (best-effort, guarded)
--------------------------------------------------------- */
DO $$
BEGIN
  IF to_regclass('public.check_ins') IS NOT NULL
     AND to_regclass('public.shop_daily_totals') IS NOT NULL THEN

    UPDATE public.shop_daily_totals s
    SET total_fuel_filters = COALESCE(src.total_fuel_filters, 0)
    FROM (
      SELECT shop_id, check_in_date, SUM(fuel_filters) AS total_fuel_filters
      FROM public.check_ins
      WHERE is_submitted = true
      GROUP BY shop_id, check_in_date
    ) src
    WHERE s.shop_id = src.shop_id
      AND s.check_in_date = src.check_in_date;

  END IF;
END $$;

-- DONE

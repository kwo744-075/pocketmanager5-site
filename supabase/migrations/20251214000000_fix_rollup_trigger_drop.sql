-- 2025-12-14 00:00:00: Safe trigger re-creation for rollups
-- Ensures `trigger_update_shop_daily_totals` and `trigger_update_shop_wtd_totals`
-- are dropped safely and recreated on `public.check_ins` using idempotent
-- `DROP TRIGGER IF EXISTS` commands. This is intended to be applied on
-- staging and then production if the canonical migration used an unsafe
-- invocation of `pg_trigger_drop`.

DO $$
BEGIN
  IF to_regclass('public.check_ins') IS NOT NULL THEN
    -- Drop triggers safely (idempotent)
    EXECUTE 'DROP TRIGGER IF EXISTS trigger_update_shop_daily_totals ON public.check_ins';
    EXECUTE 'DROP TRIGGER IF EXISTS trigger_update_shop_wtd_totals ON public.check_ins';

    -- Recreate triggers pointing to the canonical functions
    EXECUTE 'CREATE TRIGGER trigger_update_shop_daily_totals
      AFTER INSERT OR UPDATE ON public.check_ins
      FOR EACH ROW
      WHEN (NEW.is_submitted = true)
      EXECUTE FUNCTION update_shop_daily_totals();';

    EXECUTE 'CREATE TRIGGER trigger_update_shop_wtd_totals
      AFTER INSERT OR UPDATE ON public.check_ins
      FOR EACH ROW
      WHEN (NEW.is_submitted = true)
      EXECUTE FUNCTION update_shop_wtd_totals();';
  END IF;
END $$;

-- End migration: safe trigger re-creation

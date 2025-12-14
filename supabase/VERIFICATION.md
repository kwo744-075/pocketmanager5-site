Post-migration verification steps for rollup triggers and columns

1) Confirm `fuel_filters` column exists on `check_ins`:

```sql
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'check_ins' AND column_name = 'fuel_filters';
```

2) Confirm `total_fuel_filters` exists on rollup tables:

```sql
SELECT table_name, column_name
FROM information_schema.columns
WHERE column_name = 'total_fuel_filters'
  AND table_schema = 'public'
  AND table_name IN (
    'shop_daily_totals',
    'shop_wtd_totals',
    'shop_wtd_evening_totals',
    'district_daily_totals',
    'district_wtd_totals',
    'region_daily_totals',
    'region_wtd_totals'
  );
```

3) Confirm the trigger functions exist:

```sql
SELECT routine_name
FROM information_schema.routines
WHERE routine_name ILIKE '%update_shop_daily_totals%'
   OR routine_name ILIKE '%update_shop_wtd_totals%';
```

4) Confirm the triggers exist on `public.check_ins`:

```sql
SELECT trigger_name, event_object_table
FROM information_schema.triggers
WHERE event_object_table = 'check_ins'
  AND trigger_name ILIKE '%trigger_update_shop%';
```

5) Quick functional test (run on staging):

Insert a staging-only test check_in row and then confirm daily & weekly totals are updated.

```sql
BEGIN;
INSERT INTO public.check_ins (shop_id, check_in_date, time_slot, cars, sales, big4, coolants, diffs, fuel_filters, donations, mobil1, temperature, is_submitted, submitted_at)
VALUES ('<shop_uuid>', current_date, '12pm', 2, 20.00, 1, 0, 0, 1, 0, 0, 'green', true, NOW());

SELECT * FROM public.shop_daily_totals WHERE shop_id = '<shop_uuid>' AND check_in_date = current_date;
SELECT * FROM public.shop_wtd_totals WHERE shop_id = '<shop_uuid>' AND week_start = date_trunc('week', current_date)::date;
ROLLBACK;
```

If the test shows the expected totals, the trigger functions and triggers are working.

6) Logs and monitoring:
 - Check Postgres logs for any function exceptions after applying triggers.
 - Monitor traffic for any performance issues during backfill operations.

If anything fails, restore from backup and debug the SQL statements on staging first.

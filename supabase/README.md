Rollups migration guidance

This folder contains migrations to ensure canonical rollups for `check_ins` → `shop_daily_totals` and `shop_wtd_totals`.

Key files:
- `migrations/20251207090000_make_rollups_canonical.sql` — adds `fuel_filters`, updates trigger function definitions, and backfills totals. Uses safe `DROP TRIGGER IF EXISTS` for triggers.
- `migrations/20251214000000_fix_rollup_trigger_drop.sql` — a follow-up migration to safely drop and recreate triggers if needed on the target DB.
- `VERIFICATION.md` — helpful check queries to run after applying the migration.

How to apply:
- Backup the database from the Supabase dashboard
- Run the migrations in staging first
- Use the `scripts/apply-rollup-migration.ps1` script to apply both the canonical migration and the safe trigger migration. Ensure `psql` is installed and `DATABASE_URL` env var is set, or pass -ConnectionString.

If anything fails, restore from backup and debug on staging.

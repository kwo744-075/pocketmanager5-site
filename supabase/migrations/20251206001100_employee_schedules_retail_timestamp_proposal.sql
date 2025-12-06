-- 2025-12-06 00:11:00: Proposal migration for employee schedules retail timestamp
-- This is a safe, commented proposal migration. Review fields before applying.

-- NOTE: The codebase references retail timestamp columns in several docs. If your schema uses a different
-- column name, adjust accordingly. This migration will only add new columns if they do not already exist.

-- Suggested columns to support retail timestamps on schedules and shifts
ALTER TABLE IF EXISTS employee_schedules
  ADD COLUMN IF NOT EXISTS retail_timestamp TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE IF EXISTS employee_shifts
  ADD COLUMN IF NOT EXISTS retail_timestamp TIMESTAMPTZ DEFAULT NOW();

-- Optionally add indexes to help queries that filter by retail_timestamp
CREATE INDEX IF NOT EXISTS idx_employee_schedules_retail_ts ON employee_schedules (retail_timestamp);
CREATE INDEX IF NOT EXISTS idx_employee_shifts_retail_ts ON employee_shifts (retail_timestamp);

-- Backfill guidance (run after deployment if historic mapping is available):
-- UPDATE employee_schedules SET retail_timestamp = some_source_table.retail_timestamp
-- FROM some_source_table WHERE some_join_condition;

-- If you want me to generate a backfill from a specific source table, provide the mapping and I'll draft it.

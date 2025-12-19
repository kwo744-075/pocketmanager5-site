# Running awards SQL files

This folder contains helpers to apply the `supabase/setup` SQL files for the awards show feature.

Files:
- `run-awards-rls.ps1` — PowerShell script (Windows) that prompts for DB credentials and runs the SQL files in order.
- `run-awards-rls.sh` — Bash/WSL script for Linux/macOS/WSL.

Usage (PowerShell):
```powershell
cd <repo-root>
.\.scripts\run-awards-rls.ps1
```

Usage (bash/WSL):
```bash
cd <repo-root>
./.scripts/run-awards-rls.sh
```

What the scripts do:
- Run `supabase/setup/awards_show_runtime.sql` (creates runtime tables if missing)
- Run `supabase/setup/awards_show_rls.sql` (enables RLS and creates policies)

Safety notes:
- BACKUP your database before running these scripts against production. Use `pg_dump` or the Supabase Admin backups.
- These scripts require `psql` (Postgres client) available in `PATH`.
- Scripts will stop on the first error and return a non-zero exit code.

Verification queries (run after scripts complete):
```sql
SELECT * FROM pg_policies WHERE tablename IN ('awards_show_runtime','awards_show_reactions');
SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('awards_show_runtime','awards_show_reactions');
```

Troubleshooting:
- If `psql` is not found, install the Postgres client or use WSL where `psql` is available.
- If a policy or table name doesn't match your schema, edit the SQL in `supabase/setup` to match your `profiles` table and columns.

If you'd like, I can also add a safe dry-run mode or wrap the operations in a transaction file for preview.

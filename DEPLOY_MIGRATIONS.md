## Deploying migrations to the linked Supabase project

This project is linked to Supabase project ref `alhlyobxuzeezrjhsvly` in this environment.

High-level steps (run in PowerShell):

1. Ensure Docker Desktop is installed and running (required by `supabase db pull`).

2. Ensure your working tree is clean and committed (so migration files can be added safely):

```powershell
Set-Location "C:\Users\kwo74\Desktop\Take 5\Apps\PocketManager5-site"
git status --porcelain
# If there are changes, either commit them or stash them before continuing.
```

3. Pull remote migration history (optional but recommended):

```powershell
supabase db pull
```

If `supabase db pull` fails with migration history mismatches, follow the CLI recommendations (it will print `supabase migration repair --status ...`). Use the `repair` command listed by the CLI to mark remote versions as `applied` or `reverted` as appropriate, then retry `supabase db pull`.

4. Apply local migrations to the remote database:

```powershell
supabase db push
```

Notes and safe alternatives:
- If the CLI fails because it cannot inspect Docker images (Docker API errors), ensure Docker Desktop is up-to-date and restart it. Upgrading the Supabase CLI to a newer version can also help: see https://supabase.com/docs/guides/cli/getting-started#updating-the-supabase-cli

- If you prefer not to use the CLI, you can execute migration SQL manually via the Supabase Dashboard SQL editor (Dashboard → SQL Editor). Open the migration `.sql` file in `supabase/migrations` and paste/run it in the SQL editor. This is useful for one-off changes or when debugging Docker/CLI issues.

- The `20251206001000_add_fuel_filters_to_checkins_cache.sql` migration was added to this project and will add the `fuel_filters` column to `check_ins`, update trigger functions, and backfill rollups. Review it in `supabase/migrations` before applying.

If you want, I can now attempt `supabase db pull` and `supabase db push` here (I will need Docker running). Otherwise run the commands above locally and paste the output here and I'll assist with any follow-ups.

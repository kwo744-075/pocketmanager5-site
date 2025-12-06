## Development

```bash
npm install
npm run dev
```

### Environment variables

1. Copy `.env.local.example` to `.env.local`.
2. Replace the default Supabase URLs/anon keys if you point at a different project.
3. Paste the **service-role key** from the Pocket Manager project into `SUPABASE_SERVICE_ROLE_KEY` (and/or `PM_SUPABASE_SERVICE_ROLE_KEY`). This value never ships to the browser, but it lets the desktop forms insert rows just like the Expo app.
4. If you run the dev server from another device (for example `192.168.x.x`), add the comma-separated hosts to `NEXT_DEV_ALLOWED_ORIGINS` so `/ _next` assets can load without the warning banner.

> ⚠️ Never commit `.env.local` or the service-role key. The example file only includes anon keys that are already public in the repo for reference.

## Supabase views

Apply the Postgres scripts in `/supabase` to your Supabase project so the UI queries resolve (they use a `.psql` suffix to keep the workspace SQL analyzers from flagging Postgres-specific syntax):

- `supabase/hierarchy_summary.psql` builds the `hierarchy_summary_vw` view used to resolve user scope.
- `supabase/shop_wtd_evening_totals.psql` builds `shop_wtd_evening_totals`, which mirrors `shop_wtd_totals` but only aggregates 5 PM + 8 PM slot submissions so the Pulse Check dashboard can surface evening-only WTD rollups.

Run each file in the Supabase SQL editor (or through migrations) whenever the schema drifts.

## Pulse Check sim sheet

The Pulse Check simulator reads the signed workbook stored in the `test-data Gulf` bucket. After editing the CSV source, run the helper scripts from the repo root:

```bash
pnpm run sim:sheet   # rebuild XLSX from the CSV
pnpm run sim:upload  # push the XLSX to Supabase storage and print a fresh signed URL
pnpm run sim:sync    # convenience command that runs both steps
```

## Vercel Deployment

- **Overview:** Deploy this Next.js app to Vercel by connecting the GitHub repository or using the Vercel CLI.
- **Recommended files:** `vercel.json` (already present) configures the Next/Edge builder.

- **Required environment variables (set in Vercel dashboard → Settings → Environment Variables):**
	- `NEXT_PUBLIC_PM_SUPABASE_URL`
	- `NEXT_PUBLIC_PM_SUPABASE_ANON_KEY`
	- `NEXT_PUBLIC_SUPABASE_URL`
	- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
	- `NEXT_PUBLIC_PULSE_SUPABASE_URL` (optional, falls back to primary)
	- `NEXT_PUBLIC_PULSE_SUPABASE_ANON_KEY` (optional)
	- `SUPABASE_URL` (server-side)
	- `SUPABASE_SERVICE_ROLE_KEY` (server-side, keep secret)
	- `PM_SUPABASE_SERVICE_ROLE_KEY` (server-side, optional)

- **Quick deploy via Vercel Dashboard:**
	1. Push your current branch (e.g., `pr/sim-alignment`) to GitHub.
	2. In Vercel, click "Import Project" → pick your GitHub repo `pocketmanager5-site` → follow prompts.
	3. In the project settings, add the environment variables listed above for `Preview` and `Production` as appropriate.
	4. Set the production branch to `main` (or your preferred production branch).

- **Deploy via Vercel CLI (PowerShell):**
	```powershell
	npm i -g vercel
	vercel login
	# If you want to do a one-off production deploy from your local branch:
	vercel --prod --confirm
	# or, to use a token (CI):
	$env:VERCEL_TOKEN = "<your-token>"
	vercel --prod --token $env:VERCEL_TOKEN --confirm
	```

- **Add env vars via CLI:**
	```powershell
	vercel env add NEXT_PUBLIC_SUPABASE_URL production
	vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
	vercel env add SUPABASE_SERVICE_ROLE_KEY production
	# repeat for other vars and for preview/development environments
	```

- **Notes & security:**
	- Never commit server-side keys. Use Vercel environment variables for `SUPABASE_SERVICE_ROLE_KEY` and other secrets.
	- The `.env.local.example` file documents the variables used in development; copy it locally and fill in secrets only on your machine or CI.


The upload script loads `.env.local`, so be sure the service-role key is present before running it locally.

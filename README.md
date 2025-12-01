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

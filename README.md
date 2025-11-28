## Development

```bash
npm install
npm run dev
```

## Supabase views

Apply the Postgres scripts in `/supabase` to your Supabase project so the UI queries resolve (they use a `.psql` suffix to keep the workspace SQL analyzers from flagging Postgres-specific syntax):

- `supabase/hierarchy_summary.psql` builds the `hierarchy_summary_vw` view used to resolve user scope.
- `supabase/shop_wtd_evening_totals.psql` builds `shop_wtd_evening_totals`, which mirrors `shop_wtd_totals` but only aggregates 5 PM + 8 PM slot submissions so the Pulse Check dashboard can surface evening-only WTD rollups.

Run each file in the Supabase SQL editor (or through migrations) whenever the schema drifts.

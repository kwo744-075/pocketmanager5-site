## Development

```bash
npm install
npm run dev
```

## Supabase views

Apply the SQL files in `/supabase` to your Supabase project so the UI queries resolve:

- `supabase/hierarchy_summary.sql` builds the `hierarchy_summary_vw` view used to resolve user scope.
- `supabase/shop_wtd_evening_totals.sql` builds `shop_wtd_evening_totals`, which mirrors `shop_wtd_totals` but only aggregates 5 PM + 8 PM slot submissions so the Pulse Check dashboard can surface evening-only WTD rollups.

Run each file in the Supabase SQL editor (or through migrations) whenever the schema drifts.

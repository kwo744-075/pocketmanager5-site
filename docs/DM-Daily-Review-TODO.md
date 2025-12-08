## DM Daily Review — Notes, Edge-cases & Next Steps

Summary
- Mapping presets and view presets are implemented in the client using localStorage under keys `dm_mapping_presets_v1` and `dm_view_presets_v1`.
- Presets are currently browser/machine-local. Server persistence (Supabase) is optional and recommended for team-wide sharing.

Storage & Behavior
- Mapping presets: saves the `headerMap` (canonical->sheet header mapping). Applying a mapping preset sets `headerMap` and re-runs `applyAggregation(rows)` using the currently loaded rows.
- View presets: save `{ includedKpis, selectedKpi, mappingPreset? }`. Applying a view preset sets included KPIs, selected KPI, and optionally applies the linked mapping preset.
- Limitations: localStorage is device-specific. Preset names are not currently deduped or validated; saving a name that already exists overwrites it.

Edge cases
- Large master sheets: the client parses the first sheet and scans up to the first 6 rows to auto-detect header rows. If the file format changes, header mapping may fail.
- Percent columns: heuristic detection (header keywords + numeric heuristics) is used for percent formatting. If detection is wrong, allow manual override in `Column Mapping` panel.
- TDZ / initialization: computed memo ordering was adjusted to avoid temporal-dead-zone ReferenceErrors. If additional errors occur, re-check memo/dependency ordering (filteredSummary/sortedSummary, displayColumns).
- Dev server parse errors: If Next fails with a parse error after edits, restart the dev server and check `npm run build` for a canonical error output.

UX polish / Improvements
- Prevent duplicate preset names (prompt/abort on duplicate).
- Add delete for view presets.
- Show active preset label in the UI (mapping & view lists).
- Add lightweight confirmation to saves and deletes (toast + undo window).
- Add option to auto-link current mapping when saving a view preset.

Server-side persistence (recommended)
- Add `kpi_presets` table in Supabase with columns: `id, owner_user_id, team_id, name, type ('mapping'|'view'), payload jsonb, created_at, updated_at`.
- Add API routes: `GET /api/presets`, `POST /api/presets`, `DELETE /api/presets/:id`, `PUT /api/presets/:id`.
- RLS policies: restrict reads by team or public flag; writes must be owner or team-admin. Use service-role only for administrative actions.

Next steps (priority order)
1. Add server persistence for presets (API + DB migration + RLS) — so teammates can share views and mappings.
2. Add duplicate-name protection and delete/undo UX for both mapping and view presets.
3. Add indicators for the active preset and last-applied timestamp.
4. Wire District Rollup KPIs to Supabase/aggregation logic (averages vs sums) — clarify whether Pmix is an average or summed value.
5. Add tests for header detection heuristics using representative sample files.

If you want, I can scaffold the Supabase migration + API routes next (I can create the `kpi_presets` table and a simple authenticated API), or implement the UI polish items in the next PR.

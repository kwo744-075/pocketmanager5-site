# Pocket Manager5 ⇄ Supabase Wiring Plan

_Reference implementation source_: `C:\Users\kwo74\Desktop\Take 5\Apps\pocket-manager-app`

## Objectives

1. Share a single source of truth for KPIs, visits, cadence, and inventory across Pocket Manager5 (web) and Pulse Check 5.
2. Mirror the feature-level Supabase access patterns already proven inside the Expo app while keeping the web client on the `PocketManager5-site/app/pocket-manager5` path.
3. Respect existing RLS policies (DM owns dm_schedule rows, shops read dm_logbook entries, etc.) and avoid duplicating write logic in the browser by preferring RPCs or edge functions where sensitive mutations are required.

## Data Domains + Tables

| Feature banner | Supabase tables / views | Reference screen (`pocket-manager-app`) | Notes |
| --- | --- | --- | --- |
| Daily Ops Overview | `pulse_daily_totals`, `pulse_weekly_totals`, `district_*` rollup views (`lib/pulseRollups.ts`) | `app/(tabs)/(home)/daily-log.tsx` | Leverage the new `fetchHierarchyRollups` helper for district/region/division comparisons.
| Alerts & Broadcasts | `alerts`, `solink_audits`, `claims` | `app/(tabs)/(home)/alerts.tsx` | Replace mock snapshot data with live query-by-shop endpoints + Supabase channel subscription for live alerts.
| Visits & Coaching | `dm_schedule`, `dm_visit_logs`, `dm_cadence` | `app/(tabs)/(home)/dm-schedule.tsx`, `dm-logbook.tsx` | Web forms should write via a dedicated POST endpoint that wraps `supabaseAdmin` to keep field validation server-side.
| Labor & Staffing | `labor_tracking`, `shop_alignment` | `app/(tabs)/(home)/labor.tsx` | Need shared RPC for "allowed vs used" calcs to avoid duplicating formula client-side.
| Training & Cadence | `employee_training`, `cadence_completions`, `challenges_log` | `app/(tabs)/(home)/cadence.tsx` | Build typed fetcher hooks mirroring Expo `useCadenceBoard` and reuse JSON schema exported from app constants.
| Inventory & Supplies | `inventory_counts_v2`, `supply_orders`, `shop_workbook`, `shop_checkbook` | `app/(tabs)/(home)/inventory.tsx`, `supplies.tsx` | Introduce unified `/api/inventory` route to handle segmented queries (counts, workbook, checkbook) in a single round trip.
| Admin & Safety | `claims`, `solink_audits`, `repairs_requests`, `crash_jobs` | `app/(tabs)/(home)/admin-safety.tsx` | Batch fetch via Supabase `rpc_admin_dashboard(shop_id uuid)` to minimize overfetching.

## Wiring Milestones

1. **Read adapters**
   - Promote reusable fetchers (`lib/pocketManagerData.ts`, `lib/pulseRollups.ts`) that wrap Supabase queries with typed return values.
   - Mirror Expo selectors (e.g., `useVisits`, `useKpiBoard`) by lifting their query fragments into shared `lib/queries/*` modules.

2. **Write adapters (forms)**
   - Extend `FormRenderer` with a server action per `FormConfig.supabaseTable` so DM submissions insert rows using service-role credentials.
   - Map each form section to the Expo form schema (e.g., DM Visit Log → `dm_logbook` columns) and persist attachments to Supabase Storage buckets.

3. **Realtime + caching**
   - For dashboards that require live updates (alerts, dm_schedule), subscribe to Supabase channels keyed by shop/district id.
   - Fall back to ISR/Suspense caches for slower-moving data (inventory checks, workbook totals).

4. **RLS review**
   - Confirm the `dm_schedule`, `dm_logbook`, and `dm_visit_logs` policies allow reads by associated shops as in the mobile app.
   - Add region-level `SELECT` policies so RDs using the web client receive parity with Expo features.

## Wiring Kickoff (Nov 28)

- `hooks/usePocketManagerData.ts` now exposes `useHierarchyRollupsSuspense`, which reuses `lib/pulseRollups.ts::fetchHierarchyRollups` with the same payload shape that the Expo screen `app/(tabs)/(home)/daily-log.tsx` depends on.
- `app/pocket-manager5/page.tsx` feeds that hook into `PulseOverviewContent`, rendering live district/region/division comparisons under the Daily Ops grid so the web UI mirrors the mobile KPI stack.
- The rollup scope handed to the hook comes straight from `usePocketHierarchy` (shop metadata + hierarchy labels), ensuring the React tree stays aligned with the Expo context object.

## People / OPS / Mini POS parity (Nov 28 PM)

- Added `lib/miniPosOverview.ts` + `useMiniPosOverviewSuspense` to summarize the Supabase `pos_buttons`, `pos_nested_buttons`, and `shop_staff` tables for the Mini POS quick-look block. The hook mirrors the Expo `mini-pos` screen bootstrap flow (load profile, fetch buttons, hydrate nested buttons, surface staff list) but condenses the data into counts and featured buttons for the desktop card.
- Reused the existing snapshot payload for employee staffing/training metrics so the new "People Workspace" card on `/pocket-manager5` leverages the same cadence + staffing math as the Expo Employee Management hub.
- `SectionCard` grids for OPS Hub, Manager's Clipboard, and Employee Management now map 1:1 to the Expo `ops.tsx`, `managers-clipboard.tsx`, and `employee-management.tsx` banner lists, ensuring the web route exposes the same tool launchers/forms.

## Next Steps

- Port the Expo `usePulseTotals` logic to a shared query powered by `fetchHierarchyRollups()`.
- Scaffold API routes in `app/api/pocket-manager/*` that proxy sensitive Supabase mutations, starting with DM schedule CRUD.
- Replace snapshot mocks in `app/pocket-manager5/page.tsx` with the new adapters incrementally, validating each swap against the native implementation in `pocket-manager-app`.

## Mini POS persistence plan (Dec 1)

The new `/pocket-manager5/features/mini-pos` workspace already mirrors the Expo UI, so we can wire the same capture flow into Supabase without rethinking the schema. Proposed tables (all UUID PKs, standard `created_at`/`updated_at`, `shop_id` foreign keys, and `created_by` email fields) keep each concern normalized:

| Table | Purpose | Key columns |
| --- | --- | --- |
| `pos_sessions` | One row per checkout session / cart submission. | `shop_id`, `session_status` (`open`/`closed`), `payment_method`, `subtotal`, `discount_amount`, `total_due`, `tendered_amount`, `change_due`, `notes_json` (lane assignments + service notes). |
| `pos_cart_items` | Line items tied to a session. | `session_id`, `service_key`, `button_id`, `label`, `unit_price`, `quantity`, `sequence` |
| `pos_customer_capture` | Driver/fleet metadata. | `session_id`, `customer_name`, `phone`, `email`, `fleet_account`, `purchase_order`, `driver_name` |
| `pos_vehicle_capture` | VIN + inspection data. | `session_id`, `vin`, `year`, `make`, `model`, `mileage`, `license_plate`, `unit_number`, `oil_type`, `vehicle_notes` |
| `pos_payment_events` | Audit records for cash/card/fleet settlements. | `session_id`, `method`, `amount`, `reference_number`, `recorded_by`, `recorded_at` |

### API / server action surface

1. **Create / update session** — `POST /api/mini-pos/session`
   - Accepts the entire React payload (`cartItems`, captures, payment block) and upserts a session. New carts call without `sessionId`; suspended carts send the ID to resume editing.
   - Runs server-side validation (non-negative totals, matching discount math) before calling `supabaseAdmin.from('pos_sessions').upsert()` and batching related inserts via a stored procedure `rpc_save_pos_session(payload jsonb)` to keep transactional integrity.

2. **List historical carts** — `GET /api/mini-pos/session?shop=123&status=closed`
   - Returns paginated summaries for the Manager's Clipboard and future reporting exports.

3. **Receipt export** — `GET /api/mini-pos/session/:id/receipt`
   - Generates a PDF/HTML receipt pulling from the same tables so both print + email buttons reuse the API.

### Client wiring plan

| Step | Detail |
| --- | --- |
| 1. Persist draft state | On Add-to-cart, call a lightweight `useDebouncedServerAction` that writes the current payload to `pos_sessions` with `session_status = 'open'`. This mirrors the Expo autosave behavior so refreshes don’t lose work. |
| 2. Close / settle cart | When the user taps “Mark Paid”, run a dedicated `completeMiniPosSession(sessionId, paymentPayload)` action that: (a) asserts totals, (b) inserts a `pos_payment_events` row, (c) flips `session_status` to `closed`, (d) stamps the `tendered_amount` / `change_due`. |
| 3. Fleet billing exports | Schedule a nightly edge function `pos_export_fleet_invoices()` that selects `payment_method='fleet'` sessions for the day, compiles CSV/PDF, and drops them in Supabase Storage for accounting retrieval. |
| 4. RLS | Sessions are readable by the owning shop (`shop_id = auth.shop_id`). DMs/RDs get district or region read scopes via policy joins to `hierarchy_summary_vw`. Mutations remain server-only through the API route using the service role key. |

This plan keeps the browser client thin (no direct Supabase writes) while giving parity with the Expo persistence strategy and opening the door for cash reconciliation / reporting without additional refactors.

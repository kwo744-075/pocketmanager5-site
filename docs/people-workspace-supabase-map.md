# People Workspace ↔︎ Expo Employee Hub Data Map

This note pairs each tile/metric inside the PocketManager5 People workspace with the exact Expo routes and Supabase tables that already power the native Employee Management experience. Use it as the alignment checklist while we wire live data into the web view.

## Snapshot metrics (web)

The profile metrics rendered in `app/pocket-manager5/page.tsx` pull from `lib/pocketManagerData.ts`. That snapshot already reads the same Supabase tables as the mobile dashboards:

| Metric block | Supabase tables | Notes |
| --- | --- | --- |
| Staffing (current count, tenure, terms YTD) | `shop_staff`, `termed_employees` | Mirrors Staff Management roster + termed archive. |
| Training (completion %, in-training count) | `employee_training` | Same status values (`completed`, `in_progress`) as Expo training screen. |
| Cadence + Challenges | `daily_cadence`, `challenges_log` | Feeds compliance and challenge counters in both apps. |
| Labor variance | `labor_tracking` | Shared with Labor Tracker workflows. |
| Visit schedule / log cards | `dm_schedule`, `dm_logbook` | Matches DM visit tooling surfaced on mobile. |
| Admin alerts | `claims`, `solink_audits`, `turned_logs` | Same sources as Admin & Safety mobile surfaces. |
| Inventory snapshot | `inventory_counts_v2`, `supply_orders` | Same counts/orders tables as Expo Inventory. |

## People workspace tiles

| Pill (web) | Next.js target | Expo route(s) | Supabase tables in use | Notes / follow-up |
| --- | --- | --- | --- | --- |
| Scheduling | `/pocket-manager5/features/employee-scheduling` | `/(tabs)/(home)/simple-scheduler`, `/(tabs)/(home)/employee-scheduling` | `shop_staff`, `employee_shifts`, `employee_schedules`, `weekly_projections` | Expo currently has both Simple Scheduler (`employee_shifts`) and legacy weekly grid (`employee_schedules`). Web page is doc-only today; we can hydrate it using the same tables once we expose a server action. |
| Training | `/pocket-manager5/features/employee-training` | `/(tabs)/(home)/employee-training`, `/(tabs)/(home)/employee-training-detail` | `shop_staff`, `employee_training`, `employee_service_certifications` | Web snapshot already shows completion %. Need development detail panels to read `employee_training` + certification counts the same way as Expo. |
| Meetings | `/pocket-manager5/features/employee-meetings` | `/(tabs)/(home)/employee-meetings-home`, `/(tabs)/(home)/employee-meetings-form`, `/(tabs)/(home)/employee-meetings-logbook` | `employee_meetings` (attendees stored as array) | Nothing on web yet consumes `employee_meetings`; this tile links to documentation only. Data model is ready to surface recent agendas + attendance. |
| Coaching Log | `/pocket-manager5/features/coaching-log` | `/(tabs)/(home)/coaching-log-home` | `coaching_logs`, `employee_master_logs`, `shop_staff` | Mobile also writes a summary row to `employee_master_logs`. Web should respect both tables when we mirror weekly counts. |
| Staff Management | `/pocket-manager5/features/staff-management` | `/(tabs)/(home)/staff-management` | `shop_staff` | Both platforms treat `shop_staff` as the source of truth. Forms (`people-employee-profile`) already describe the same fields. |
| Termed List | `/pocket-manager5/features/termed-list` | `/(tabs)/(home)/termed-list` | `termed_employees` | Web tile is doc-only; Expo manages CRUD against `termed_employees`. |

## Forms surfaced inside the People workspace

| Form slug | Supabase table | Purpose |
| --- | --- | --- |
| `people-employee-profile` | `shop_staff` | Same payload as Expo Staff Management add/edit dialog. |
| `people-phone-sheet` | `contacts` | Pairs with the Expo phone sheet contact modal. |

## Gaps to close next

1. **Employee development data** – Expo development routes (`app/(tabs)/(home)/employee-development*.tsx`) read `employee_development` + `employee_service_certifications`, but the web snapshot does not yet hydrate any development-focused data. We need to extend `fetchPocketManagerSnapshot` (or load a dedicated server component) to cover this table.
2. **Tile content vs. docs** – The current Next.js feature pages (`/pocket-manager5/features/*`) are documentation shells. After confirming the data mapping above, we can progressively hydrate them by calling the same Supabase tables (either via RSC or API routes) so the web experience mirrors the native workflows.
3. **Scheduling route parity** – Expo exposes both `simple-scheduler` (new) and `employee-scheduling` (legacy). We should decide which data model is the long-term standard before wiring the web UI.

With this map checked in, anyone touching the People workspace can quickly verify whether a proposed change keeps parity with the Expo Employee Management hub and its Supabase schema.

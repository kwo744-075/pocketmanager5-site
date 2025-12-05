# Auth & Alignment Migration Plan

_Last updated: 2025-12-02_

This document captures the end-to-end plan to standardize authentication and alignment routing across the Pocket Manager web app and native app. It is written to be executed in sequential phases so we can ship incremental value while keeping downtime and user friction low.

---

## Phase 0 · Current-State Audit

1. **Inventory identity touch-points**
   - Web (Next.js 16) currently mixes Supabase admin clients, ad-hoc cookie logic, and anonymous access.
   - React Native app (Expo) authenticates to Supabase directly but alignment is inferred from local storage instead of enforced via row-level policies (RLS).
2. **Gather data sources**
   - `dm_schedule`, `dm_schedule_calendar`, `shop_staff`, etc. all rely on implicit DM-to-shop mapping baked into blueprints.
   - No canonical table lists alignments, their shops, and members.

Deliverable: spreadsheet enumerating every API route, page, and native screen that relies on the user’s alignment or shop access.

---

## Phase 1 · Schema + Policy Foundation

### Tables

```sql
create table alignments (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  region text,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table alignment_memberships (
  user_id uuid references auth.users not null,
  alignment_id uuid references alignments not null,
  shop_id text references shops (shop_id),
  role text check (role in ('dm', 'gm', 'rd', 'ops', 'viewer')) not null,
  is_primary boolean default false,
  last_used_at timestamptz,
  created_at timestamptz default now(),
  primary key (user_id, alignment_id, shop_id)
);

create table shop_role_assignments (
  user_id uuid references auth.users not null,
  shop_id text references shops (shop_id) not null,
  role text check (role in ('gm', 'dm', 'rd', 'observer')) not null,
  created_at timestamptz default now(),
  primary key (user_id, shop_id)
);

create table profile_overrides (
  user_id uuid primary key references auth.users,
  display_name text,
  phone text,
  timezone text,
  default_alignment uuid references alignments
);
```

### Policies

- `alignment_memberships`: enable `select` where `user_id = auth.uid()`.
- `shop_role_assignments`: `select` where `user_id = auth.uid()`.
- Business data tables (`dm_schedule`, `dm_schedule_calendar`, `dm_presenters`, etc.) get policies joining through `alignment_memberships` or `shop_role_assignments` to guarantee alignment scoping.

### Seed + Migration

1. Backfill `alignments` and `shop_role_assignments` from existing CSV/blueprints.
2. Script to map every Supabase user to at least one alignment; mark a default in `profile_overrides`.

Deliverables: SQL migration files + Supabase CLI scripts.

---

## Phase 2 · Auth Wiring (Web)

1. Add `/middleware.ts` using `createServerClient` to:
   - read Supabase session cookies,
   - redirect unauthenticated users to `/login`,
   - inject `req.nextUrl.searchParams.set('alignment', activeAlignmentId)`.
2. Build `lib/auth/session.ts` helper exporting:
   - `getServerSession()` — wraps Supabase client to fetch user + membership snapshot,
   - `requireAlignment()` — throws if user lacks an active membership.
3. Update all route handlers and server components to consume these helpers instead of the current ad-hoc cookie reads.
4. Add `/api/session/refresh` to rotate tokens (called every 10 minutes from the client via SWR/middleware).

Deliverables: middleware file, session helper, refreshed planner page using the helper.

---

## Phase 3 · Auth Wiring (Native App)

1. Switch the Expo app to `@supabase/supabase-js` v2 with PKCE.
2. Create a lightweight `/api/mobile/session` endpoint returning the same payload as `getServerSession()` so mobile has a canonical view of alignments/shops.
3. Add device fingerprinting + push token capture for login alerts.
4. Mirror alignment filters in the mobile router — e.g., `AlignmentGate` component that waits for membership data before rendering screens.

Deliverables: Updated Expo auth stack, new API endpoints, QA checklist for login flows.

---

## Phase 4 · Alignment-Driven Routing

1. Add `useAlignmentRoute` hook (web) that:
   - reads `alignment` from session context,
   - redirects `/` to the appropriate feature hub depending on role (DM → planner, RD → RD dashboard).
2. For each page/data fetch, ensure queries filter by the current alignment’s shops (`where shop_id in (...)`).
3. Introduce `alignment-switcher` UI (top nav) so multi-alignment users can pivot without logging out.

Deliverables: Nav component, server-side helpers, instrumentation verifying filters are applied.

---

## Phase 5 · Admin Tooling + Observability

1. Build `/admin/alignments` page (gated by `role = 'ops'`) to:
   - create/edit alignments,
   - assign users to shops, toggle primary alignment,
   - view audit trail of changes.
2. Implement Supabase Edge Function `log_alignment_event` to insert into `alignment_audit_log` table (captures user_id, action, metadata).
3. Pipe audit logs to Logflare/BigQuery for retention.
4. Set up Alerts (PagerDuty/Slack) for suspicious activity (e.g., >5 alignment switches in 10 minutes, login from new region).

Deliverables: Admin UI, edge function, logging configuration.

---

## Phase 6 · Cutover & Cleanup

1. Enable new middleware behind a feature flag, test with internal accounts.
2. Migrate production users gradually:
   - Week 1: Ops + pilot DMs.
   - Week 2: Remaining DMs/RDs.
3. Once adoption >95%, remove legacy cookie logic and static DM shop constants.
4. Run final security review + penetration test.

Deliverables: rollout checklist, retrospective doc, removal PR for old auth paths.

---

## Next Steps (Actionable)

1. **Approve schema migrations** (Phase 1) and run in staging.
2. **Implement middleware + session helpers** (Phase 2) in a feature branch; run planner smoke tests.
3. **Coordinate with mobile team** to schedule Expo auth upgrade (Phase 3).
4. **Draft alignment admin UI wireframes** so Ops can sign off before we build.

Please drop any comments or adjustments directly in this file so we keep a single source of truth as the migration proceeds.

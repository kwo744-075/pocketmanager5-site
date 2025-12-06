-- Migration: create cadence tables for labor, deposits, and dm_list
-- NOTE: Review RLS policies and replace `auth.uid()` logic with your project's user/shop membership logic.

-- 1) labor_entries: per-shop daily labor verification entries
CREATE TABLE IF NOT EXISTS public.labor_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id text NOT NULL,
  shop_name text,
  date date NOT NULL,
  expected_labor_pct numeric(5,2) NOT NULL,
  actual_labor_pct numeric(5,2) NOT NULL,
  notes text,
  created_by uuid NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_labor_entries_shop_date ON public.labor_entries (shop_id, date);

-- 2) deposit_entries: captures deposit verification and cash over/short
CREATE TABLE IF NOT EXISTS public.deposit_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id text NOT NULL,
  shop_name text,
  date date NOT NULL,
  bank_visit_verified boolean DEFAULT false,
  deposit_amount numeric(12,2) DEFAULT 0,
  expected_amount numeric(12,2) DEFAULT 0,
  cash_over_short numeric(12,2) DEFAULT 0,
  notes text,
  attachments jsonb DEFAULT '[]'::jsonb, -- file refs (url, storage path)
  created_by uuid NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deposit_entries_shop_date ON public.deposit_entries (shop_id, date);

-- 3) dm_list: incoming DM requests from shops (app submissions)
CREATE TABLE IF NOT EXISTS public.dm_list (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id text NOT NULL,
  shop_name text,
  message text NOT NULL,
  category text NOT NULL,
  priority text NOT NULL,
  status text NOT NULL DEFAULT 'Open', -- Open | In Progress | Completed
  created_by uuid NULL,
  created_at timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_dm_list_shop_created ON public.dm_list (shop_id, created_at DESC);

-- 4) Example WTD view: aggregate simple counts per shop for the current week
-- This view assumes a `date` column on entries and aggregates week-to-date stats.
CREATE OR REPLACE VIEW public.cadence_wtd_summary AS
SELECT
  s.shop_id,
  coalesce(sum(case when l.date >= date_trunc('week', now())::date then 1 else 0 end), 0) as labor_entries_wtd,
  coalesce(sum(case when d.date >= date_trunc('week', now())::date then 1 else 0 end), 0) as deposit_entries_wtd,
  coalesce(sum(case when d.date >= date_trunc('week', now())::date then d.cash_over_short else 0 end), 0) as cash_over_short_wtd,
  coalesce(count(distinct dm.id) filter (where dm.created_at >= date_trunc('week', now())), 0) as open_dm_items_wtd
FROM
  (SELECT DISTINCT shop_id FROM public.labor_entries UNION SELECT DISTINCT shop_id FROM public.deposit_entries UNION SELECT DISTINCT shop_id FROM public.dm_list) s(shop_id)
LEFT JOIN public.labor_entries l ON l.shop_id = s.shop_id
LEFT JOIN public.deposit_entries d ON d.shop_id = s.shop_id
LEFT JOIN public.dm_list dm ON dm.shop_id = s.shop_id AND dm.status = 'Open'
GROUP BY s.shop_id;

-- 5) RLS policy templates (enable Row Level Security and add example policies)
-- IMPORTANT: adapt these policies to your auth model and team/org membership logic.

-- Enable RLS on tables
ALTER TABLE IF EXISTS public.labor_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.deposit_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.dm_list ENABLE ROW LEVEL SECURITY;

-- Example policy: allow selects on rows if user is an admin or created_by matches auth.uid()
-- Replace `auth.uid()` checks with your membership logic or supabase functions that check shop ownership.
CREATE POLICY IF NOT EXISTS "select_own_or_admin_labor" ON public.labor_entries USING (
  (created_by IS NOT NULL AND created_by = auth.uid())
  OR (exists(SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'))
);

CREATE POLICY IF NOT EXISTS "insert_own_labor" ON public.labor_entries FOR INSERT WITH CHECK (
  (created_by = auth.uid())
);

CREATE POLICY IF NOT EXISTS "select_own_or_admin_deposits" ON public.deposit_entries USING (
  (created_by IS NOT NULL AND created_by = auth.uid())
  OR (exists(SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'))
);

CREATE POLICY IF NOT EXISTS "insert_own_deposits" ON public.deposit_entries FOR INSERT WITH CHECK (
  (created_by = auth.uid())
);

CREATE POLICY IF NOT EXISTS "select_dm_list" ON public.dm_list USING (
  (created_by IS NOT NULL AND created_by = auth.uid())
  OR (exists(SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('admin','dm')))
);

CREATE POLICY IF NOT EXISTS "insert_dm_list" ON public.dm_list FOR INSERT WITH CHECK (
  (created_by = auth.uid())
);

-- TODO: Add more granular policies to scope by shop membership, region, and DM roles.

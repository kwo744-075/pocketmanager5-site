-- Migration: create review presenter tables for DM/RD KPI reviews
-- Creates: public.kpi_review_presets, public.kpi_upload_mappings
-- Adds RLS policies for authenticated users

create extension if not exists pgcrypto;

-- table to store KPI review presets
create table if not exists public.kpi_review_presets (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null,
  scope text not null check (scope in ('DM', 'RD')),
  cadence text not null check (cadence in ('daily', 'weekly', 'monthly', 'period')),
  preset_name text not null,
  selected_kpis jsonb not null, -- includes goals, comparator, display order
  created_at timestamptz not null default now()
);

-- table to store upload column mappings
create table if not exists public.kpi_upload_mappings (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null,
  mapping_name text not null,
  mapping_json jsonb not null, -- the master mapper configuration
  created_at timestamptz not null default now()
);

create index if not exists idx_kpi_review_presets_created_by on public.kpi_review_presets(created_by);
create index if not exists idx_kpi_review_presets_scope_cadence on public.kpi_review_presets(scope, cadence);
create index if not exists idx_kpi_upload_mappings_created_by on public.kpi_upload_mappings(created_by);

-- Enable RLS
alter table public.kpi_review_presets enable row level security;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='kpi_review_presets' AND policyname='kpi_review_presets_crud_own'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY kpi_review_presets_crud_own ON public.kpi_review_presets FOR ALL TO authenticated USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());
    $policy$;
  END IF;
END
$$;

alter table public.kpi_upload_mappings enable row level security;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='kpi_upload_mappings' AND policyname='kpi_upload_mappings_crud_own'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY kpi_upload_mappings_crud_own ON public.kpi_upload_mappings FOR ALL TO authenticated USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());
    $policy$;
  END IF;
END
$$;

-- End migration
-- Migration: create KPI upload tables and aggregation view
-- Creates: public.kpi_uploads, public.kpi_shop_metrics
-- Adds a simple aggregated view v_kpi_daily_agg and basic RLS policies

create extension if not exists pgcrypto;

-- table to store upload metadata and raw payload
create table if not exists public.kpi_uploads (
  id uuid primary key default gen_random_uuid(),
  uploaded_at timestamptz not null default now(),
  uploader_id uuid null,
  uploader_login text null,
  source text null,
  filename text null,
  notes text null,
  payload jsonb null
);

-- normalized shop metrics for each upload (one row per shop)
create table if not exists public.kpi_shop_metrics (
  id uuid primary key default gen_random_uuid(),
  upload_id uuid references public.kpi_uploads(id) on delete cascade,
  shop text not null,
  shop_id int null,
  day date not null default current_date,
  sales numeric null,
  cars int null,
  big4 int null,
  coolants int null,
  diffs int null,
  donations numeric null,
  mobil1 numeric null,
  created_at timestamptz not null default now()
);

create index if not exists idx_kpi_shop_metrics_day on public.kpi_shop_metrics(day);
create index if not exists idx_kpi_shop_metrics_shop on public.kpi_shop_metrics(lower(shop));
create index if not exists idx_kpi_shop_metrics_upload on public.kpi_shop_metrics(upload_id);

-- Aggregated view for quick daily lookups
create or replace view public.v_kpi_daily_agg as
select
  day,
  shop,
  sum(coalesce(sales,0)) as sales,
  sum(coalesce(cars,0))::int as cars,
  avg(coalesce(big4,0))::numeric as avg_big4,
  avg(coalesce(mobil1,0))::numeric as avg_mobil1,
  sum(coalesce(coolants,0))::int as coolants,
  sum(coalesce(diffs,0))::int as diffs,
  sum(coalesce(donations,0)) as donations
from public.kpi_shop_metrics
group by day, shop;

-- Enable simple RLS scaffolding. NOTE: adjust policies for stricter access in production.
alter table public.kpi_uploads enable row level security;
create policy kpi_uploads_insert_auth on public.kpi_uploads for insert to authenticated using (true) with check (true);
create policy kpi_uploads_select_auth on public.kpi_uploads for select to authenticated using (true);

alter table public.kpi_shop_metrics enable row level security;
create policy kpi_shop_metrics_insert_auth on public.kpi_shop_metrics for insert to authenticated using (true) with check (true);
create policy kpi_shop_metrics_select_auth on public.kpi_shop_metrics for select to authenticated using (true);

-- End migration

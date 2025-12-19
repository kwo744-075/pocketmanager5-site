-- Persisted "Working WOs" for Mini POS (manual work orders) + rollups.

begin;

create table if not exists public.manual_work_orders (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null,
  shop_id text null,
  shop_number integer null,
  district_name text null,
  region_name text null,
  status text not null default 'draft' check (status in ('draft','open','closed','archived')),
  subtotal numeric not null default 0,
  discount_amount numeric not null default 0,
  tax_amount numeric not null default 0,
  total_due numeric not null default 0,
  payment_method text null,
  tendered_amount numeric not null default 0,
  change_due numeric not null default 0,
  cash_received numeric not null default 0,
  payload jsonb not null default '{}'::jsonb
);

create index if not exists manual_work_orders_shop_idx on public.manual_work_orders (shop_number);
create index if not exists manual_work_orders_status_idx on public.manual_work_orders (status, updated_at desc);
create index if not exists manual_work_orders_updated_idx on public.manual_work_orders (updated_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'manual_work_orders_set_updated_at') then
    create trigger manual_work_orders_set_updated_at
      before update on public.manual_work_orders
      for each row execute function public.set_updated_at();
  end if;
end $$;

alter table public.manual_work_orders enable row level security;

-- RLS uses alignment_memberships (user_id, shop_id, role) where shop_id is a shop number string.
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'manual_work_orders' and policyname = 'manual_work_orders_select'
  ) then
    create policy manual_work_orders_select
      on public.manual_work_orders
      for select
      to authenticated
      using (
        created_by = auth.uid()
        or exists (
          select 1
          from public.alignment_memberships am
          where am.user_id = auth.uid()
            and am.shop_id = manual_work_orders.shop_id
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'manual_work_orders' and policyname = 'manual_work_orders_insert'
  ) then
    create policy manual_work_orders_insert
      on public.manual_work_orders
      for insert
      to authenticated
      with check (
        created_by = auth.uid()
        and (
          manual_work_orders.shop_id is null
          or exists (
            select 1
            from public.alignment_memberships am
            where am.user_id = auth.uid()
              and am.shop_id = manual_work_orders.shop_id
          )
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'manual_work_orders' and policyname = 'manual_work_orders_update'
  ) then
    create policy manual_work_orders_update
      on public.manual_work_orders
      for update
      to authenticated
      using (
        created_by = auth.uid()
        or exists (
          select 1
          from public.alignment_memberships am
          where am.user_id = auth.uid()
            and am.shop_id = manual_work_orders.shop_id
        )
      )
      with check (
        created_by = auth.uid()
        or exists (
          select 1
          from public.alignment_memberships am
          where am.user_id = auth.uid()
            and am.shop_id = manual_work_orders.shop_id
        )
      );
  end if;
end $$;

-- Rollup view (active WOs only) with district/region fallback from shops table.
create or replace view public.manual_work_orders_rollup_vw as
select
  coalesce(mwo.shop_number, nullif(mwo.shop_id, '')::integer) as shop_number,
  coalesce(mwo.district_name, s.district_name) as district_name,
  coalesce(mwo.region_name, s.region_name) as region_name,
  count(*) filter (where mwo.status in ('draft','open')) as wo_count_active,
  coalesce(sum(mwo.total_due) filter (where mwo.status in ('draft','open')), 0) as wo_total_active
from public.manual_work_orders mwo
left join public.shops s on s.shop_number = coalesce(mwo.shop_number::text, mwo.shop_id)
group by 1,2,3;

commit;


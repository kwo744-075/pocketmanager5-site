-- Mini POS: bay-scoped work orders + service queue pills

begin;

-- Add bay partition to manual_work_orders (default Bay 1)
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'manual_work_orders' and column_name = 'bay_id'
  ) then
    alter table public.manual_work_orders
      add column bay_id integer not null default 1;
  end if;

  if not exists (
    select 1 from pg_indexes where schemaname = 'public' and indexname = 'manual_work_orders_bay_idx'
  ) then
    create index manual_work_orders_bay_idx on public.manual_work_orders (bay_id, status, updated_at desc);
  end if;
end $$;

-- Service Queue table (QR intake -> assign to bay)
create table if not exists public.mini_pos_queue (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  shop_number integer null,
  shop_id text null,
  customer_name text null,
  phone text null,
  email text null,
  vehicle jsonb null,
  notes text null,
  status text not null default 'new' check (status in ('new','assigned','closed')),
  assigned_bay_id integer null,
  assigned_work_order_id uuid null
);

create index if not exists mini_pos_queue_shop_idx on public.mini_pos_queue (shop_number, status, created_at desc);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'mini_pos_queue_set_updated_at') then
    create trigger mini_pos_queue_set_updated_at
      before update on public.mini_pos_queue
      for each row execute function public.set_updated_at();
  end if;
end $$;

alter table public.mini_pos_queue enable row level security;

-- Queue RLS (same alignment_memberships pattern as manual_work_orders).
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'mini_pos_queue' and policyname = 'mini_pos_queue_select'
  ) then
    create policy mini_pos_queue_select
      on public.mini_pos_queue
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.alignment_memberships am
          where am.user_id = auth.uid()
            and am.shop_id = mini_pos_queue.shop_id
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'mini_pos_queue' and policyname = 'mini_pos_queue_insert'
  ) then
    create policy mini_pos_queue_insert
      on public.mini_pos_queue
      for insert
      to authenticated
      with check (
        mini_pos_queue.shop_id is null
        or exists (
          select 1
          from public.alignment_memberships am
          where am.user_id = auth.uid()
            and am.shop_id = mini_pos_queue.shop_id
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'mini_pos_queue' and policyname = 'mini_pos_queue_update'
  ) then
    create policy mini_pos_queue_update
      on public.mini_pos_queue
      for update
      to authenticated
      using (
        exists (
          select 1
          from public.alignment_memberships am
          where am.user_id = auth.uid()
            and am.shop_id = mini_pos_queue.shop_id
        )
      )
      with check (
        exists (
          select 1
          from public.alignment_memberships am
          where am.user_id = auth.uid()
            and am.shop_id = mini_pos_queue.shop_id
        )
      );
  end if;
end $$;

commit;


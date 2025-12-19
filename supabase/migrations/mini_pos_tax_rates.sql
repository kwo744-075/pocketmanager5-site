-- Mini POS tax rate lookup + persistence in notes_json.tax
-- Stores tax rates as decimals (e.g. 0.0975 for 9.75%).

begin;

create table if not exists public.mini_pos_tax_rates (
  id uuid primary key default gen_random_uuid(),
  shop_number integer unique,
  zip text,
  state text,
  tax_rate numeric not null,
  updated_at timestamptz not null default now()
);

create index if not exists mini_pos_tax_rates_shop_number_idx on public.mini_pos_tax_rates (shop_number);
create index if not exists mini_pos_tax_rates_zip_idx on public.mini_pos_tax_rates (zip);

alter table public.mini_pos_tax_rates enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'mini_pos_tax_rates' and policyname = 'mini_pos_tax_rates_read'
  ) then
    create policy mini_pos_tax_rates_read
      on public.mini_pos_tax_rates
      for select
      to authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'mini_pos_tax_rates' and policyname = 'mini_pos_tax_rates_write_service'
  ) then
    create policy mini_pos_tax_rates_write_service
      on public.mini_pos_tax_rates
      for all
      to authenticated
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end $$;

create or replace function public.rpc_save_pos_session(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_id uuid := coalesce((payload->>'sessionId')::uuid, gen_random_uuid());
  v_shop_id uuid := (payload->>'shopId')::uuid;
  v_shop_number integer := (payload->>'shopNumber')::integer;
  v_subtotal numeric := coalesce((payload->>'subtotal')::numeric, 0);
  v_discount numeric := coalesce((payload->>'discountAmount')::numeric, 0);
  v_total_due numeric := coalesce((payload->>'totalDue')::numeric, 0);
  v_payment_method text := payload->>'paymentMethod';
  v_tendered numeric := coalesce((payload->>'tenderedAmount')::numeric, null);
  v_change numeric := coalesce((payload->>'changeDue')::numeric, null);
  v_cash_received numeric := coalesce((payload->>'cashReceived')::numeric, null);
  v_tax_rate numeric := nullif(payload->>'taxRate', '')::numeric;
  v_tax_amount numeric := nullif(payload->>'taxAmount', '')::numeric;
  v_taxable_subtotal numeric := nullif(payload->>'taxableSubtotal', '')::numeric;
  v_created_by text := coalesce(payload->>'createdBy', 'pocket-manager');
  v_updated_by text := coalesce(payload->>'createdBy', 'pocket-manager');
  v_notes jsonb := jsonb_strip_nulls(
    jsonb_build_object(
      'techAssignments', payload->'techAssignments',
      'serviceNotes', payload->>'serviceNotes',
      'tax', jsonb_build_object(
        'rate', v_tax_rate,
        'amount', v_tax_amount,
        'taxableSubtotal', v_taxable_subtotal
      )
    )
  );
  v_cart jsonb := coalesce(payload->'cartItems', '[]'::jsonb);
  v_customer jsonb := coalesce(payload->'customerInfo', '{}'::jsonb);
  v_vehicle jsonb := coalesce(payload->'vehicleInfo', '{}'::jsonb);
  v_now timestamptz := now();
begin
  if v_shop_id is null then
    raise exception 'shopId is required';
  end if;

  insert into public.pos_sessions as s (
    id,
    shop_id,
    shop_number,
    session_status,
    payment_method,
    subtotal,
    discount_amount,
    total_due,
    tendered_amount,
    change_due,
    cash_received,
    notes_json,
    created_by,
    updated_by,
    created_at,
    updated_at
  ) values (
    v_session_id,
    v_shop_id,
    v_shop_number,
    'open',
    v_payment_method,
    v_subtotal,
    v_discount,
    v_total_due,
    v_tendered,
    v_change,
    v_cash_received,
    coalesce(v_notes, '{}'::jsonb),
    v_created_by,
    v_updated_by,
    v_now,
    v_now
  )
  on conflict (id) do update set
    shop_id = excluded.shop_id,
    shop_number = excluded.shop_number,
    payment_method = excluded.payment_method,
    subtotal = excluded.subtotal,
    discount_amount = excluded.discount_amount,
    total_due = excluded.total_due,
    tendered_amount = excluded.tendered_amount,
    change_due = excluded.change_due,
    cash_received = excluded.cash_received,
    notes_json = excluded.notes_json,
    updated_by = excluded.updated_by,
    updated_at = excluded.updated_at
  returning id into v_session_id;

  delete from public.pos_cart_items where session_id = v_session_id;

  insert into public.pos_cart_items (
    session_id,
    button_id,
    service_key,
    label,
    price,
    quantity,
    created_at
  )
  select
    v_session_id,
    elem->>'buttonId',
    elem->>'serviceKey',
    elem->>'label',
    coalesce((elem->>'price')::numeric, 0),
    greatest(coalesce((elem->>'quantity')::integer, 1), 1),
    v_now
  from jsonb_array_elements(v_cart) as elem
  where coalesce(elem->>'label', '') <> '';

  insert into public.pos_customer_capture as cc (
    session_id,
    customer_name,
    phone,
    email,
    driver,
    fleet_account,
    purchase_order,
    metadata,
    updated_at
  ) values (
    v_session_id,
    v_customer->>'name',
    v_customer->>'phone',
    v_customer->>'email',
    v_customer->>'driver',
    v_customer->>'fleetAccount',
    v_customer->>'purchaseOrder',
    jsonb_strip_nulls(v_customer),
    v_now
  )
  on conflict (session_id) do update set
    customer_name = excluded.customer_name,
    phone = excluded.phone,
    email = excluded.email,
    driver = excluded.driver,
    fleet_account = excluded.fleet_account,
    purchase_order = excluded.purchase_order,
    metadata = excluded.metadata,
    updated_at = excluded.updated_at;

  insert into public.pos_vehicle_capture as vc (
    session_id,
    vin,
    vehicle_year,
    make,
    model,
    mileage,
    license_plate,
    unit_number,
    oil_type,
    notes,
    updated_at
  ) values (
    v_session_id,
    v_vehicle->>'vin',
    v_vehicle->>'year',
    v_vehicle->>'make',
    v_vehicle->>'model',
    v_vehicle->>'mileage',
    v_vehicle->>'licensePlate',
    v_vehicle->>'unitNumber',
    v_vehicle->>'oilType',
    v_vehicle->>'notes',
    v_now
  )
  on conflict (session_id) do update set
    vin = excluded.vin,
    vehicle_year = excluded.vehicle_year,
    make = excluded.make,
    model = excluded.model,
    mileage = excluded.mileage,
    license_plate = excluded.license_plate,
    unit_number = excluded.unit_number,
    oil_type = excluded.oil_type,
    notes = excluded.notes,
    updated_at = excluded.updated_at;

  return v_session_id;
end;
$$;

commit;


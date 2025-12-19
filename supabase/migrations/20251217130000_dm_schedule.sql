-- Create dm_schedule table if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'dm_schedule') THEN
    CREATE TABLE public.dm_schedule (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      period_id text,
      visit_date date NOT NULL,
      shop_number int,
      shop_id text,
      district_name text,
      region_name text,
      visit_type text NOT NULL,
      location_id text,
      location_text text,
      notes text,
      source text DEFAULT 'manual',
      created_by uuid,
      status text DEFAULT 'planned'
    );

    CREATE OR REPLACE FUNCTION public.dm_schedule_touch_updated_at()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      NEW.updated_at := now();
      RETURN NEW;
    END;
    $$;

    CREATE TRIGGER dm_schedule_set_updated_at
    BEFORE UPDATE ON public.dm_schedule
    FOR EACH ROW
    EXECUTE FUNCTION public.dm_schedule_touch_updated_at();

    CREATE UNIQUE INDEX dm_schedule_period_shop_date_visit_key
      ON public.dm_schedule (coalesce(period_id, ''), coalesce(shop_number, -1), visit_date, coalesce(visit_type, ''));
    CREATE INDEX dm_schedule_shop_number_idx ON public.dm_schedule (shop_number);
    CREATE INDEX dm_schedule_visit_date_idx ON public.dm_schedule (visit_date);
  END IF;
END;
$$;

-- Helper view mapping users to shops (alignment_memberships)
CREATE OR REPLACE VIEW public.user_shop_scope_vw AS
SELECT
  am.user_id,
  NULLIF(am.shop_id, '')::int AS shop_number,
  am.role,
  am.district_name,
  am.region_name
FROM public.alignment_memberships am
WHERE NULLIF(am.shop_id, '') IS NOT NULL;

-- Enable RLS
ALTER TABLE public.dm_schedule ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "dm_schedule_read" ON public.dm_schedule;
CREATE POLICY "dm_schedule_read"
ON public.dm_schedule
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_shop_scope_vw s
    WHERE s.user_id = auth.uid()
      AND (s.shop_number = dm_schedule.shop_number OR dm_schedule.shop_number IS NULL)
  )
);

DROP POLICY IF EXISTS "dm_schedule_insert" ON public.dm_schedule;
CREATE POLICY "dm_schedule_insert"
ON public.dm_schedule
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_shop_scope_vw s
    WHERE s.user_id = auth.uid()
      AND (s.shop_number = dm_schedule.shop_number OR dm_schedule.shop_number IS NULL)
  )
);

DROP POLICY IF EXISTS "dm_schedule_update" ON public.dm_schedule;
CREATE POLICY "dm_schedule_update"
ON public.dm_schedule
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_shop_scope_vw s
    WHERE s.user_id = auth.uid()
      AND (s.shop_number = dm_schedule.shop_number OR dm_schedule.shop_number IS NULL)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_shop_scope_vw s
    WHERE s.user_id = auth.uid()
      AND (s.shop_number = dm_schedule.shop_number OR dm_schedule.shop_number IS NULL)
  )
);

DROP POLICY IF EXISTS "dm_schedule_delete" ON public.dm_schedule;
CREATE POLICY "dm_schedule_delete"
ON public.dm_schedule
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.user_shop_scope_vw s
    WHERE s.user_id = auth.uid()
      AND (s.shop_number = dm_schedule.shop_number OR dm_schedule.shop_number IS NULL)
  )
);

-- Rollup views
CREATE OR REPLACE VIEW public.dm_schedule_shop_mix_vw AS
SELECT
  period_id,
  shop_number,
  count(*) FILTER (WHERE visit_type = 'Standard Visit') AS standard_visits,
  count(*) FILTER (WHERE visit_type = 'Quarterly Audit') AS quarterly_audits,
  count(*) FILTER (WHERE visit_type = 'Admin') AS admin_days,
  count(*) FILTER (WHERE visit_type = 'Plan To Win') AS plan_to_win_days,
  count(*) AS total_entries
FROM public.dm_schedule
WHERE COALESCE(status, 'planned') <> 'canceled'
GROUP BY period_id, shop_number;

CREATE OR REPLACE VIEW public.dm_schedule_period_compliance_vw AS
SELECT
  period_id,
  shop_number,
  count(*) FILTER (WHERE visit_type = 'Quarterly Audit') AS quarterly_audits,
  count(*) FILTER (WHERE visit_type = 'Standard Visit') AS standard_visits,
  CASE
    WHEN count(*) FILTER (WHERE visit_type = 'Quarterly Audit') >= 1
     AND count(*) FILTER (WHERE visit_type = 'Standard Visit') >= 1
    THEN true ELSE false
  END AS has_two_mandated_audits
FROM public.dm_schedule
WHERE COALESCE(status, 'planned') <> 'canceled'
GROUP BY period_id, shop_number;

-- Bulk upsert RPC
CREATE OR REPLACE FUNCTION public.upsert_dm_schedule_rows(rows jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.dm_schedule (
    shop_number,
    shop_id,
    district_name,
    region_name,
    period_id,
    visit_date,
    visit_type,
    notes,
    source,
    created_by,
    status
  )
  SELECT
    (r->>'shop_number')::int,
    nullif(r->>'shop_id',''),
    nullif(r->>'district_name',''),
    nullif(r->>'region_name',''),
    r->>'period_id',
    (r->>'visit_date')::date,
    r->>'visit_type',
    nullif(r->>'notes',''),
    coalesce(nullif(r->>'source',''),'ai'),
    auth.uid(),
    coalesce(nullif(r->>'status',''),'scheduled')
  FROM jsonb_array_elements(rows) r
  ON CONFLICT (coalesce(period_id,''), coalesce(shop_number,-1), visit_date, coalesce(visit_type,''))
  DO UPDATE SET
    notes = excluded.notes,
    source = excluded.source,
    status = excluded.status,
    updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_dm_schedule_rows(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_dm_schedule_rows(jsonb) TO authenticated;


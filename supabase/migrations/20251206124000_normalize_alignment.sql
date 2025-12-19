-- Migration: normalize company_alignment into shops + alignments
-- Creates `shops`, `alignments`, and seed shop-level alignments from `company_alignment`.

DO $$
BEGIN
  -- create shops table if missing
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'shops') THEN
    CREATE TABLE shops (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      shop_number text UNIQUE,
      shop_name text,
      district_name text,
      region_name text,
      division_name text,
      created_at timestamptz DEFAULT now()
    );
  END IF;

  -- create alignments table if missing
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'alignments') THEN
    CREATE TABLE alignments (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      code text UNIQUE NOT NULL,
      name text NOT NULL,
      region text,
      is_active boolean DEFAULT true,
      created_at timestamptz DEFAULT now()
    );
  END IF;

  -- create alignment_memberships if missing
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'alignment_memberships') THEN
    CREATE TABLE alignment_memberships (
      user_id uuid,
      alignment_id uuid,
      shop_id text,
      role text,
      is_primary boolean DEFAULT false,
      created_at timestamptz DEFAULT now(),
      PRIMARY KEY (user_id, alignment_id, shop_id)
    );
  END IF;
END$$;

-- Add cadence_templates RLS policies that depend on alignment_memberships now that the table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'alignment_memberships') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'cadence_templates' AND policyname = 'Allow insert by RD_VP_DM'
    ) THEN
      EXECUTE $policy$
        CREATE POLICY "Allow insert by RD_VP_DM" ON cadence_templates
          FOR INSERT
          WITH CHECK (EXISTS (
            SELECT 1 FROM alignment_memberships am
            WHERE am.user_id = auth.uid()
              AND lower(am.role) IN ('rd', 'vp', 'dm')
          ));
      $policy$;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'cadence_templates' AND policyname = 'Allow update by RD_VP_DM'
    ) THEN
      EXECUTE $policy$
        CREATE POLICY "Allow update by RD_VP_DM" ON cadence_templates
          FOR UPDATE
          USING (EXISTS (
            SELECT 1 FROM alignment_memberships am
            WHERE am.user_id = auth.uid()
              AND lower(am.role) IN ('rd', 'vp', 'dm')
          ))
          WITH CHECK (EXISTS (
            SELECT 1 FROM alignment_memberships am
            WHERE am.user_id = auth.uid()
              AND lower(am.role) IN ('rd', 'vp', 'dm')
          ));
      $policy$;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'cadence_templates' AND policyname = 'Allow delete by RD_VP_DM'
    ) THEN
      EXECUTE $policy$
        CREATE POLICY "Allow delete by RD_VP_DM" ON cadence_templates
          FOR DELETE
          USING (EXISTS (
            SELECT 1 FROM alignment_memberships am
            WHERE am.user_id = auth.uid()
              AND lower(am.role) IN ('rd', 'vp', 'dm')
          ));
      $policy$;
    END IF;
  END IF;
END$$;

-- Seed shops from company_alignment if that table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'company_alignment') THEN
    INSERT INTO shops (shop_number, shop_name, district_name, region_name, division_name)
    SELECT DISTINCT
      cast(store as text) as shop_number,
      coalesce("Shop", '') as shop_name,
      cast("District" as text) as district_name,
      cast("Region" as text) as region_name,
      cast("Division" as text) as division_name
    FROM company_alignment
    WHERE coalesce(store, '') <> ''
    ON CONFLICT (shop_number) DO NOTHING;
  END IF;
END$$;

-- Seed alignments for divisions, regions, districts and shops (shop-level alignments)
DO $$
DECLARE
  rec record;
  has_shop_name boolean;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'company_alignment') THEN
    -- divisions
    FOR rec IN (SELECT DISTINCT cast("Division" as text) AS name FROM company_alignment WHERE "Division" IS NOT NULL)
    LOOP
      INSERT INTO alignments (code, name, region, is_active)
      SELECT 'DIV:' || md5(coalesce(rec.name, '')), coalesce(rec.name, 'Division'), NULL, true
      WHERE NOT EXISTS (SELECT 1 FROM alignments WHERE name = rec.name);
    END LOOP;

    -- regions
    FOR rec IN (SELECT DISTINCT cast("Region" as text) AS name FROM company_alignment WHERE "Region" IS NOT NULL)
    LOOP
      INSERT INTO alignments (code, name, region, is_active)
      SELECT 'REG:' || md5(coalesce(rec.name, '')), coalesce(rec.name, 'Region'), NULL, true
      WHERE NOT EXISTS (SELECT 1 FROM alignments WHERE name = rec.name);
    END LOOP;

    -- districts
    FOR rec IN (SELECT DISTINCT cast("District" as text) AS name FROM company_alignment WHERE "District" IS NOT NULL)
    LOOP
      INSERT INTO alignments (code, name, region, is_active)
      SELECT 'DIST:' || md5(coalesce(rec.name, '')), coalesce(rec.name, 'District'), NULL, true
      WHERE NOT EXISTS (SELECT 1 FROM alignments WHERE name = rec.name);
    END LOOP;
  END IF;

  -- shop-level alignments
  has_shop_name := EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'shops' AND column_name = 'shop_name'
  );

  FOR rec IN EXECUTE format(
    'SELECT shop_number, %s FROM shops',
    CASE WHEN has_shop_name THEN 'shop_name' ELSE 'NULL::text as shop_name' END
  )
  LOOP
    INSERT INTO alignments (code, name, region, is_active)
    SELECT 'SHOP:' || coalesce(rec.shop_number, ''), coalesce(rec.shop_name, 'Shop ' || coalesce(rec.shop_number, '')), NULL, true
    WHERE NOT EXISTS (SELECT 1 FROM alignments WHERE code = 'SHOP:' || coalesce(rec.shop_number, ''));
  END LOOP;
END$$;

-- Create helper view to assist mapping legacy emails to users/alignments during migration
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'company_alignment') THEN
    EXECUTE '
      CREATE OR REPLACE VIEW company_alignment_email_map AS
      SELECT
        lower(cast("Shop_Email" as text)) AS shop_email,
        lower(cast("District_Email" as text)) AS district_email,
        lower(cast("Region_Email" as text)) AS region_email,
        lower(cast("Division_Email" as text)) AS division_email,
        cast(store as text) AS shop_number,
        cast("Shop" as text) AS shop_name,
        cast("District" as text) AS district_name,
        cast("Region" as text) AS region_name,
        cast("Division" as text) AS division_name
      FROM company_alignment;
    ';
  ELSE
    EXECUTE '
      CREATE OR REPLACE VIEW company_alignment_email_map AS
      SELECT
        NULL::text AS shop_email,
        NULL::text AS district_email,
        NULL::text AS region_email,
        NULL::text AS division_email,
        NULL::text AS shop_number,
        NULL::text AS shop_name,
        NULL::text AS district_name,
        NULL::text AS region_name,
        NULL::text AS division_name
      WHERE false;
    ';
  END IF;
END$$;

-- NOTE: mapping legacy emails into `alignment_memberships` requires matching `auth.users.email` to these emails.
-- Run additional scripts to create alignment_memberships by joining `company_alignment_email_map` to `auth.users` and
-- assigning roles (Tech1/Tech2/ASM/DM/RD/VP) as appropriate.




SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."inventory_mode" AS ENUM (
    'MASTER',
    'CSV'
);


ALTER TYPE "public"."inventory_mode" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_ensure_counts"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$ begin
  insert into inventory_counts(shop_id,item_number) values(new.shop_id,new.item_number)
  on conflict (shop_id,item_number) do nothing; return new;
end $$;


ALTER FUNCTION "public"."_ensure_counts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_touch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$ begin new.updated_at=now(); return new; end $$;


ALTER FUNCTION "public"."_touch_updated_at"() OWNER TO "postgres";


CREATE PROCEDURE "public"."adopt_master_for_shop"(IN "_shop_id" "text", IN "_force" boolean DEFAULT false)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF _force THEN
    DELETE FROM shop_overrides WHERE shop_id = _shop_id;
  END IF;

  INSERT INTO shop_overrides(
    shop_id, master_item_id, sku, item_name, brand, oil_grade, type,
    price, category_code, meta, source
  )
  SELECT 
    _shop_id, 
    m.id, 
    m.sku, 
    m.item_name, 
    m.brand, 
    m.oil_grade, 
    m.type,
    m.price, 
    m.category_code, 
    m.meta, 
    'master'
  FROM master_items m
  ON CONFLICT (shop_id, sku) DO NOTHING;

  INSERT INTO shop_inventory_profile(shop_id, mode, locked, source_note, updated_at)
  VALUES (_shop_id, 'MASTER', true, 'Adopted from master', now())
  ON CONFLICT (shop_id) DO UPDATE SET
    mode = 'MASTER', 
    locked = true, 
    source_note = 'Adopted from master', 
    updated_at = now();
END $$;


ALTER PROCEDURE "public"."adopt_master_for_shop"(IN "_shop_id" "text", IN "_force" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auto_tag_retail_period"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_calendar jsonb;
  v_date date;
BEGIN
  -- Determine which date column to use
  IF TG_TABLE_NAME = 'workbook_entries' THEN
    v_date := NEW.entry_date;
  ELSE
    v_date := NEW.date;
  END IF;

  -- Get retail calendar info
  v_calendar := get_retail_period_week(v_date);

  -- Set period_no and week_in_period if calendar data is valid
  IF v_calendar ? 'period_no' THEN
    NEW.period_no := (v_calendar->>'period_no')::integer;
    NEW.week_in_period := (v_calendar->>'week_in_period')::integer;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."auto_tag_retail_period"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_all_expired_logs"() RETURNS TABLE("log_type" "text", "deleted_count" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 'repairs_maintenance_log'::TEXT, cleanup_expired_rm_logs();
  
  RETURN QUERY
  SELECT 'challenges_log'::TEXT, cleanup_expired_challenges_logs();
  
  RETURN QUERY
  SELECT 'solink_audits'::TEXT, cleanup_expired_solink_audits();
  
  RETURN QUERY
  SELECT 'supply_ordering_log'::TEXT, cleanup_expired_supply_logs();
  
  RETURN QUERY
  SELECT 'claims_log'::TEXT, cleanup_expired_claims_logs();
END;
$$;


ALTER FUNCTION "public"."cleanup_all_expired_logs"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."cleanup_all_expired_logs"() IS 'Master function to clean up all expired log entries across all tables';



CREATE OR REPLACE FUNCTION "public"."cleanup_expired_challenges_logs"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM challenges_log
  WHERE expires_at < NOW();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;


ALTER FUNCTION "public"."cleanup_expired_challenges_logs"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."cleanup_expired_challenges_logs"() IS 'Deletes challenges log entries past their expiration date';



CREATE OR REPLACE FUNCTION "public"."cleanup_expired_claims_logs"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM claims_log
  WHERE expires_at < NOW();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;


ALTER FUNCTION "public"."cleanup_expired_claims_logs"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."cleanup_expired_claims_logs"() IS 'Deletes claims logs past their expiration date';



CREATE OR REPLACE FUNCTION "public"."cleanup_expired_rm_logs"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM repairs_maintenance_log
  WHERE created_at < (NOW() - INTERVAL '90 days');
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;


ALTER FUNCTION "public"."cleanup_expired_rm_logs"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."cleanup_expired_rm_logs"() IS 'Deletes R&M log entries older than 90 days';



CREATE OR REPLACE FUNCTION "public"."cleanup_expired_solink_audits"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM solink_audits
  WHERE expires_at < NOW();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;


ALTER FUNCTION "public"."cleanup_expired_solink_audits"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."cleanup_expired_solink_audits"() IS 'Deletes solink audits past their expiration date';



CREATE OR REPLACE FUNCTION "public"."cleanup_expired_supply_logs"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM supply_ordering_log
  WHERE expires_at < NOW();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;


ALTER FUNCTION "public"."cleanup_expired_supply_logs"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."cleanup_expired_supply_logs"() IS 'Deletes supply ordering logs past their expiration date';



CREATE OR REPLACE FUNCTION "public"."delete_expired_challenge_logs"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  DELETE FROM challenges_log WHERE expires_at < now();
END;
$$;


ALTER FUNCTION "public"."delete_expired_challenge_logs"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_old_turned_logs"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  DELETE FROM turned_logs
  WHERE date_time < NOW() - INTERVAL '90 days';
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."delete_old_turned_logs"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_default_admin_employee"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Check if shop already has an admin employee
  IF NOT EXISTS (
    SELECT 1 FROM shop_staff 
    WHERE shop_id = NEW.shop_id 
    AND staff_name = 'Admin Test'
  ) THEN
    -- Insert default admin employee
    INSERT INTO shop_staff (shop_id, staff_name, employee_phone_number, date_of_hired)
    VALUES (NEW.shop_id, 'Admin Test', '555-0100', CURRENT_DATE)
    ON CONFLICT DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."ensure_default_admin_employee"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."ensure_default_admin_employee"() IS 'Ensures each shop has a default Admin Test employee';



CREATE OR REPLACE FUNCTION "public"."export_summary"("_shop_id" "text") RETURNS TABLE("category_code" "text", "items" integer)
    LANGUAGE "sql"
    AS $$
  select category_code, count(*)::int
  from v_shop_effective_items
  where shop_id=_shop_id
  group by category_code
  order by category_code;
$$;


ALTER FUNCTION "public"."export_summary"("_shop_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fork_inventory_for_shop"("p_shop_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
begin
  insert into public.shop_inventory_items(
    shop_id, itemnumber, productnumber, category, floorcount, storagecount, updated_at
  )
  select p_shop_id, g.itemnumber, g.productnumber, g.category, g.floorcount, g.storagecount, now()
  from public.inventory_items g
  where not exists (
    select 1 from public.shop_inventory_items si
    where si.shop_id = p_shop_id and si.itemnumber = g.itemnumber
  );
end$$;


ALTER FUNCTION "public"."fork_inventory_for_shop"("p_shop_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_invoice_code"("p_invoice" "uuid") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_code TEXT;
  v_timestamp TEXT;
BEGIN
  -- Generate a unique code based on timestamp and random string
  v_timestamp := TO_CHAR(NOW(), 'YYMMDD');
  v_code := 'WO-' || v_timestamp || '-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6));
  
  -- Update the invoice with the generated code
  UPDATE invoices 
  SET code = v_code, 
      status = 'submitted',
      submitted_at = NOW()
  WHERE id = p_invoice;
  
  RETURN v_code;
END;
$$;


ALTER FUNCTION "public"."generate_invoice_code"("p_invoice" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."generate_invoice_code"("p_invoice" "uuid") IS 'Generates a unique work order code for an invoice';



CREATE OR REPLACE FUNCTION "public"."get_accessible_shops"() RETURNS TABLE("shop" "text", "district" "text", "region" "text", "shop_email" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  user_role TEXT;
  user_shop_id TEXT;
  user_district TEXT;
  user_region TEXT;
BEGIN
  -- Get user profile
  SELECT p.role, p.shop_id, p.district_name, p.region_name
  INTO user_role, user_shop_id, user_district, user_region
  FROM profiles p
  WHERE p.user_id = auth.uid();

  -- If no profile found, return empty
  IF user_role IS NULL THEN
    RETURN;
  END IF;

  -- Admin: return all shops
  IF user_role = 'admin' THEN
    RETURN QUERY
    SELECT sa.shop, sa.district, sa.region, sa.shop_email
    FROM shop_alignment sa
    ORDER BY sa.region, sa.district, sa.shop;
    RETURN;
  END IF;

  -- Regional Director: return all shops in their region
  IF user_role = 'regional_director' THEN
    RETURN QUERY
    SELECT sa.shop, sa.district, sa.region, sa.shop_email
    FROM shop_alignment sa
    WHERE sa.region = user_region
    ORDER BY sa.district, sa.shop;
    RETURN;
  END IF;

  -- District Manager: return all shops in their district
  IF user_role = 'district_manager' THEN
    RETURN QUERY
    SELECT sa.shop, sa.district, sa.region, sa.shop_email
    FROM shop_alignment sa
    WHERE sa.district = user_district
    ORDER BY sa.shop;
    RETURN;
  END IF;

  -- Shop: return only their shop
  IF user_role = 'shop' THEN
    RETURN QUERY
    SELECT sa.shop, sa.district, sa.region, sa.shop_email
    FROM shop_alignment sa
    WHERE sa.shop = user_shop_id
    LIMIT 1;
    RETURN;
  END IF;

  -- Default: return nothing
  RETURN;
END;
$$;


ALTER FUNCTION "public"."get_accessible_shops"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_districts_by_region"("p_region" "text") RETURNS TABLE("district" "text", "region" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT sa.district, sa.region
  FROM shop_alignment sa
  WHERE sa.region = p_region
    AND sa.district IS NOT NULL
  ORDER BY sa.district;
END;
$$;


ALTER FUNCTION "public"."get_districts_by_region"("p_region" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_regions"() RETURNS TABLE("region" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT sa.region
  FROM shop_alignment sa
  WHERE sa.region IS NOT NULL
  ORDER BY sa.region;
END;
$$;


ALTER FUNCTION "public"."get_regions"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_retail_period_week"("p_date" "date") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE
    AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'year', year,
    'period_no', period_no,
    'quarter', quarter,
    'week_in_period', LEAST(
      FLOOR((p_date - start_date) / 7) + 1,
      weeks
    ),
    'start_date', start_date,
    'end_date', end_date,
    'weeks', weeks
  )
  INTO v_result
  FROM retail_calendar
  WHERE p_date >= start_date AND p_date <= end_date
  LIMIT 1;

  IF v_result IS NULL THEN
    -- Return null if date is outside calendar range
    RETURN jsonb_build_object(
      'error', 'Date outside retail calendar range',
      'date', p_date
    );
  END IF;

  RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."get_retail_period_week"("p_date" "date") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_retail_period_week"("p_date" "date") IS 'Returns period_no and week_in_period for a given date (Batch 5)';



CREATE OR REPLACE FUNCTION "public"."get_shops_by_district"("p_district" "text") RETURNS TABLE("shop" "text", "district" "text", "region" "text", "shop_email" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sa.shop,
    sa.district,
    sa.region,
    sa.shop_email
  FROM shop_alignment sa
  WHERE sa.district = p_district
  ORDER BY sa.shop;
END;
$$;


ALTER FUNCTION "public"."get_shops_by_district"("p_district" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_hierarchy"() RETURNS TABLE("user_id" "uuid", "email" "text", "role" "text", "shop_id" "text", "shop_number" "text", "district_id" "text", "district_name" "text", "region_id" "text", "region_name" "text", "full_name" "text", "is_active" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.user_id,
    p.email,
    p.role,
    p.shop_id,
    p.store_number,
    p.district_id,
    p.district_name,
    p.region_id,
    p.region_name,
    p.full_name,
    p.is_active
  FROM profiles p
  WHERE p.user_id = auth.uid();
END;
$$;


ALTER FUNCTION "public"."get_user_hierarchy"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_user_hierarchy"() IS 'Returns current user''s hierarchy information including role and associated shop/district/region.';



CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, role, is_active)
  VALUES (
    NEW.id,
    NEW.email,
    'shop', -- Default role, can be updated later
    true
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."handle_new_user"() IS 'Automatically creates a profile when a new user signs up';



CREATE OR REPLACE FUNCTION "public"."has_shop_inventory"("p_shop_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  select exists (select 1 from public.shop_inventory_items where shop_id = p_shop_id)
$$;


ALTER FUNCTION "public"."has_shop_inventory"("p_shop_id" "uuid") OWNER TO "postgres";


CREATE PROCEDURE "public"."import_master_from_staging"()
    LANGUAGE "plpgsql"
    AS $$
DECLARE 
  r record; 
  v jsonb; 
  cat text;
BEGIN
  FOR r IN SELECT * FROM inventory_staging WHERE shop_id IS NULL LOOP
    v := r.raw;
    cat := coalesce(
      v->>'category_code',
      map_category_for_item(
        v->>'item_name', 
        v->>'type',
        v->>'category_hint', 
        v->>'sku'
      )
    );
    
    INSERT INTO master_items(
      sku, item_name, brand, oil_grade, type, price, category_code, meta
    ) VALUES (
      v->>'sku',
      v->>'item_name',
      v->>'brand',
      v->>'oil_grade',
      v->>'type',
      nullif(v->>'price','')::numeric,
      cat,
      v
    )
    ON CONFLICT (sku) DO UPDATE SET
      item_name = EXCLUDED.item_name,
      brand = EXCLUDED.brand,
      oil_grade = EXCLUDED.oil_grade,
      type = EXCLUDED.type,
      price = EXCLUDED.price,
      category_code = EXCLUDED.category_code,
      meta = EXCLUDED.meta,
      updated_at = now();
  END LOOP;
END $$;


ALTER PROCEDURE "public"."import_master_from_staging"() OWNER TO "postgres";


CREATE PROCEDURE "public"."import_shop_from_staging"(IN "_shop_id" "text")
    LANGUAGE "plpgsql"
    AS $$
DECLARE 
  r record; 
  v jsonb; 
  cat text; 
  mid uuid;
BEGIN
  FOR r IN SELECT * FROM inventory_staging WHERE shop_id = _shop_id LOOP
    v := r.raw;
    cat := coalesce(
      v->>'category_code',
      map_category_for_item(
        v->>'item_name', 
        v->>'type',
        v->>'category_hint', 
        v->>'sku'
      )
    );
    
    SELECT id INTO mid FROM master_items WHERE sku = (v->>'sku');

    INSERT INTO shop_overrides(
      shop_id, master_item_id, sku, item_name, brand, oil_grade, type,
      price, category_code, meta, source
    ) VALUES (
      _shop_id, 
      mid, 
      v->>'sku', 
      v->>'item_name', 
      v->>'brand', 
      v->>'oil_grade',
      v->>'type', 
      nullif(v->>'price','')::numeric, 
      cat, 
      v, 
      'csv'
    )
    ON CONFLICT (shop_id, sku) DO UPDATE SET
      item_name = EXCLUDED.item_name,
      brand = EXCLUDED.brand,
      oil_grade = EXCLUDED.oil_grade,
      type = EXCLUDED.type,
      price = EXCLUDED.price,
      category_code = EXCLUDED.category_code,
      meta = EXCLUDED.meta,
      updated_at = now();
  END LOOP;

  INSERT INTO shop_inventory_profile(shop_id, mode, locked, source_note, updated_at)
  VALUES (_shop_id, 'CSV', true, 'CSV import', now())
  ON CONFLICT (shop_id) DO UPDATE SET
    mode = 'CSV', 
    locked = true, 
    source_note = 'CSV import', 
    updated_at = now();
END $$;


ALTER PROCEDURE "public"."import_shop_from_staging"(IN "_shop_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."map_category_for_item"("_name" "text", "_type" "text", "_hint" "text", "_sku" "text") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE 
  best_code text := 'misc'; 
  best_score int := 0; 
  rec record;
  hay text := lower(coalesce(_name,'')||' '||coalesce(_type,'')||' '||
                   coalesce(_hint,'')||' '||coalesce(_sku,''));
BEGIN
  FOR rec IN SELECT category_code, keyword, weight FROM category_keywords LOOP
    IF position(rec.keyword IN hay) > 0 THEN
      IF rec.weight > best_score THEN
        best_score := rec.weight; 
        best_code := rec.category_code;
      END IF;
    END IF;
  END LOOP;
  
  IF best_code='misc' AND hay LIKE '%oil%' THEN 
    best_code:='oils'; 
  END IF;
  
  IF best_code='misc' AND hay LIKE '%wiper%' THEN 
    best_code:='wipers'; 
  END IF;
  
  RETURN best_code;
END $$;


ALTER FUNCTION "public"."map_category_for_item"("_name" "text", "_type" "text", "_hint" "text", "_sku" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_import_count_modification"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Check if this is being called from an import context
  -- (we'll set a session variable during imports)
  IF current_setting('app.import_in_progress', true) = 'true' THEN
    RAISE EXCEPTION 'Cannot modify count sheet items during import. Use reset_count_sheet() instead.';
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."prevent_import_count_modification"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."prevent_import_count_modification"() IS 'Prevents imports from modifying count sheets (Batch 4 - enforced in code)';



CREATE OR REPLACE FUNCTION "public"."refresh_materialized_view"("view_name" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  execute format('refresh materialized view concurrently %I', view_name);
end;
$$;


ALTER FUNCTION "public"."refresh_materialized_view"("view_name" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."refresh_materialized_view"("view_name" "text") IS 'Helper function to refresh materialized views (used by alignment-import edge function)';



CREATE OR REPLACE FUNCTION "public"."reset_count_sheet"("p_shop_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_old_sheet_id uuid;
  v_new_sheet_id uuid;
  v_items_count integer;
BEGIN
  -- Find the current active sheet
  SELECT id INTO v_old_sheet_id
  FROM shop_count_sheets
  WHERE shop_id = p_shop_id AND is_active = true
  LIMIT 1;

  IF v_old_sheet_id IS NULL THEN
    RAISE EXCEPTION 'No active count sheet found for shop %', p_shop_id;
  END IF;

  -- Archive the current sheet
  UPDATE shop_count_sheets
  SET is_active = false,
      archived_at = now()
  WHERE id = v_old_sheet_id;

  -- Create new active sheet
  INSERT INTO shop_count_sheets (shop_id, name, is_active)
  VALUES (p_shop_id, 'Active Count Sheet', true)
  RETURNING id INTO v_new_sheet_id;

  -- Copy products from old sheet to new sheet with zero counts
  INSERT INTO shop_count_sheet_items (sheet_id, product_id, sku, count, last_modified)
  SELECT v_new_sheet_id, product_id, sku, 0, now()
  FROM shop_count_sheet_items
  WHERE sheet_id = v_old_sheet_id;

  GET DIAGNOSTICS v_items_count = ROW_COUNT;

  -- Return summary
  RETURN jsonb_build_object(
    'old_sheet_id', v_old_sheet_id,
    'new_sheet_id', v_new_sheet_id,
    'items_reset', v_items_count,
    'archived_at', now()
  );
END;
$$;


ALTER FUNCTION "public"."reset_count_sheet"("p_shop_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."reset_count_sheet"("p_shop_id" "uuid") IS 'Archives current count sheet and creates new one with zero counts (Batch 4)';



CREATE PROCEDURE "public"."reset_shop_profile"(IN "_shop_id" "text", IN "_strategy" "text", IN "_drop_custom" boolean DEFAULT false)
    LANGUAGE "plpgsql"
    AS $$
begin
  if _strategy='CLEAR_AND_EMPTY' then
    delete from shop_overrides where shop_id=_shop_id;
  elsif _strategy='CLEAR_AND_ADOPT_MASTER' then
    delete from shop_overrides where shop_id=_shop_id;
    call adopt_master_for_shop(_shop_id, true);
  elsif _strategy='REAPPLY_MASTER' then
    if _drop_custom then
      delete from shop_overrides where shop_id=_shop_id and master_item_id is null;
    end if;
    -- refresh only rows tied to master
    delete from shop_overrides where shop_id=_shop_id and master_item_id is not null;
    call adopt_master_for_shop(_shop_id, false);
  else
    raise exception 'Unknown strategy';
  end if;

  insert into shop_inventory_profile(shop_id, mode, locked, source_note, updated_at)
  values (_shop_id,'MASTER',true,'Reset via '||_strategy,now())
  on conflict (shop_id) do update set locked=true, source_note='Reset via '||_strategy, updated_at=now();
end $$;


ALTER PROCEDURE "public"."reset_shop_profile"(IN "_shop_id" "text", IN "_strategy" "text", IN "_drop_custom" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_inventory_last_changed_on_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.last_changed_at = now();
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_inventory_last_changed_on_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN 
  NEW.updated_at = now(); 
  RETURN NEW; 
END;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."tag_with_retail_calendar"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_calendar jsonb;
BEGIN
  -- Get retail calendar info for the date
  -- Assumes the table has a 'date' or 'entry_date' or 'report_date' column
  IF TG_TABLE_NAME = 'shop_workbook_entries' THEN
    v_calendar := get_retail_period_week(NEW.date);
  ELSIF TG_TABLE_NAME = 'shop_checkbook_entries' THEN
    v_calendar := get_retail_period_week(NEW.date);
  ELSIF TG_TABLE_NAME = 'daily_sales_entries' THEN
    v_calendar := get_retail_period_week(NEW.date);
  ELSIF TG_TABLE_NAME = 'workbook_entries' THEN
    v_calendar := get_retail_period_week(NEW.entry_date);
  ELSE
    -- Default: try 'date' column
    v_calendar := get_retail_period_week(NEW.date);
  END IF;

  -- Store calendar info in metadata if column exists
  -- This is a soft implementation - tables can add period_no/week_in_period columns if needed
  IF v_calendar ? 'period_no' THEN
    -- If table has metadata column, store there
    IF TG_TABLE_NAME IN ('shop_workbook_entries', 'shop_checkbook_entries') THEN
      -- These tables don't have metadata, so we'll add columns in a future migration if needed
      NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."tag_with_retail_calendar"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."tag_with_retail_calendar"() IS 'Trigger function to tag writes with period_no and week_in_period (Batch 5)';



CREATE PROCEDURE "public"."toggle_shop_lock"(IN "_shop_id" "text", IN "_locked" boolean)
    LANGUAGE "sql"
    AS $$
  insert into shop_inventory_profile(shop_id, locked)
  values (_shop_id, _locked)
  on conflict (shop_id) do update set locked = excluded.locked, updated_at = now();
$$;


ALTER PROCEDURE "public"."toggle_shop_lock"(IN "_shop_id" "text", IN "_locked" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_alignment_updated"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN 
  NEW.updated_at = now(); 
  RETURN NEW; 
END;
$$;


ALTER FUNCTION "public"."touch_alignment_updated"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_profiles_updated"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN 
  NEW.updated_at = now(); 
  RETURN NEW; 
END;
$$;


ALTER FUNCTION "public"."touch_profiles_updated"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin new.updated_at = now(); return new; end $$;


ALTER FUNCTION "public"."touch_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_claims_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_claims_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_count_sheet_items_last_modified"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.last_modified = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_count_sheet_items_last_modified"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_dm_schedule_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_dm_schedule_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_inventory_last_changed"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Only update last_changed_at if floor_count or storage_count actually changed
  IF (OLD.floor_count IS DISTINCT FROM NEW.floor_count) OR 
     (OLD.storage_count IS DISTINCT FROM NEW.storage_count) THEN
    NEW.last_changed_at = now();
  END IF;
  
  -- Always update updated_at
  NEW.updated_at = now();
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_inventory_last_changed"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_pos_price_for_invoice"("p_button_id" "uuid", "p_new_price" numeric, "p_invoice_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Update the button price
  UPDATE pos_buttons 
  SET unit_price = p_new_price, 
      updated_at = NOW()
  WHERE id = p_button_id;
  
  -- Update any existing invoice items with this button
  UPDATE invoice_items 
  SET unit_price = p_new_price,
      line_total = quantity * p_new_price
  WHERE button_id = p_button_id 
    AND invoice_id = p_invoice_id;
END;
$$;


ALTER FUNCTION "public"."update_pos_price_for_invoice"("p_button_id" "uuid", "p_new_price" numeric, "p_invoice_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_pos_price_for_invoice"("p_button_id" "uuid", "p_new_price" numeric, "p_invoice_id" "uuid") IS 'Updates POS button price and syncs with invoice items';



CREATE OR REPLACE FUNCTION "public"."update_shop_master_products_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_shop_master_products_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_shops_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_shops_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_turned_log_daily_count"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Upsert the daily count (+1 for the date of turned_at)
  INSERT INTO turned_log_daily_counts (shop_id, day, count)
  VALUES (
    NEW.shop_id,
    DATE(COALESCE(NEW.turned_at, NEW.created_at)),
    1
  )
  ON CONFLICT (shop_id, day)
  DO UPDATE SET count = turned_log_daily_counts.count + 1;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_turned_log_daily_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_turned_logs_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_turned_logs_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_has_shop_access"("target_shop_id" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  user_role TEXT;
  user_shop_id TEXT;
  user_district TEXT;
  user_region TEXT;
  shop_district TEXT;
  shop_region TEXT;
BEGIN
  -- Get user profile
  SELECT p.role, p.shop_id, p.district_name, p.region_name
  INTO user_role, user_shop_id, user_district, user_region
  FROM profiles p
  WHERE p.user_id = auth.uid();

  -- No profile = no access
  IF user_role IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Admin has access to everything
  IF user_role = 'admin' THEN
    RETURN TRUE;
  END IF;

  -- Get shop's district and region
  SELECT sa.district, sa.region
  INTO shop_district, shop_region
  FROM shop_alignment sa
  WHERE sa.shop = target_shop_id;

  -- Regional Director: check region match
  IF user_role = 'regional_director' THEN
    RETURN shop_region = user_region;
  END IF;

  -- District Manager: check district match
  IF user_role = 'district_manager' THEN
    RETURN shop_district = user_district;
  END IF;

  -- Shop: check exact shop match
  IF user_role = 'shop' THEN
    RETURN target_shop_id = user_shop_id;
  END IF;

  -- Default: no access
  RETURN FALSE;
END;
$$;


ALTER FUNCTION "public"."user_has_shop_access"("target_shop_id" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."Shop_alignment" (
    "Shop" bigint NOT NULL,
    "District" "text",
    "Region" "text",
    "shop_User" "text",
    "shop_pass" "text",
    "district_user" "text",
    "district_pass" "text",
    "region_user" "text",
    "region_pass" "text"
);


ALTER TABLE "public"."Shop_alignment" OWNER TO "postgres";


COMMENT ON TABLE "public"."Shop_alignment" IS 'Legacy alignment table with RLS enabled (Security Audit Fix - Jan 2025)';



CREATE TABLE IF NOT EXISTS "public"."ai_scanned_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "text" NOT NULL,
    "category_id" "uuid",
    "image_uri" "text",
    "image_base64" "text",
    "detected_item_name" "text",
    "detected_item_number" "text",
    "confidence_score" numeric(5,2),
    "ai_provider" "text" DEFAULT 'gemini'::"text",
    "ai_raw_response" "jsonb",
    "manual_item_name" "text",
    "manual_item_number" "text",
    "is_verified" boolean DEFAULT false,
    "floor_count" integer DEFAULT 0,
    "storage_count" integer DEFAULT 0,
    "status" "text" DEFAULT 'pending'::"text",
    "scanned_by" "text",
    "scanned_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "ai_scanned_items_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'verified'::"text", 'added_to_inventory'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."ai_scanned_items" OWNER TO "postgres";


COMMENT ON TABLE "public"."ai_scanned_items" IS 'Stores items scanned using AI camera with recognition metadata';



CREATE TABLE IF NOT EXISTS "public"."alignment_master" (
    "Region" "text",
    "District" "text",
    "Store" integer NOT NULL,
    "Shop_email" "text",
    "shop_pass" "text",
    "dm_email" "text",
    "dm_pass" "text",
    "rd_email" "text",
    "rd_pass" "text",
    "shop_id" "text",
    "shop_name" "text",
    "district_id" "text",
    "district_name" "text",
    "region_id" "text",
    "region_name" "text",
    "shop_email" "text",
    "is_active" boolean DEFAULT true,
    "notes" "text",
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."alignment_master" OWNER TO "postgres";


COMMENT ON TABLE "public"."alignment_master" IS 'Master alignment sheet - data normalized from CSV import (fixed 2025-01-27)';



CREATE TABLE IF NOT EXISTS "public"."app_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "key" "text" NOT NULL,
    "value" "text",
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."app_settings" OWNER TO "postgres";


COMMENT ON TABLE "public"."app_settings" IS 'Stores application-wide settings and configuration values including branding asset URLs';



CREATE TABLE IF NOT EXISTS "public"."budgets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "month" "date" NOT NULL,
    "category_id" "uuid",
    "amount" numeric(12,2),
    "shop_id" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "budgets_amount_check" CHECK (("amount" >= (0)::numeric))
);


ALTER TABLE "public"."budgets" OWNER TO "postgres";


COMMENT ON TABLE "public"."budgets" IS 'Monthly budgets per category';



CREATE TABLE IF NOT EXISTS "public"."categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "color" "text" NOT NULL,
    "is_system" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "icon" "text" DEFAULT 'circle.fill'::"text",
    "is_locked" boolean DEFAULT false,
    "is_custom" boolean DEFAULT false
);


ALTER TABLE "public"."categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."category_keywords" (
    "id" bigint NOT NULL,
    "category_code" "text",
    "keyword" "text" NOT NULL,
    "weight" integer DEFAULT 1 NOT NULL
);


ALTER TABLE "public"."category_keywords" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."category_keywords_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."category_keywords_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."category_keywords_id_seq" OWNED BY "public"."category_keywords"."id";



CREATE TABLE IF NOT EXISTS "public"."challenges_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "text" NOT NULL,
    "shop_number" "text",
    "challenge_type" "text" NOT NULL,
    "employee_name" "text" NOT NULL,
    "evaluator" "text",
    "total_score" integer DEFAULT 0,
    "max_score" integer DEFAULT 0,
    "challenge_data" "jsonb" DEFAULT '{}'::"jsonb",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone DEFAULT ("now"() + '90 days'::interval),
    CONSTRAINT "challenges_log_challenge_type_check" CHECK (("challenge_type" = ANY (ARRAY['employee'::"text", 'manager'::"text", 'crew_greeting'::"text", 'crew_hood_tech'::"text", 'crew_pit_tech'::"text", 'crew_service_writer'::"text", 'crew_safety_check'::"text", 'crew_smart_friend'::"text"])))
);


ALTER TABLE "public"."challenges_log" OWNER TO "postgres";


COMMENT ON TABLE "public"."challenges_log" IS 'Stores all challenge submissions with 90-day retention';



COMMENT ON COLUMN "public"."challenges_log"."expires_at" IS 'Automatic expiration date set to 90 days from creation';



CREATE TABLE IF NOT EXISTS "public"."claims" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "text" NOT NULL,
    "claim_type" "text" NOT NULL,
    "reported_by" "text",
    "photo_urls" "text"[],
    "status" "text" DEFAULT 'pending'::"text",
    "claim_code" "text",
    "employee_name" "text",
    "employee_phone" "text",
    "employee_address" "text",
    "incident_type" "text",
    "employee_description" "text",
    "customer_name" "text",
    "customer_phone" "text",
    "customer_address" "text",
    "vin_number" "text",
    "vehicle_year" "text",
    "vehicle_make" "text",
    "vehicle_model" "text",
    "employee_worked_vehicle" "text",
    "service_writer" "text",
    "mod" "text",
    "customer_description" "text",
    "incident_time" timestamp with time zone,
    "incident_date" "date",
    "theft_date" "date",
    "theft_time" time without time zone,
    "theft_area" "text",
    "stolen_items_description" "text",
    "stolen_items_dollar_amount" numeric(10,2),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "claims_claim_type_check" CHECK (("claim_type" = ANY (ARRAY['employee'::"text", 'customer'::"text", 'theft_robbery'::"text"]))),
    CONSTRAINT "claims_incident_type_check" CHECK (("incident_type" = ANY (ARRAY['slip_and_fall'::"text", 'cut_or_laceration'::"text", 'struck_by'::"text", 'hit_by_car'::"text", 'fell_in_pit'::"text"]))),
    CONSTRAINT "claims_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text", 'in_progress'::"text"])))
);


ALTER TABLE "public"."claims" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."claims_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "text" NOT NULL,
    "log_type" "text" NOT NULL,
    "entry_type" "text",
    "claim_id" "uuid",
    "refund_id" "uuid",
    "submitted_by" "text",
    "customer_name" "text",
    "amount" numeric,
    "description" "text",
    "attachment_urls" "text"[] DEFAULT '{}'::"text"[],
    "submitted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '6 mons'::interval),
    CONSTRAINT "claims_log_entry_type_check" CHECK (("entry_type" = ANY (ARRAY['employee'::"text", 'customer'::"text", 'theft_robbery'::"text"]))),
    CONSTRAINT "claims_log_log_type_check" CHECK (("log_type" = ANY (ARRAY['claim'::"text", 'refund'::"text"])))
);


ALTER TABLE "public"."claims_log" OWNER TO "postgres";


COMMENT ON TABLE "public"."claims_log" IS 'Stores all claim and refund submissions with 6-month retention';



COMMENT ON COLUMN "public"."claims_log"."log_type" IS 'Type of log entry: claim or refund';



COMMENT ON COLUMN "public"."claims_log"."entry_type" IS 'For claims: employee, customer, or theft_robbery';



COMMENT ON COLUMN "public"."claims_log"."expires_at" IS 'Automatic expiration date set to 6 months from creation';



CREATE TABLE IF NOT EXISTS "public"."coaching_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "text" NOT NULL,
    "shop_number" "text",
    "employee_id" "uuid",
    "employee_name" "text" NOT NULL,
    "coach_name" "text" NOT NULL,
    "coaching_reason" "text" NOT NULL,
    "other_reason" "text",
    "coached_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone DEFAULT ("now"() + '360 days'::interval),
    CONSTRAINT "coaching_logs_coaching_reason_check" CHECK (("coaching_reason" = ANY (ARRAY['tardy'::"text", 'uniform'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."coaching_logs" OWNER TO "postgres";


COMMENT ON TABLE "public"."coaching_logs" IS 'Stores employee coaching records with 360-day retention';



CREATE TABLE IF NOT EXISTS "public"."contacts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "company" "text" NOT NULL,
    "phone" "text",
    "email" "text",
    "notes" "text",
    "contact_type" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "contacts_contact_type_check" CHECK (("contact_type" = ANY (ARRAY['vendor'::"text", 'work'::"text"])))
);


ALTER TABLE "public"."contacts" OWNER TO "postgres";


COMMENT ON TABLE "public"."contacts" IS 'Stores vendor and work contacts for each shop';



CREATE TABLE IF NOT EXISTS "public"."crash_kit_customers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "text" NOT NULL,
    "first_name" "text",
    "last_name" "text",
    "phone" "text",
    "email" "text",
    "address" "text",
    "city" "text",
    "state" "text",
    "zipcode" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."crash_kit_customers" OWNER TO "postgres";


COMMENT ON TABLE "public"."crash_kit_customers" IS 'Customer database for crash kit POS';



CREATE TABLE IF NOT EXISTS "public"."crash_kit_invoices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "text" NOT NULL,
    "invoice_number" "text" NOT NULL,
    "phone" "text",
    "license_plate" "text",
    "state" "text",
    "vin" "text",
    "mileage" "text",
    "year" "text",
    "make" "text",
    "model" "text",
    "name_first" "text",
    "name_last" "text",
    "address" "text",
    "city" "text",
    "zipcode" "text",
    "email" "text",
    "oil" "text",
    "viscosity" "text",
    "quarts" "text",
    "filter_number" "text",
    "drain_plug" "text",
    "gasket" "text",
    "windshield" "text",
    "air_filter" "text",
    "ps_fluid" "text",
    "coolant" "text",
    "transmission" "text",
    "cabin_filter" "text",
    "washer_fluid" "text",
    "wiper_blades" "text",
    "tires_front" "text",
    "tires_rear" "text",
    "oil_change" "text",
    "sub_total" "text",
    "coupon" "text",
    "total" "text",
    "payment" "text",
    "cash_amount_given" "text",
    "confirmation_number" "text",
    "windshield_topoff" "text",
    "oil_topoff" "text",
    "ps_fluid_topoff" "text",
    "coolant_topoff" "text",
    "transmission_topoff" "text",
    "washer_fluid_topoff" "text",
    "tires_topoff" "text",
    "tech_hood" "text",
    "tech_pit" "text",
    "tech_safety" "text",
    "service_writer" "text",
    "comments" "text",
    "receipt_print_mail" boolean DEFAULT false,
    "receipt_email" boolean DEFAULT false,
    "vin_scan_url" "text",
    "coupon_scan_url" "text",
    "status" "text" DEFAULT 'draft'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "differentials" "text",
    "diesel_fuel_filter" "text",
    "drain_plug_status" "text",
    "gasket_status" "text",
    "windshield_status" "text",
    "air_filter_status" "text",
    "ps_fluid_status" "text",
    "coolant_status" "text",
    "transmission_status" "text",
    "cabin_filter_status" "text",
    "washer_fluid_status" "text",
    "wiper_blades_status" "text",
    "tires_front_status" "text",
    "tires_rear_status" "text",
    "differentials_status" "text",
    "diesel_fuel_filter_status" "text",
    CONSTRAINT "crash_kit_invoices_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'completed'::"text", 'exported'::"text"])))
);


ALTER TABLE "public"."crash_kit_invoices" OWNER TO "postgres";


COMMENT ON TABLE "public"."crash_kit_invoices" IS 'Stores crash kit temporary invoices with VIN decoding and scanning capabilities';



COMMENT ON COLUMN "public"."crash_kit_invoices"."differentials" IS 'Differential fluid type/grade (e.g., 75W-90, 80W-140)';



COMMENT ON COLUMN "public"."crash_kit_invoices"."diesel_fuel_filter" IS 'Diesel fuel filter part number (e.g., FF5320, FS19766)';



COMMENT ON COLUMN "public"."crash_kit_invoices"."drain_plug_status" IS 'Status dropdown: Complete, Replaced, OK, Safe level, Filled, Clean, Checked';



COMMENT ON COLUMN "public"."crash_kit_invoices"."gasket_status" IS 'Status dropdown: Complete, Replaced, OK, Safe level, Filled, Clean, Checked';



COMMENT ON COLUMN "public"."crash_kit_invoices"."windshield_status" IS 'Status dropdown: Complete, Replaced, OK, Safe level, Filled, Clean, Checked';



COMMENT ON COLUMN "public"."crash_kit_invoices"."air_filter_status" IS 'Status dropdown: Complete, Replaced, OK, Safe level, Filled, Clean, Checked';



COMMENT ON COLUMN "public"."crash_kit_invoices"."ps_fluid_status" IS 'Status dropdown: Complete, Replaced, OK, Safe level, Filled, Clean, Checked';



COMMENT ON COLUMN "public"."crash_kit_invoices"."coolant_status" IS 'Status dropdown: Complete, Replaced, OK, Safe level, Filled, Clean, Checked';



COMMENT ON COLUMN "public"."crash_kit_invoices"."transmission_status" IS 'Status dropdown: Complete, Replaced, OK, Safe level, Filled, Clean, Checked';



COMMENT ON COLUMN "public"."crash_kit_invoices"."cabin_filter_status" IS 'Status dropdown: Complete, Replaced, OK, Safe level, Filled, Clean, Checked';



COMMENT ON COLUMN "public"."crash_kit_invoices"."washer_fluid_status" IS 'Status dropdown: Complete, Replaced, OK, Safe level, Filled, Clean, Checked';



COMMENT ON COLUMN "public"."crash_kit_invoices"."wiper_blades_status" IS 'Status dropdown: Complete, Replaced, OK, Safe level, Filled, Clean, Checked';



COMMENT ON COLUMN "public"."crash_kit_invoices"."tires_front_status" IS 'Status dropdown: Complete, Replaced, OK, Safe level, Filled, Clean, Checked';



COMMENT ON COLUMN "public"."crash_kit_invoices"."tires_rear_status" IS 'Status dropdown: Complete, Replaced, OK, Safe level, Filled, Clean, Checked';



COMMENT ON COLUMN "public"."crash_kit_invoices"."differentials_status" IS 'Status dropdown: Complete, Replaced, OK, Safe level, Filled, Clean, Checked';



COMMENT ON COLUMN "public"."crash_kit_invoices"."diesel_fuel_filter_status" IS 'Status dropdown: Complete, Replaced, OK, Safe level, Filled, Clean, Checked';



CREATE TABLE IF NOT EXISTS "public"."crash_kit_logbook" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "text" NOT NULL,
    "shop_number" "text",
    "log_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "customer_id" "uuid",
    "vehicle_id" "uuid",
    "cart_data" "jsonb" DEFAULT '[]'::"jsonb",
    "subtotal" numeric DEFAULT 0,
    "discount" numeric DEFAULT 0,
    "tax" numeric DEFAULT 0,
    "total" numeric DEFAULT 0,
    "payment_method" "text",
    "notes" "text",
    "mode" "text" DEFAULT 'checkout'::"text",
    "status" "text" DEFAULT 'draft'::"text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "customer_data" "jsonb" DEFAULT '{}'::"jsonb",
    "vehicle_data" "jsonb" DEFAULT '{}'::"jsonb",
    "vehicle_brands" "jsonb" DEFAULT '{}'::"jsonb",
    "cc_transaction_number" "text",
    "cash_received" numeric DEFAULT 0,
    "change_due" numeric DEFAULT 0,
    CONSTRAINT "crash_kit_logbook_mode_check" CHECK (("mode" = ANY (ARRAY['take-in'::"text", 'checkout'::"text"]))),
    CONSTRAINT "crash_kit_logbook_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'completed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."crash_kit_logbook" OWNER TO "postgres";


COMMENT ON TABLE "public"."crash_kit_logbook" IS 'Stores crash kit POS transactions with 7-day rolling view';



COMMENT ON COLUMN "public"."crash_kit_logbook"."customer_data" IS 'Customer information including name, phone, email, fleet account details';



COMMENT ON COLUMN "public"."crash_kit_logbook"."vehicle_data" IS 'Vehicle information including VIN, year, make, model, mileage, notes, and service technicians';



COMMENT ON COLUMN "public"."crash_kit_logbook"."vehicle_brands" IS 'Vehicle brand preferences for oil, air, wiper, fluid, and other parts';



COMMENT ON COLUMN "public"."crash_kit_logbook"."cc_transaction_number" IS 'Credit card transaction number for CC payments';



COMMENT ON COLUMN "public"."crash_kit_logbook"."cash_received" IS 'Cash amount received for cash/fleet payments';



COMMENT ON COLUMN "public"."crash_kit_logbook"."change_due" IS 'Change due for cash/fleet payments';



CREATE TABLE IF NOT EXISTS "public"."crash_kit_offline_queue" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "text" NOT NULL,
    "action_type" "text" NOT NULL,
    "payload" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "synced_at" timestamp with time zone,
    "sync_status" "text" DEFAULT 'pending'::"text",
    CONSTRAINT "crash_kit_offline_queue_sync_status_check" CHECK (("sync_status" = ANY (ARRAY['pending'::"text", 'synced'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."crash_kit_offline_queue" OWNER TO "postgres";


COMMENT ON TABLE "public"."crash_kit_offline_queue" IS 'Offline queue for syncing when connection is restored';



CREATE TABLE IF NOT EXISTS "public"."crash_kit_products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "text",
    "category" "text" NOT NULL,
    "name" "text" NOT NULL,
    "sku" "text",
    "price" numeric DEFAULT 0,
    "image_url" "text",
    "is_active" boolean DEFAULT true,
    "display_order" integer DEFAULT 999,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."crash_kit_products" OWNER TO "postgres";


COMMENT ON TABLE "public"."crash_kit_products" IS 'Product catalog for crash kit POS';



CREATE TABLE IF NOT EXISTS "public"."crash_kit_vehicles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "text" NOT NULL,
    "customer_id" "uuid",
    "vin" "text",
    "year" "text",
    "make" "text",
    "model" "text",
    "license_plate" "text",
    "state" "text",
    "mileage" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."crash_kit_vehicles" OWNER TO "postgres";


COMMENT ON TABLE "public"."crash_kit_vehicles" IS 'Vehicle database linked to customers';



CREATE TABLE IF NOT EXISTS "public"."crew_challenges" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "text" NOT NULL,
    "date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "employee_name" "text" NOT NULL,
    "greeting_score" integer DEFAULT 0,
    "hood_tech_score" integer DEFAULT 0,
    "pit_tech_score" integer DEFAULT 0,
    "safety_score" integer DEFAULT 0,
    "mod_score" integer DEFAULT 0,
    "total_score" integer DEFAULT 0,
    "signature" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "evaluator" "text",
    "shop_number" "text",
    "section" "text",
    "total_points" integer DEFAULT 0,
    "checklist_json" "jsonb"
);


ALTER TABLE "public"."crew_challenges" OWNER TO "postgres";


COMMENT ON TABLE "public"."crew_challenges" IS 'Stores crew challenge data with detailed checklist information in JSON format';



COMMENT ON COLUMN "public"."crew_challenges"."section" IS 'Challenge section: greeting, hood_tech, pit_tech, safety, service_writer, mod';



COMMENT ON COLUMN "public"."crew_challenges"."checklist_json" IS 'JSON object containing all checklist item responses';



CREATE TABLE IF NOT EXISTS "public"."daily_cadence" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "text" NOT NULL,
    "date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "period" "text" NOT NULL,
    "task_name" "text" NOT NULL,
    "completed" boolean DEFAULT false,
    "completed_at" timestamp with time zone,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "day_of_week" "text",
    "is_editable" boolean DEFAULT true,
    "sort_order" integer DEFAULT 0,
    CONSTRAINT "daily_cadence_day_of_week_check" CHECK (("day_of_week" = ANY (ARRAY['sunday'::"text", 'monday'::"text", 'tuesday'::"text", 'wednesday'::"text", 'thursday'::"text", 'friday'::"text", 'saturday'::"text"]))),
    CONSTRAINT "daily_cadence_period_check" CHECK (("period" = ANY (ARRAY['morning'::"text", 'midday'::"text", 'closing'::"text"])))
);


ALTER TABLE "public"."daily_cadence" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."daily_checkbook_monthly_totals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "text" NOT NULL,
    "shop_number" "text",
    "month_start_date" "date" NOT NULL,
    "period_no" integer,
    "quarter" integer,
    "vendor_totals" "jsonb" DEFAULT '{}'::"jsonb",
    "week1_total" numeric DEFAULT 0,
    "week2_total" numeric DEFAULT 0,
    "week3_total" numeric DEFAULT 0,
    "week4_total" numeric DEFAULT 0,
    "week5_total" numeric DEFAULT 0,
    "monthly_total" numeric DEFAULT 0,
    "monthly_budget" numeric DEFAULT 0,
    "monthly_variance" numeric DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."daily_checkbook_monthly_totals" OWNER TO "postgres";


COMMENT ON TABLE "public"."daily_checkbook_monthly_totals" IS 'Stores running monthly totals for Daily Checkbook with vendor breakdowns';



CREATE TABLE IF NOT EXISTS "public"."daily_log_config" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "text" NOT NULL,
    "enabled" boolean DEFAULT true,
    "send_time" time without time zone DEFAULT '20:00:00'::time without time zone,
    "dm_email" "text",
    "cc_emails" "text"[],
    "include_inventory" boolean DEFAULT true,
    "include_labor" boolean DEFAULT true,
    "include_cadence" boolean DEFAULT true,
    "include_challenges" boolean DEFAULT true,
    "include_repairs" boolean DEFAULT true,
    "include_claims" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."daily_log_config" OWNER TO "postgres";


COMMENT ON TABLE "public"."daily_log_config" IS 'Configuration for daily log generation and delivery per shop';



CREATE TABLE IF NOT EXISTS "public"."daily_logbook" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "source" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "shop_id" "text" NOT NULL,
    "happened_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "message" "text" NOT NULL,
    "payload" "jsonb"
);


ALTER TABLE "public"."daily_logbook" OWNER TO "postgres";


COMMENT ON TABLE "public"."daily_logbook" IS 'Stores all daily logbook entries from various sources';



CREATE TABLE IF NOT EXISTS "public"."daily_logbook_close" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "text" NOT NULL,
    "shop_number" "text",
    "report_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "cash_start" numeric DEFAULT 0,
    "cash_end" numeric DEFAULT 0,
    "deposit_amount" numeric DEFAULT 0,
    "expected_amount" numeric DEFAULT 0,
    "over_short" numeric GENERATED ALWAYS AS (("cash_end" - "expected_amount")) STORED,
    "labor_hours" numeric DEFAULT 0,
    "scheduled_hours" numeric DEFAULT 0,
    "inventory_loss" numeric DEFAULT 0,
    "notes" "text",
    "activity_counts" "jsonb" DEFAULT '{}'::"jsonb",
    "summary_html" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid"
);


ALTER TABLE "public"."daily_logbook_close" OWNER TO "postgres";


COMMENT ON TABLE "public"."daily_logbook_close" IS 'Batch 8: Stores daily logbook close entries with Over/Short calculation';



CREATE TABLE IF NOT EXISTS "public"."daily_logbook_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "text" NOT NULL,
    "shop_number" "text",
    "report_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "entry_type" "text" NOT NULL,
    "entry_data" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "daily_logbook_entries_entry_type_check" CHECK (("entry_type" = ANY (ARRAY['cash'::"text", 'labor'::"text", 'inventory_sold'::"text", 'inventory_export'::"text", 'cadence'::"text", 'challenge'::"text", 'repair'::"text", 'claim'::"text", 'meeting'::"text", 'turned_log'::"text"])))
);


ALTER TABLE "public"."daily_logbook_entries" OWNER TO "postgres";


COMMENT ON TABLE "public"."daily_logbook_entries" IS 'Stores detailed daily logbook entries for easy viewing and email formatting';



CREATE TABLE IF NOT EXISTS "public"."daily_sales_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "text" NOT NULL,
    "date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "total_sales" numeric(10,2) DEFAULT 0,
    "cash_sales" numeric(10,2) DEFAULT 0,
    "credit_card_sales" numeric(10,2) DEFAULT 0,
    "cash_deposit" numeric(10,2) DEFAULT 0,
    "cash_variance" numeric(10,2) GENERATED ALWAYS AS (("cash_sales" - "cash_deposit")) STORED,
    "cc_bay1" numeric(10,2) DEFAULT 0,
    "cc_bay2" numeric(10,2) DEFAULT 0,
    "cc_bay3" numeric(10,2) DEFAULT 0,
    "cc_total_bay_deposits" numeric(10,2) GENERATED ALWAYS AS ((("cc_bay1" + "cc_bay2") + "cc_bay3")) STORED,
    "cc_variance" numeric(10,2) GENERATED ALWAYS AS (("credit_card_sales" - (("cc_bay1" + "cc_bay2") + "cc_bay3"))) STORED,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "net_sales" numeric(10,2) DEFAULT 0,
    "donations" numeric(10,2) DEFAULT 0,
    "sales_tax" numeric(10,2) DEFAULT 0,
    "amount_to_account_for" numeric(10,2) DEFAULT 0,
    "oil_changes" integer DEFAULT 0,
    "date_deposited" "date",
    "bank_deposit_amount" numeric(10,2) DEFAULT 0,
    "fleet_sales" numeric(10,2) DEFAULT 0,
    "total_cash_deposit" numeric(10,2) DEFAULT 0,
    "total_card_deposits" numeric(10,2) DEFAULT 0,
    "total_accounted_for" numeric(10,2) DEFAULT 0,
    "over_short" numeric(10,2) DEFAULT 0,
    "comments" "text",
    "period_no" integer,
    "week_in_period" integer
);


ALTER TABLE "public"."daily_sales_entries" OWNER TO "postgres";


COMMENT ON TABLE "public"."daily_sales_entries" IS 'Stores daily sales data with automatic variance calculations';



CREATE TABLE IF NOT EXISTS "public"."daily_summary_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "text" NOT NULL,
    "shop_number" "text",
    "report_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "inventory_exports" "jsonb",
    "labor_breakdown" "jsonb",
    "cadence_compliance" "jsonb",
    "crew_challenges" "jsonb",
    "repairs_maintenance" "jsonb",
    "claims_submitted" "jsonb",
    "generated_at" timestamp with time zone DEFAULT "now"(),
    "sent_to_email" "text",
    "sent_to_dm" "text",
    "status" "text" DEFAULT 'pending'::"text",
    "sent_at" timestamp with time zone,
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "daily_summary_reports_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'sent'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."daily_summary_reports" OWNER TO "postgres";


COMMENT ON TABLE "public"."daily_summary_reports" IS 'Stores daily summary reports with all aggregated data';



CREATE TABLE IF NOT EXISTS "public"."daily_workbook_monthly_totals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "text" NOT NULL,
    "shop_number" "text",
    "month_start_date" "date" NOT NULL,
    "period_no" integer,
    "quarter" integer,
    "total_oil_changes" integer DEFAULT 0,
    "total_cash_sales" numeric DEFAULT 0,
    "total_net_sales" numeric DEFAULT 0,
    "total_donations" numeric DEFAULT 0,
    "total_sales_tax" numeric DEFAULT 0,
    "total_fleet_sales" numeric DEFAULT 0,
    "total_labor_hours" numeric DEFAULT 0,
    "week1_oil_changes" integer DEFAULT 0,
    "week2_oil_changes" integer DEFAULT 0,
    "week3_oil_changes" integer DEFAULT 0,
    "week4_oil_changes" integer DEFAULT 0,
    "week5_oil_changes" integer DEFAULT 0,
    "week1_cash_sales" numeric DEFAULT 0,
    "week2_cash_sales" numeric DEFAULT 0,
    "week3_cash_sales" numeric DEFAULT 0,
    "week4_cash_sales" numeric DEFAULT 0,
    "week5_cash_sales" numeric DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."daily_workbook_monthly_totals" OWNER TO "postgres";


COMMENT ON TABLE "public"."daily_workbook_monthly_totals" IS 'Stores running monthly totals for Daily Workbook with weekly breakdowns';



CREATE TABLE IF NOT EXISTS "public"."districts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "region_name" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."districts" OWNER TO "postgres";


COMMENT ON TABLE "public"."districts" IS 'Lookup table for districts with region association';



CREATE TABLE IF NOT EXISTS "public"."dm_logbook" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "text" NOT NULL,
    "shop_number" "text",
    "log_type" "text" NOT NULL,
    "log_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "submitted_by" "text",
    "form_data" "jsonb" DEFAULT '{}'::"jsonb",
    "scoring_percentage" numeric DEFAULT 0,
    "notes" "text",
    "immediate_fixes_required" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "dm_logbook_log_type_check" CHECK (("log_type" = ANY (ARRAY['dm_cadence'::"text", 'dm_visit'::"text"])))
);


ALTER TABLE "public"."dm_logbook" OWNER TO "postgres";


COMMENT ON TABLE "public"."dm_logbook" IS 'Stores DM Cadence and DM Visit form submissions with scoring and notes';



CREATE TABLE IF NOT EXISTS "public"."dm_schedule" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "dm_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "location_id" "text",
    "location_text" "text",
    "visit_type" "text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    CONSTRAINT "dm_schedule_visit_type_check" CHECK (("visit_type" = ANY (ARRAY['Training Visit'::"text", 'One-on-One'::"text", 'Administration'::"text", 'Administration – Project Day'::"text", 'Discussion Visit'::"text", 'In-Person'::"text", 'Teams Meeting'::"text"])))
);


ALTER TABLE "public"."dm_schedule" OWNER TO "postgres";


COMMENT ON TABLE "public"."dm_schedule" IS 'Stores DM schedule entries with location and visit type';



COMMENT ON COLUMN "public"."dm_schedule"."location_id" IS 'Shop ID from shop_alignment, or NULL if Home Office';



COMMENT ON COLUMN "public"."dm_schedule"."location_text" IS 'Display text for location (shop name or "Home Office")';



COMMENT ON COLUMN "public"."dm_schedule"."visit_type" IS 'Type of visit: Training Visit, One-on-One, Administration, Administration – Project Day, Discussion Visit, In-Person, Teams Meeting';



CREATE TABLE IF NOT EXISTS "public"."employee_challenge_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "text" NOT NULL,
    "staff_id" "uuid",
    "challenge_log_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."employee_challenge_logs" OWNER TO "postgres";


COMMENT ON TABLE "public"."employee_challenge_logs" IS 'Links challenge logs to specific employees for training tracking';



CREATE TABLE IF NOT EXISTS "public"."employee_challenges" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "text" NOT NULL,
    "date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "employee_name" "text" NOT NULL,
    "evaluator" "text",
    "greeting_customer_greeted" boolean DEFAULT false,
    "greeting_vehicle_staged" boolean DEFAULT false,
    "greeting_full_service_called" boolean DEFAULT false,
    "greeting_score" integer DEFAULT 0,
    "guiding_tech_echoes" boolean DEFAULT false,
    "guiding_vehicle_position" boolean DEFAULT false,
    "guiding_vehicle_stopped" boolean DEFAULT false,
    "guiding_score" integer DEFAULT 0,
    "sw_asked_personal_company" boolean DEFAULT false,
    "sw_ask_permission" boolean DEFAULT false,
    "sw_called_out_tire" boolean DEFAULT false,
    "sw_address_customer" boolean DEFAULT false,
    "sw_enters_each_item" boolean DEFAULT false,
    "sw_score" integer DEFAULT 0,
    "oil_reviewed_options" boolean DEFAULT false,
    "oil_retrieved_filter" boolean DEFAULT false,
    "oil_circled_on_side" boolean DEFAULT false,
    "oil_placed_filter" boolean DEFAULT false,
    "oil_mentioned_charges" boolean DEFAULT false,
    "oil_called_full_service" boolean DEFAULT false,
    "oil_score" integer DEFAULT 0,
    "review_retrieves_pit_hood" boolean DEFAULT false,
    "review_perform_service_review" boolean DEFAULT false,
    "review_discussed_coolant" boolean DEFAULT false,
    "review_during_safety" boolean DEFAULT false,
    "review_fluids_list" boolean DEFAULT false,
    "review_all_services" boolean DEFAULT false,
    "review_correct_payment" boolean DEFAULT false,
    "review_asked_donation" boolean DEFAULT false,
    "review_cashes_out" boolean DEFAULT false,
    "review_reset_oil" boolean DEFAULT false,
    "review_calls_grey_shirt" boolean DEFAULT false,
    "review_verifies_skid" boolean DEFAULT false,
    "review_score" integer DEFAULT 0,
    "hood_started_washer" boolean DEFAULT false,
    "hood_echoes_callouts" boolean DEFAULT false,
    "hood_air_filter_removed" boolean DEFAULT false,
    "hood_waited_plug_tight" boolean DEFAULT false,
    "hood_oil_buckets_never" boolean DEFAULT false,
    "hood_called_out_oil" boolean DEFAULT false,
    "hood_put_oil_car" boolean DEFAULT false,
    "hood_after_filling" boolean DEFAULT false,
    "hood_all_items_relayed" boolean DEFAULT false,
    "hood_installed_cabin" boolean DEFAULT false,
    "hood_score" integer DEFAULT 0,
    "safety_lower_tech_someone" boolean DEFAULT false,
    "safety_enters_pit" boolean DEFAULT false,
    "safety_called_oil_cap" boolean DEFAULT false,
    "safety_old_filter_gasket" boolean DEFAULT false,
    "safety_wrench_plug" boolean DEFAULT false,
    "safety_returned_wrench" boolean DEFAULT false,
    "safety_hands_free" boolean DEFAULT false,
    "safety_verified_no_leaks" boolean DEFAULT false,
    "safety_with_vehicle_off" boolean DEFAULT false,
    "safety_safety_tech_exits" boolean DEFAULT false,
    "safety_check_dipstick" boolean DEFAULT false,
    "safety_checked_transmission" boolean DEFAULT false,
    "safety_rechecked_caps" boolean DEFAULT false,
    "safety_called_all_caps" boolean DEFAULT false,
    "safety_checked_hood" boolean DEFAULT false,
    "safety_score" integer DEFAULT 0,
    "pit_used_shop_prop" boolean DEFAULT false,
    "pit_oil_cap_removed" boolean DEFAULT false,
    "pit_oil_cap_off" boolean DEFAULT false,
    "pit_once_in_pit" boolean DEFAULT false,
    "pit_plug_removed" boolean DEFAULT false,
    "pit_replaced_drain" boolean DEFAULT false,
    "pit_called_plug_tight" boolean DEFAULT false,
    "pit_wrench_left" boolean DEFAULT false,
    "pit_old_filter_placed" boolean DEFAULT false,
    "pit_called_gasket" boolean DEFAULT false,
    "pit_verified_new_filter" boolean DEFAULT false,
    "pit_writes_filter" boolean DEFAULT false,
    "pit_prior_exiting" boolean DEFAULT false,
    "pit_skid_plate_removed" boolean DEFAULT false,
    "pit_score" integer DEFAULT 0,
    "general_kneels_bends" boolean DEFAULT false,
    "general_air_chuck" boolean DEFAULT false,
    "general_front_rear_tires" boolean DEFAULT false,
    "general_front_inflated_psi" integer,
    "general_rear_inflated_psi" integer,
    "general_tire_caps" boolean DEFAULT false,
    "general_rainbow_method" boolean DEFAULT false,
    "general_score" integer DEFAULT 0,
    "cx_juice_boxes" boolean DEFAULT false,
    "cx_friendly_smile" boolean DEFAULT false,
    "cx_attentive_eye" boolean DEFAULT false,
    "cx_honest_truthful" boolean DEFAULT false,
    "cx_team_proper_uniform" boolean DEFAULT false,
    "cx_grey_shirt_completed" boolean DEFAULT false,
    "cx_crew_show" boolean DEFAULT false,
    "cx_bay_time_acceptable" boolean DEFAULT false,
    "cx_bay_time_minutes" integer,
    "cx_score" integer DEFAULT 0,
    "total_score" integer DEFAULT 0,
    "overall_score" integer DEFAULT 0,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "training_shop_walk_through" boolean DEFAULT false,
    "training_shop_walk_through_date" "date",
    "training_team_introductions" boolean DEFAULT false,
    "training_team_introductions_date" "date",
    "training_new_hire_crew_challenge" boolean DEFAULT false,
    "training_new_hire_crew_challenge_date" "date",
    "training_drive_courses_1" boolean DEFAULT false,
    "training_drive_courses_1_date" "date",
    "training_service_tires" boolean DEFAULT false,
    "training_service_tires_date" "date",
    "training_service_windshield" boolean DEFAULT false,
    "training_service_windshield_date" "date",
    "training_serviced_5_tire_check" boolean DEFAULT false,
    "training_serviced_5_tire_check_date" "date",
    "training_serviced_5_windshields" boolean DEFAULT false,
    "training_serviced_5_windshields_date" "date",
    "training_drive_courses_2" boolean DEFAULT false,
    "training_drive_courses_2_date" "date",
    "training_wiper_replacement" boolean DEFAULT false,
    "training_wiper_replacement_date" "date",
    "training_guiding_out_vehicles" boolean DEFAULT false,
    "training_guiding_out_vehicles_date" "date",
    "training_serviced_5_wiper_replacements" boolean DEFAULT false,
    "training_serviced_5_wiper_replacements_date" "date",
    "training_serviced_5_guide_outs" boolean DEFAULT false,
    "training_serviced_5_guide_outs_date" "date",
    "training_drive_courses_3" boolean DEFAULT false,
    "training_drive_courses_3_date" "date",
    "training_fluid_top_off" boolean DEFAULT false,
    "training_fluid_top_off_date" "date",
    "training_oil_retrieval_hm_additive" boolean DEFAULT false,
    "training_oil_retrieval_hm_additive_date" "date",
    "training_hood_comments_to_sw" boolean DEFAULT false,
    "training_hood_comments_to_sw_date" "date",
    "training_demonstrates_callouts_echoes" boolean DEFAULT false,
    "training_demonstrates_callouts_echoes_date" "date",
    "training_service_5_hood_top_offs" boolean DEFAULT false,
    "training_service_5_hood_top_offs_date" "date",
    "training_service_5_guide_ins" boolean DEFAULT false,
    "training_service_5_guide_ins_date" "date",
    "training_service_5_oil_retrieval" boolean DEFAULT false,
    "training_service_5_oil_retrieval_date" "date",
    "training_drive_courses_4" boolean DEFAULT false,
    "training_drive_courses_4_date" "date",
    "training_air_filter_removal" boolean DEFAULT false,
    "training_air_filter_removal_date" "date",
    "training_cabin_air_filter_removal" boolean DEFAULT false,
    "training_cabin_air_filter_removal_date" "date",
    "training_service_5_air_filters" boolean DEFAULT false,
    "training_service_5_air_filters_date" "date",
    "training_service_5_cabin_air_filters" boolean DEFAULT false,
    "training_service_5_cabin_air_filters_date" "date",
    "training_service_5_hydrometer_inspections_1" boolean DEFAULT false,
    "training_service_5_hydrometer_inspections_1_date" "date",
    "training_service_5_hydrometer_inspections_2" boolean DEFAULT false,
    "training_service_5_hydrometer_inspections_2_date" "date"
);


ALTER TABLE "public"."employee_challenges" OWNER TO "postgres";


COMMENT ON COLUMN "public"."employee_challenges"."training_shop_walk_through" IS 'Shop walk through with SM';



COMMENT ON COLUMN "public"."employee_challenges"."training_team_introductions" IS 'Team introductions';



COMMENT ON COLUMN "public"."employee_challenges"."training_new_hire_crew_challenge" IS 'New hire crew challenge the SM';



CREATE TABLE IF NOT EXISTS "public"."employee_coaching" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "workday_employee_id" "text",
    "manager_user_id" "uuid",
    "manager_name" "text" NOT NULL,
    "coaching_for" "text" NOT NULL,
    "other_topic" "text",
    "details" "text",
    "action_plan" "text",
    "follow_up_on" "date",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "employee_coaching_coaching_for_check" CHECK (("coaching_for" = ANY (ARRAY['Attendance'::"text", 'Uniform'::"text", 'Improper Conduct'::"text", 'Other'::"text"])))
);


ALTER TABLE "public"."employee_coaching" OWNER TO "postgres";


COMMENT ON TABLE "public"."employee_coaching" IS 'Stores verbal coaching records for employees';



CREATE TABLE IF NOT EXISTS "public"."employee_development" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "text" NOT NULL,
    "staff_id" "uuid" NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"(),
    "development_checklist" "jsonb" DEFAULT '[]'::"jsonb",
    "notes" "text",
    "status" "text" DEFAULT 'active'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "employee_development_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'completed'::"text", 'on_hold'::"text"])))
);


ALTER TABLE "public"."employee_development" OWNER TO "postgres";


COMMENT ON TABLE "public"."employee_development" IS 'Stores employee development plans and progress tracking';



CREATE TABLE IF NOT EXISTS "public"."employee_goals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "text" NOT NULL,
    "staff_id" "uuid",
    "employee_name" "text" NOT NULL,
    "your_score_goal" numeric DEFAULT 0,
    "nps_goal" numeric DEFAULT 0,
    "employee_performance_surveys_goal" numeric DEFAULT 0,
    "email_pct_goal" numeric DEFAULT 0,
    "pmix_goal" numeric DEFAULT 0,
    "big_4_goal" numeric DEFAULT 0,
    "bay_time_goal" numeric DEFAULT 0,
    "oil_changes_goal" numeric DEFAULT 0,
    "gross_aro_goal" numeric DEFAULT 0,
    "net_aro_goal" numeric DEFAULT 0,
    "discount_per_oil_change_goal" numeric DEFAULT 0,
    "wiper_pct_goal" numeric DEFAULT 0,
    "air_filter_pct_goal" numeric DEFAULT 0,
    "cabin_filter_pct_goal" numeric DEFAULT 0,
    "coolant_pct_goal" numeric DEFAULT 0,
    "donations_goal" numeric DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."employee_goals" OWNER TO "postgres";


COMMENT ON TABLE "public"."employee_goals" IS 'Stores employee KPI goals for performance tracking';



CREATE TABLE IF NOT EXISTS "public"."employee_hours_tracking" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "text" NOT NULL,
    "staff_id" "uuid",
    "staff_name" "text" NOT NULL,
    "date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "daily_hours" numeric DEFAULT 0,
    "week_start_date" "date" NOT NULL,
    "week_to_date_hours" numeric DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."employee_hours_tracking" OWNER TO "postgres";


COMMENT ON TABLE "public"."employee_hours_tracking" IS 'Tracks daily and week-to-date hours for each employee per shop';



CREATE TABLE IF NOT EXISTS "public"."employee_kpis" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "text" NOT NULL,
    "staff_id" "uuid",
    "employee_name" "text" NOT NULL,
    "week_start" "date" NOT NULL,
    "your_score" numeric DEFAULT 0,
    "nps" numeric DEFAULT 0,
    "employee_performance_surveys" numeric DEFAULT 0,
    "email_pct" numeric DEFAULT 0,
    "pmix" numeric DEFAULT 0,
    "big_4" numeric DEFAULT 0,
    "bay_time" numeric DEFAULT 0,
    "oil_changes" numeric DEFAULT 0,
    "gross_aro" numeric DEFAULT 0,
    "net_aro" numeric DEFAULT 0,
    "discount_per_oil_change" numeric DEFAULT 0,
    "wiper_pct" numeric DEFAULT 0,
    "air_filter_pct" numeric DEFAULT 0,
    "cabin_filter_pct" numeric DEFAULT 0,
    "coolant_pct" numeric DEFAULT 0,
    "donations" numeric DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "workday_employee_id" "text",
    "surveys" integer,
    "big4_pct" numeric,
    "store_number" "text",
    "region" "text",
    "district" "text",
    "position_id" "text",
    "employee_id" "uuid"
);


ALTER TABLE "public"."employee_kpis" OWNER TO "postgres";


COMMENT ON TABLE "public"."employee_kpis" IS 'Stores weekly employee KPI actuals for tracking and comparison. Supports Excel import via ingest_epr edge function.';



CREATE TABLE IF NOT EXISTS "public"."employee_logbook" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "workday_employee_id" "text",
    "entry_type" "text" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "employee_logbook_entry_type_check" CHECK (("entry_type" = ANY (ARRAY['verbal_coaching'::"text", 'training'::"text", 'challenge'::"text", 'performance_review'::"text", 'meeting'::"text", 'development'::"text"])))
);


ALTER TABLE "public"."employee_logbook" OWNER TO "postgres";


COMMENT ON TABLE "public"."employee_logbook" IS 'Stores all employee activity logs including coaching, training, challenges, etc.';



CREATE TABLE IF NOT EXISTS "public"."employee_master_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "text" NOT NULL,
    "staff_id" "uuid",
    "employee_name" "text" NOT NULL,
    "log_type" "text" NOT NULL,
    "log_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "log_data" "jsonb" DEFAULT '{}'::"jsonb",
    "score" integer,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "employee_master_logs_log_type_check" CHECK (("log_type" = ANY (ARRAY['coaching'::"text", 'training'::"text", 'challenge'::"text", 'solink'::"text", 'claim'::"text", 'meeting'::"text", 'development'::"text"])))
);


ALTER TABLE "public"."employee_master_logs" OWNER TO "postgres";


COMMENT ON TABLE "public"."employee_master_logs" IS 'Master log aggregating all employee activities including coaching, training, challenges, solinks, claims, meetings, and development';



CREATE TABLE IF NOT EXISTS "public"."employee_meetings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "text" NOT NULL,
    "shop_number" "text",
    "meeting_type" "text" NOT NULL,
    "meeting_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "meeting_time" time without time zone NOT NULL,
    "attendees" "jsonb" DEFAULT '[]'::"jsonb",
    "agenda_text" "text",
    "agenda_image_url" "text",
    "agenda_pdf_url" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "employee_meetings_meeting_type_check" CHECK (("meeting_type" = ANY (ARRAY['shop_manager_lead'::"text", 'newsletter'::"text", 'monthly_planner'::"text", 'general_training'::"text"])))
);


ALTER TABLE "public"."employee_meetings" OWNER TO "postgres";


COMMENT ON TABLE "public"."employee_meetings" IS 'Stores employee meeting records with attendance and agenda information';



CREATE TABLE IF NOT EXISTS "public"."employee_schedules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "text" NOT NULL,
    "staff_id" "uuid" NOT NULL,
    "week_start_date" "date" NOT NULL,
    "position" "text",
    "sunday_in" "text",
    "sunday_out" "text",
    "monday_in" "text",
    "monday_out" "text",
    "tuesday_in" "text",
    "tuesday_out" "text",
    "wednesday_in" "text",
    "wednesday_out" "text",
    "thursday_in" "text",
    "thursday_out" "text",
    "friday_in" "text",
    "friday_out" "text",
    "saturday_in" "text",
    "saturday_out" "text",
    "total_hours" numeric DEFAULT 0,
    "overtime_hours" numeric DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."employee_schedules" OWNER TO "postgres";


COMMENT ON TABLE "public"."employee_schedules" IS 'Stores weekly employee schedules with time in/out and overtime calculation';



CREATE TABLE IF NOT EXISTS "public"."employee_service_certifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "text" NOT NULL,
    "staff_id" "uuid" NOT NULL,
    "service_type" "text" NOT NULL,
    "is_certified" boolean DEFAULT false,
    "certified_at" timestamp with time zone,
    "certified_by" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "employee_service_certifications_service_type_check" CHECK (("service_type" = ANY (ARRAY['opening_shop'::"text", 'closing_shop'::"text", 'coolants'::"text", 'differentials'::"text", 'fuel_filters'::"text"])))
);


ALTER TABLE "public"."employee_service_certifications" OWNER TO "postgres";


COMMENT ON TABLE "public"."employee_service_certifications" IS 'Stores employee certifications for specific services';



COMMENT ON COLUMN "public"."employee_service_certifications"."service_type" IS 'Type of service: opening_shop, closing_shop, coolants, differentials, fuel_filters';



CREATE TABLE IF NOT EXISTS "public"."employee_shifts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "text" NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "label" "text" DEFAULT '9:00am – 5:00pm'::"text" NOT NULL,
    "kind" "text" DEFAULT 'shift'::"text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "start_time" "text",
    "end_time" "text",
    "break_minutes" integer DEFAULT 0,
    CONSTRAINT "employee_shifts_kind_check" CHECK (("kind" = ANY (ARRAY['shift'::"text", 'time_off'::"text", 'holiday'::"text"])))
);


ALTER TABLE "public"."employee_shifts" OWNER TO "postgres";


COMMENT ON TABLE "public"."employee_shifts" IS 'Stores employee shifts with time in/out and break information for the simple week-view scheduler';



CREATE TABLE IF NOT EXISTS "public"."employee_training" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "text" NOT NULL,
    "staff_id" "uuid" NOT NULL,
    "training_status" "text" DEFAULT 'in_progress'::"text",
    "training_notes" "text",
    "training_checklist" "jsonb" DEFAULT '[]'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "employee_training_training_status_check" CHECK (("training_status" = ANY (ARRAY['not_started'::"text", 'in_progress'::"text", 'completed'::"text"])))
);


ALTER TABLE "public"."employee_training" OWNER TO "postgres";


COMMENT ON TABLE "public"."employee_training" IS 'Stores employee training records and checklists';



CREATE TABLE IF NOT EXISTS "public"."employees" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "text" NOT NULL,
    "first_name" "text",
    "last_name" "text",
    "phone" "text",
    "hire_date" "date",
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."employees" OWNER TO "postgres";


COMMENT ON TABLE "public"."employees" IS 'Stores employee information with phone update capability';



CREATE TABLE IF NOT EXISTS "public"."equipment_check_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "text" NOT NULL,
    "shop_number" "text",
    "date" "date" DEFAULT CURRENT_DATE,
    "submitted_by" "text",
    "check_data" "jsonb",
    "status" "text" DEFAULT 'completed'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "equipment_check_logs_status_check" CHECK (("status" = ANY (ARRAY['completed'::"text", 'pending'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."equipment_check_logs" OWNER TO "postgres";


COMMENT ON TABLE "public"."equipment_check_logs" IS 'Stores completed equipment check logs with dynamic data based on selected checklist items';



CREATE TABLE IF NOT EXISTS "public"."equipment_check_selections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "text" NOT NULL,
    "checklist_item_id" "uuid" NOT NULL,
    "is_selected" boolean DEFAULT true,
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."equipment_check_selections" OWNER TO "postgres";


COMMENT ON TABLE "public"."equipment_check_selections" IS 'Stores which master checklist items are selected for equipment checks per shop';



CREATE TABLE IF NOT EXISTS "public"."export_snapshots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "snapshot_data" "jsonb" NOT NULL,
    "export_date" timestamp with time zone DEFAULT "now"(),
    "item_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."export_snapshots" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."fleet_accounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "text" NOT NULL,
    "invoice_id" "uuid",
    "fleet_account_name" "text" NOT NULL,
    "po_authorization_number" "text",
    "driver_name" "text",
    "vin_number" "text",
    "license_plate" "text",
    "vehicle_unit_number" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."fleet_accounts" OWNER TO "postgres";


COMMENT ON TABLE "public"."fleet_accounts" IS 'Stores fleet account information for commercial customers';



CREATE TABLE IF NOT EXISTS "public"."game_decks" (
    "id" "text" NOT NULL,
    "deck_json" "jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."game_decks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."game_leaderboard" (
    "shop_id" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "best_score" numeric DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."game_leaderboard" OWNER TO "postgres";


COMMENT ON TABLE "public"."game_leaderboard" IS 'Stores best scores per shop and user for leaderboards';



CREATE TABLE IF NOT EXISTS "public"."game_results" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "deck_id" "text" NOT NULL,
    "players" "text"[] NOT NULL,
    "scores" "jsonb" NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "finished_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."game_results" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."game_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "shop_id" "text" NOT NULL,
    "mode" "text" NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ended_at" timestamp with time zone,
    "score" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "game_runs_mode_check" CHECK (("mode" = ANY (ARRAY['automation'::"text", 'arcade'::"text"])))
);


ALTER TABLE "public"."game_runs" OWNER TO "postgres";


COMMENT ON TABLE "public"."game_runs" IS 'Stores SPEED game session results with KPIs and parameters';



CREATE TABLE IF NOT EXISTS "public"."import_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "action" "text" NOT NULL,
    "total_items" integer DEFAULT 0,
    "timestamp" timestamp with time zone DEFAULT "now"(),
    "shop_id" "text"
);


ALTER TABLE "public"."import_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory_categories" (
    "code" "text" NOT NULL,
    "label" "text" NOT NULL
);


ALTER TABLE "public"."inventory_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory_counts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "text" NOT NULL,
    "category" "text" NOT NULL,
    "item_id" "uuid" NOT NULL,
    "floor_count" integer DEFAULT 0,
    "storage_count" integer DEFAULT 0,
    "count_date" "date" DEFAULT CURRENT_DATE,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "last_changed_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "inventory_counts_floor_count_check" CHECK (("floor_count" >= 0)),
    CONSTRAINT "inventory_counts_storage_count_check" CHECK (("storage_count" >= 0))
);


ALTER TABLE "public"."inventory_counts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory_counts_v2" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "text" NOT NULL,
    "item_number" "text" NOT NULL,
    "category" "text" NOT NULL,
    "floor_count" integer DEFAULT 0,
    "storage_count" integer DEFAULT 0,
    "count_date" "date" DEFAULT CURRENT_DATE,
    "last_changed_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "inventory_counts_v2_floor_count_check" CHECK (("floor_count" >= 0)),
    CONSTRAINT "inventory_counts_v2_storage_count_check" CHECK (("storage_count" >= 0))
);


ALTER TABLE "public"."inventory_counts_v2" OWNER TO "postgres";


COMMENT ON TABLE "public"."inventory_counts_v2" IS 'Daily inventory counts with floor and storage tracking';



CREATE TABLE IF NOT EXISTS "public"."inventory_export_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "text" NOT NULL,
    "category" "text",
    "export_type" "text",
    "item_count" integer DEFAULT 0,
    "exported_by" "text",
    "exported_at" timestamp with time zone DEFAULT "now"(),
    "file_name" "text",
    "notes" "text",
    CONSTRAINT "inventory_export_history_export_type_check" CHECK (("export_type" = ANY (ARRAY['full'::"text", 'modified_only'::"text", 'all_categories'::"text"])))
);


ALTER TABLE "public"."inventory_export_history" OWNER TO "postgres";


COMMENT ON TABLE "public"."inventory_export_history" IS 'History of inventory exports for audit trail';



CREATE TABLE IF NOT EXISTS "public"."inventory_export_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "text" NOT NULL,
    "shop_number" "text",
    "exported_by" "text",
    "exported_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "category_id" "uuid",
    "category_name" "text",
    "item_count" integer DEFAULT 0,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."inventory_export_logs" OWNER TO "postgres";


COMMENT ON TABLE "public"."inventory_export_logs" IS 'Tracks inventory export activities per shop and category';



CREATE TABLE IF NOT EXISTS "public"."inventory_items" (
    "id" bigint NOT NULL,
    "itemnumber" "text" NOT NULL,
    "productnumber" "text" NOT NULL,
    "category" "text" NOT NULL,
    "floorcount" integer DEFAULT 0 NOT NULL,
    "storagecount" integer DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."inventory_items" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."inventory_items_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."inventory_items_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."inventory_items_id_seq" OWNED BY "public"."inventory_items"."id";



CREATE TABLE IF NOT EXISTS "public"."inventory_staging" (
    "id" bigint NOT NULL,
    "shop_id" "text",
    "raw" "jsonb" NOT NULL,
    "imported_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."inventory_staging" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."inventory_staging_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."inventory_staging_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."inventory_staging_id_seq" OWNED BY "public"."inventory_staging"."id";



CREATE TABLE IF NOT EXISTS "public"."invoice_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "invoice_id" "uuid",
    "button_id" "uuid",
    "item_name" "text" NOT NULL,
    "quantity" numeric DEFAULT 1,
    "unit_price" numeric NOT NULL,
    "line_total" numeric GENERATED ALWAYS AS (("quantity" * "unit_price")) STORED,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."invoice_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invoices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "text" NOT NULL,
    "invoice_number" "text",
    "customer_name" "text",
    "customer_phone" "text",
    "vehicle_info" "jsonb" DEFAULT '{}'::"jsonb",
    "subtotal" numeric DEFAULT 0,
    "tax" numeric DEFAULT 0,
    "total" numeric DEFAULT 0,
    "payment_method" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "code" "text",
    "status" "text" DEFAULT 'draft'::"text",
    "submitted_at" timestamp with time zone,
    CONSTRAINT "invoices_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'submitted'::"text"])))
);


ALTER TABLE "public"."invoices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."item_numbers" (
    "id" "text" NOT NULL,
    "item_number" "text" NOT NULL,
    "product_name" "text",
    "floor_count" integer DEFAULT 0,
    "storage_count" integer DEFAULT 0,
    "total_count" integer GENERATED ALWAYS AS (("floor_count" + "storage_count")) STORED,
    "category" "text" NOT NULL,
    "last_updated_by" "text" DEFAULT 'system'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."item_numbers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."kpi_daily" (
    "shop_id" "text" NOT NULL,
    "date_key" "date" NOT NULL,
    "cars" numeric,
    "sales" numeric,
    "aro" numeric,
    "ticket" numeric,
    "big4_pct" numeric,
    "coolant_pct" numeric,
    "diff_pct" numeric,
    "mobil1_pct" numeric,
    "labor_pct" numeric,
    "exits" numeric,
    "wipers_ct" numeric,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."kpi_daily" OWNER TO "postgres";


COMMENT ON TABLE "public"."kpi_daily" IS 'Stores normalized daily KPI metrics (numbers only)';



CREATE TABLE IF NOT EXISTS "public"."kpi_goals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "text" NOT NULL,
    "scope" "text" NOT NULL,
    "date_key" "date",
    "period_id" "text",
    "cars_target" numeric,
    "sales_target" numeric,
    "aro_target" numeric,
    "ticket_target" numeric,
    "big4_target" numeric,
    "coolant_target" numeric,
    "diff_target" numeric,
    "mobil1_target" numeric,
    "labor_target" numeric,
    "exits_target" numeric,
    "wipers_target" numeric,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "kpi_goals_scope_check" CHECK (("scope" = ANY (ARRAY['day'::"text", 'period'::"text"])))
);


ALTER TABLE "public"."kpi_goals" OWNER TO "postgres";


COMMENT ON TABLE "public"."kpi_goals" IS 'Stores KPI goals/targets (can be daily or period-based)';



CREATE TABLE IF NOT EXISTS "public"."kpi_imports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "shop_id" "text" NOT NULL,
    "file_name" "text" NOT NULL,
    "period_id" "text",
    "imported_at" timestamp with time zone DEFAULT "now"(),
    "status" "text" DEFAULT 'ok'::"text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."kpi_imports" OWNER TO "postgres";


COMMENT ON TABLE "public"."kpi_imports" IS 'Stores metadata about KPI data imports from XLSX/CSV files';



CREATE TABLE IF NOT EXISTS "public"."kpi_projections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "text" NOT NULL,
    "period_no" integer,
    "week_in_period" integer,
    "budget_cars_sunday" integer DEFAULT 0,
    "budget_cars_monday" integer DEFAULT 0,
    "budget_cars_tuesday" integer DEFAULT 0,
    "budget_cars_wednesday" integer DEFAULT 0,
    "budget_cars_thursday" integer DEFAULT 0,
    "budget_cars_friday" integer DEFAULT 0,
    "budget_cars_saturday" integer DEFAULT 0,
    "budget_sales_sunday" numeric DEFAULT 0,
    "budget_sales_monday" numeric DEFAULT 0,
    "budget_sales_tuesday" numeric DEFAULT 0,
    "budget_sales_wednesday" numeric DEFAULT 0,
    "budget_sales_thursday" numeric DEFAULT 0,
    "budget_sales_friday" numeric DEFAULT 0,
    "budget_sales_saturday" numeric DEFAULT 0,
    "comp_cars_sunday" integer DEFAULT 0,
    "comp_cars_monday" integer DEFAULT 0,
    "comp_cars_tuesday" integer DEFAULT 0,
    "comp_cars_wednesday" integer DEFAULT 0,
    "comp_cars_thursday" integer DEFAULT 0,
    "comp_cars_friday" integer DEFAULT 0,
    "comp_cars_saturday" integer DEFAULT 0,
    "comp_sales_sunday" numeric DEFAULT 0,
    "comp_sales_monday" numeric DEFAULT 0,
    "comp_sales_tuesday" numeric DEFAULT 0,
    "comp_sales_wednesday" numeric DEFAULT 0,
    "comp_sales_thursday" numeric DEFAULT 0,
    "comp_sales_friday" numeric DEFAULT 0,
    "comp_sales_saturday" numeric DEFAULT 0,
    "aro_goal" numeric DEFAULT 0,
    "discounts_goal" numeric DEFAULT 0,
    "pmix_goal" numeric DEFAULT 0,
    "big4_goal" numeric DEFAULT 0,
    "air_filters_goal" numeric DEFAULT 0,
    "wipers_goal" numeric DEFAULT 0,
    "cabins_goal" numeric DEFAULT 0,
    "coolants_goal" numeric DEFAULT 0,
    "diffs_goal" numeric DEFAULT 0,
    "fuel_filters_goal" numeric DEFAULT 0,
    "labor_goal" numeric DEFAULT 0,
    "nps_goal" numeric DEFAULT 0,
    "email_goal" numeric DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."kpi_projections" OWNER TO "postgres";


COMMENT ON TABLE "public"."kpi_projections" IS 'Stores KPI projections with daily breakdowns for budget/comp cars and sales, plus goals for various metrics';



CREATE TABLE IF NOT EXISTS "public"."labor_staff_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "text" NOT NULL,
    "date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "staff_name" "text" NOT NULL,
    "start_time" timestamp with time zone NOT NULL,
    "end_time" timestamp with time zone,
    "hours_worked" numeric DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "break_minutes" integer DEFAULT 0
);


ALTER TABLE "public"."labor_staff_entries" OWNER TO "postgres";


COMMENT ON TABLE "public"."labor_staff_entries" IS 'Stores individual staff labor entries with automatic hour calculation';



COMMENT ON COLUMN "public"."labor_staff_entries"."hours_worked" IS 'Calculated hours from start_time to end_time (or current time if end_time is null)';



COMMENT ON COLUMN "public"."labor_staff_entries"."break_minutes" IS 'Break duration in minutes (0, 30, or 60)';



CREATE TABLE IF NOT EXISTS "public"."labor_tracking" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "text" NOT NULL,
    "date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "total_cars" integer DEFAULT 0 NOT NULL,
    "allowed_hours" numeric(10,2) GENERATED ALWAYS AS ((("total_cars")::numeric * 0.79)) STORED,
    "current_hours" numeric(10,2) DEFAULT 0,
    "variance" numeric(10,2) GENERATED ALWAYS AS (("current_hours" - (("total_cars")::numeric * 0.79))) STORED,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."labor_tracking" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."manager_challenges" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "text" NOT NULL,
    "shop_number" "text" NOT NULL,
    "date" "date" NOT NULL,
    "mod_name" "text" NOT NULL,
    "evaluator" "text" NOT NULL,
    "kpi_board_reflects" boolean DEFAULT false,
    "all_employees_know" boolean DEFAULT false,
    "entire_team_in_uniform" boolean DEFAULT false,
    "has_cash_key" boolean DEFAULT false,
    "knows_communicate" boolean DEFAULT false,
    "properly_called_greet" boolean DEFAULT false,
    "only_assumes_proper" boolean DEFAULT false,
    "actively_coaches" boolean DEFAULT false,
    "ensures_service_review" boolean DEFAULT false,
    "verifies_all_service" boolean DEFAULT false,
    "all_audibles_only" boolean DEFAULT false,
    "ensures_priority" boolean DEFAULT false,
    "all_drain_plugs" boolean DEFAULT false,
    "ensures_crew_resetting" boolean DEFAULT false,
    "celebrates_wins" boolean DEFAULT false,
    "fosters_show" boolean DEFAULT false,
    "grey_shirt_goodbyes" boolean DEFAULT false,
    "total_score" integer DEFAULT 0 NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."manager_challenges" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."master-inventory-list" (
    "productnumber" "text",
    "itemNumber" "text" NOT NULL,
    "floorcount" integer,
    "storagecount" integer,
    "category" "text"
);


ALTER TABLE "public"."master-inventory-list" OWNER TO "postgres";


COMMENT ON TABLE "public"."master-inventory-list" IS 'Legacy master inventory list with RLS enabled (Security Audit Fix - Jan 2025)';



CREATE TABLE IF NOT EXISTS "public"."master-inventory-list 10.25.25" (
    "productnumber" "text",
    "itemNumber" "text" NOT NULL,
    "floorcount" integer,
    "storagecount" integer,
    "category" "text"
);


ALTER TABLE "public"."master-inventory-list 10.25.25" OWNER TO "postgres";


COMMENT ON TABLE "public"."master-inventory-list 10.25.25" IS 'Legacy master inventory list with RLS enabled (Security Audit Fix - Jan 2025)';



CREATE TABLE IF NOT EXISTS "public"."master_checklist_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "text" NOT NULL,
    "title" "text" NOT NULL,
    "field_type" "text" NOT NULL,
    "is_required" boolean DEFAULT false,
    "days_of_week" "text"[] DEFAULT ARRAY['monday'::"text", 'tuesday'::"text", 'wednesday'::"text", 'thursday'::"text", 'friday'::"text", 'saturday'::"text", 'sunday'::"text"],
    "sort_order" integer DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "master_checklist_items_field_type_check" CHECK (("field_type" = ANY (ARRAY['boolean'::"text", 'number'::"text", 'text'::"text", 'textarea'::"text"])))
);


ALTER TABLE "public"."master_checklist_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."master_checklist_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "text" NOT NULL,
    "date" "date" DEFAULT CURRENT_DATE,
    "submitted_by" "text" NOT NULL,
    "dm_email" "text",
    "report_data" "jsonb",
    "status" "text" DEFAULT 'pending'::"text",
    "sent_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "master_checklist_reports_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'sent'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."master_checklist_reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."master_checklist_responses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "text" NOT NULL,
    "date" "date" DEFAULT CURRENT_DATE,
    "checklist_item_id" "uuid",
    "response_value" "text",
    "submitted_by" "text",
    "submitted_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."master_checklist_responses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."master_inventory_list" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sku" "text" NOT NULL,
    "name" "text" NOT NULL,
    "category" "text",
    "upc" "text",
    "cost_cents" integer,
    "price_cents" integer,
    "uom" "text",
    "active" boolean DEFAULT true,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."master_inventory_list" OWNER TO "postgres";


COMMENT ON TABLE "public"."master_inventory_list" IS 'Corporate master inventory list - source of truth for all products';



CREATE TABLE IF NOT EXISTS "public"."master_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sku" "text",
    "item_name" "text" NOT NULL,
    "brand" "text",
    "oil_grade" "text",
    "type" "text",
    "price" numeric,
    "category_code" "text",
    "meta" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."master_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."master_products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "category" "text" NOT NULL,
    "item_number" "text" NOT NULL,
    "product_number" "text",
    "name" "text" NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."master_products" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."micro_challenges" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "text" NOT NULL,
    "date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "employee_name" "text" NOT NULL,
    "evaluator" "text",
    "challenge_type" "text" NOT NULL,
    "greeting_customer_greeted" boolean DEFAULT false,
    "greeting_vehicle_staged" boolean DEFAULT false,
    "greeting_called_full_service" boolean DEFAULT false,
    "guiding_advised_customer" boolean DEFAULT false,
    "guiding_guide_in_tech" boolean DEFAULT false,
    "guiding_vehicle_position" boolean DEFAULT false,
    "guiding_verbally_says_stop" boolean DEFAULT false,
    "sw_asked_personal_company" boolean DEFAULT false,
    "sw_ask_permission" boolean DEFAULT false,
    "sw_called_tire_pressure" boolean DEFAULT false,
    "sw_address_customer" boolean DEFAULT false,
    "sw_enters_each_item" boolean DEFAULT false,
    "sw_full_name" boolean DEFAULT false,
    "sw_address" boolean DEFAULT false,
    "sw_verify_mailing" boolean DEFAULT false,
    "sw_phone_number" boolean DEFAULT false,
    "sw_email_address" boolean DEFAULT false,
    "sw_vehicle_mileage" boolean DEFAULT false,
    "sw_reviewed_options" boolean DEFAULT false,
    "sw_retrieved_filter" boolean DEFAULT false,
    "sw_circled_filter" boolean DEFAULT false,
    "sw_placed_filter" boolean DEFAULT false,
    "sw_mentioned_charges" boolean DEFAULT false,
    "sw_called_full_service" boolean DEFAULT false,
    "sw_retrieved_wiper" boolean DEFAULT false,
    "sw_examined_wiper" boolean DEFAULT false,
    "sw_checked_windshield" boolean DEFAULT false,
    "sw_asked_cabin_filter" boolean DEFAULT false,
    "sw_seri_wiper" boolean DEFAULT false,
    "sw_retrieves_pit_hood" boolean DEFAULT false,
    "sw_perform_service_review" boolean DEFAULT false,
    "sw_discussed_coolant" boolean DEFAULT false,
    "sw_during_safety" boolean DEFAULT false,
    "sw_fluids_list" boolean DEFAULT false,
    "sw_all_services" boolean DEFAULT false,
    "sw_correct_payment" boolean DEFAULT false,
    "sw_asked_donation" boolean DEFAULT false,
    "sw_cashes_out" boolean DEFAULT false,
    "sw_reset_oil" boolean DEFAULT false,
    "sw_calls_grey_shirt" boolean DEFAULT false,
    "sw_verifies_skid" boolean DEFAULT false,
    "hood_started_washer" boolean DEFAULT false,
    "hood_echoes_callouts" boolean DEFAULT false,
    "hood_air_filter_removed" boolean DEFAULT false,
    "hood_waited_plug_tight" boolean DEFAULT false,
    "hood_oil_buckets_never" boolean DEFAULT false,
    "hood_called_out_oil" boolean DEFAULT false,
    "hood_put_oil_car" boolean DEFAULT false,
    "hood_after_filling" boolean DEFAULT false,
    "hood_all_items_relayed" boolean DEFAULT false,
    "hood_installed_cabin" boolean DEFAULT false,
    "safety_lower_tech_someone" boolean DEFAULT false,
    "safety_enters_pit" boolean DEFAULT false,
    "safety_called_oil_cap" boolean DEFAULT false,
    "safety_old_filter_gasket" boolean DEFAULT false,
    "safety_wrench_plug" boolean DEFAULT false,
    "safety_returned_wrench" boolean DEFAULT false,
    "safety_hands_free" boolean DEFAULT false,
    "safety_verified_no_leaks" boolean DEFAULT false,
    "safety_with_vehicle_off" boolean DEFAULT false,
    "safety_safety_tech_exits" boolean DEFAULT false,
    "safety_check_dipstick" boolean DEFAULT false,
    "safety_checked_transmission" boolean DEFAULT false,
    "safety_rechecked_oil" boolean DEFAULT false,
    "safety_rechecked_caps" boolean DEFAULT false,
    "safety_called_all_caps" boolean DEFAULT false,
    "safety_checked_hood" boolean DEFAULT false,
    "pit_used_shop_prop" boolean DEFAULT false,
    "pit_oil_cap_removed" boolean DEFAULT false,
    "pit_oil_cap_off" boolean DEFAULT false,
    "pit_once_in_pit" boolean DEFAULT false,
    "pit_plug_removed" boolean DEFAULT false,
    "pit_replaced_drain" boolean DEFAULT false,
    "pit_called_plug_tight" boolean DEFAULT false,
    "pit_wrench_left" boolean DEFAULT false,
    "pit_old_filter_placed" boolean DEFAULT false,
    "pit_called_gasket" boolean DEFAULT false,
    "pit_verified_new_filter" boolean DEFAULT false,
    "pit_writes_filter" boolean DEFAULT false,
    "pit_prior_exiting" boolean DEFAULT false,
    "pit_skid_plate_removed" boolean DEFAULT false,
    "general_kneels_bends" boolean DEFAULT false,
    "general_air_chuck" boolean DEFAULT false,
    "general_front_rear_tires" boolean DEFAULT false,
    "general_front_inflated_psi" integer,
    "general_rear_inflated_psi" integer,
    "general_tire_caps" boolean DEFAULT false,
    "general_rainbow_method" boolean DEFAULT false,
    "cx_juice_boxes" boolean DEFAULT false,
    "cx_friendly_smile" boolean DEFAULT false,
    "cx_attentive_eye" boolean DEFAULT false,
    "cx_honest_truthful" boolean DEFAULT false,
    "cx_team_proper_uniform" boolean DEFAULT false,
    "cx_grey_shirt_completed" boolean DEFAULT false,
    "cx_crew_show" boolean DEFAULT false,
    "cx_bay_time_acceptable" boolean DEFAULT false,
    "cx_bay_time_minutes" integer,
    "total_score" integer DEFAULT 0,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "micro_challenges_challenge_type_check" CHECK (("challenge_type" = ANY (ARRAY['greeting'::"text", 'service_writer'::"text", 'hood_tech'::"text", 'safety_check'::"text", 'pit_tech'::"text"])))
);


ALTER TABLE "public"."micro_challenges" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mod_challenges" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "text" NOT NULL,
    "date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "mod_name" "text" NOT NULL,
    "evaluator" "text",
    "kpi_board_reflects" boolean DEFAULT false,
    "all_employees_know" boolean DEFAULT false,
    "entire_team_clean" boolean DEFAULT false,
    "has_cash_key" boolean DEFAULT false,
    "knows_communicate" boolean DEFAULT false,
    "properly_called_greet" boolean DEFAULT false,
    "only_assumes_proper" boolean DEFAULT false,
    "actively_coaches" boolean DEFAULT false,
    "ensures_service_review" boolean DEFAULT false,
    "verifies_service_comments" boolean DEFAULT false,
    "all_audibles_only" boolean DEFAULT false,
    "ensures_priority_position" boolean DEFAULT false,
    "all_subaru_drain" boolean DEFAULT false,
    "ensures_resetting" boolean DEFAULT false,
    "celebrates_wins" boolean DEFAULT false,
    "fosters_show" boolean DEFAULT false,
    "grey_shirt_goodbyes" boolean DEFAULT false,
    "total_score" integer DEFAULT 0,
    "overall_score" integer DEFAULT 0,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."mod_challenges" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."opening_closing_checklists" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "text" NOT NULL,
    "date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "checklist_type" "text" NOT NULL,
    "item_name" "text" NOT NULL,
    "completed" boolean DEFAULT false,
    "completed_at" timestamp with time zone,
    "sort_order" integer DEFAULT 0,
    "is_editable" boolean DEFAULT true,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "opening_closing_checklists_checklist_type_check" CHECK (("checklist_type" = ANY (ARRAY['opening'::"text", 'closing'::"text"])))
);


ALTER TABLE "public"."opening_closing_checklists" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."performance_reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "text" NOT NULL,
    "staff_id" "uuid",
    "employee_name" "text" NOT NULL,
    "review_date" timestamp with time zone DEFAULT "now"(),
    "workday_employee_id" "text" NOT NULL,
    "tech_name" "text" NOT NULL,
    "job_title" "text",
    "store_number" "text",
    "hire_date" "date",
    "region" "text",
    "district" "text",
    "position_id" "text",
    "your_score" numeric DEFAULT 0,
    "nps" numeric DEFAULT 0,
    "employee_performance_surveys" numeric DEFAULT 0,
    "email_pct" numeric DEFAULT 0,
    "pmix" numeric DEFAULT 0,
    "big_4" numeric DEFAULT 0,
    "bay_time" numeric DEFAULT 0,
    "oil_changes" numeric DEFAULT 0,
    "gross_aro" numeric DEFAULT 0,
    "net_aro" numeric DEFAULT 0,
    "discount_per_oil_change" numeric DEFAULT 0,
    "wiper_pct" numeric DEFAULT 0,
    "air_filter_pct" numeric DEFAULT 0,
    "cabin_filter_pct" numeric DEFAULT 0,
    "coolant_pct" numeric DEFAULT 0,
    "donations" numeric DEFAULT 0,
    "pit_score" integer,
    "hood_score" integer,
    "service_writer_score" integer,
    "attendance_score" integer,
    "uniform_score" integer,
    "kpis_score" integer,
    "reviewer_name" "text" NOT NULL,
    "reviewer_role" "text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "performance_reviews_attendance_score_check" CHECK ((("attendance_score" >= 1) AND ("attendance_score" <= 5))),
    CONSTRAINT "performance_reviews_hood_score_check" CHECK ((("hood_score" >= 1) AND ("hood_score" <= 5))),
    CONSTRAINT "performance_reviews_kpis_score_check" CHECK ((("kpis_score" >= 1) AND ("kpis_score" <= 5))),
    CONSTRAINT "performance_reviews_pit_score_check" CHECK ((("pit_score" >= 1) AND ("pit_score" <= 5))),
    CONSTRAINT "performance_reviews_service_writer_score_check" CHECK ((("service_writer_score" >= 1) AND ("service_writer_score" <= 5))),
    CONSTRAINT "performance_reviews_uniform_score_check" CHECK ((("uniform_score" >= 1) AND ("uniform_score" <= 5)))
);


ALTER TABLE "public"."performance_reviews" OWNER TO "postgres";


COMMENT ON TABLE "public"."performance_reviews" IS 'Stores employee performance review records with KPIs and scores';



CREATE TABLE IF NOT EXISTS "public"."pos_button_color_palette" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "color_name" "text" NOT NULL,
    "color_hex" "text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true
);


ALTER TABLE "public"."pos_button_color_palette" OWNER TO "postgres";


COMMENT ON TABLE "public"."pos_button_color_palette" IS 'Color palette for POS buttons - provides consistent branding colors';



CREATE TABLE IF NOT EXISTS "public"."pos_button_groups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "text" NOT NULL,
    "label" "text" NOT NULL,
    "color" "text" DEFAULT '#FFB55E'::"text" NOT NULL,
    "sort_index" integer DEFAULT 0 NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."pos_button_groups" OWNER TO "postgres";


COMMENT ON TABLE "public"."pos_button_groups" IS 'Groups for organizing POS buttons in the Crash Kit work order interface';



CREATE TABLE IF NOT EXISTS "public"."pos_buttons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "text" NOT NULL,
    "button_name" "text" NOT NULL,
    "unit_price" numeric DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "group_id" "uuid",
    "sort_index" integer DEFAULT 0 NOT NULL,
    "parent_button_id" "uuid",
    "button_color" "text" DEFAULT '#B00020'::"text",
    "button_layout" "jsonb" DEFAULT '{"cols": 4, "rows": 2}'::"jsonb",
    "nested_button_color" "text" DEFAULT '#DC2626'::"text"
);


ALTER TABLE "public"."pos_buttons" OWNER TO "postgres";


COMMENT ON COLUMN "public"."pos_buttons"."parent_button_id" IS 'Reference to parent button for nested 3x3 sub-button grids';



CREATE TABLE IF NOT EXISTS "public"."pos_nested_buttons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "parent_button_id" "uuid" NOT NULL,
    "button_label" "text" NOT NULL,
    "unit_price" numeric DEFAULT 0 NOT NULL,
    "button_color" "text" DEFAULT '#DC2626'::"text",
    "sort_index" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."pos_nested_buttons" OWNER TO "postgres";


COMMENT ON TABLE "public"."pos_nested_buttons" IS 'Stores nested POS buttons with individual colors and pricing - single source of truth for Mini POS';



CREATE TABLE IF NOT EXISTS "public"."price_list" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "item_slug" "text" NOT NULL,
    "price" numeric NOT NULL,
    "currency" "text" DEFAULT 'USD'::"text" NOT NULL,
    "price_effective_from" "date",
    "price_effective_to" "date",
    "active" boolean DEFAULT true NOT NULL,
    "category" "text"
);


ALTER TABLE "public"."price_list" OWNER TO "postgres";


COMMENT ON COLUMN "public"."price_list"."category" IS 'menu item buttons';



CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "role" "text" NOT NULL,
    "shop_id" "text",
    "district_id" "text",
    "region_id" "text",
    "full_name" "text",
    "phone" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "store_number" "text",
    "district_name" "text",
    "region_name" "text",
    CONSTRAINT "profiles_role_check" CHECK (("role" = ANY (ARRAY['shop'::"text", 'district_manager'::"text", 'regional_director'::"text", 'admin'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON TABLE "public"."profiles" IS 'User profiles with role-based hierarchy (shop, district_manager, regional_director, admin). Links to shop_alignment for hierarchy data.';



CREATE TABLE IF NOT EXISTS "public"."refunds" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "text" NOT NULL,
    "customer_name" "text" NOT NULL,
    "customer_work_order" "text" NOT NULL,
    "refund_amount" numeric NOT NULL,
    "services_to_be_refunded" "text" NOT NULL,
    "refund_reason" "text" NOT NULL,
    "is_claim_related" boolean DEFAULT false,
    "submitted_by" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "refunds_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text", 'processed'::"text"])))
);


ALTER TABLE "public"."refunds" OWNER TO "postgres";


COMMENT ON TABLE "public"."refunds" IS 'Stores refund requests with customer information and refund details';



CREATE TABLE IF NOT EXISTS "public"."regions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."regions" OWNER TO "postgres";


COMMENT ON TABLE "public"."regions" IS 'Lookup table for regions with dropdown support';



CREATE TABLE IF NOT EXISTS "public"."repair_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "text" NOT NULL,
    "item_broken" "text" NOT NULL,
    "model_number" "text" NOT NULL,
    "serial_number" "text" NOT NULL,
    "description" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "photo_urls" "text"[] DEFAULT '{}'::"text"[],
    "repair_type" "text",
    CONSTRAINT "repair_requests_repair_type_check" CHECK (("repair_type" = ANY (ARRAY['building'::"text", 'it'::"text", 'cc_machine'::"text"]))),
    CONSTRAINT "repair_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'in_progress'::"text", 'completed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."repair_requests" OWNER TO "postgres";


COMMENT ON COLUMN "public"."repair_requests"."photo_urls" IS 'Array of photo URLs for evidence/documentation of the repair request';



CREATE TABLE IF NOT EXISTS "public"."repairs_maintenance_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "request_id" "uuid",
    "building_id" "text",
    "submitted_by" "text",
    "payload" "jsonb" DEFAULT '{}'::"jsonb",
    "status" "text" DEFAULT 'submitted'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "repairs_maintenance_log_status_check" CHECK (("status" = ANY (ARRAY['submitted'::"text", 'in_progress'::"text", 'completed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."repairs_maintenance_log" OWNER TO "postgres";


COMMENT ON TABLE "public"."repairs_maintenance_log" IS 'Stores R&M submission log entries with 360-day retention';



COMMENT ON COLUMN "public"."repairs_maintenance_log"."request_id" IS 'Foreign key to repair_requests table';



COMMENT ON COLUMN "public"."repairs_maintenance_log"."building_id" IS 'Shop/building identifier';



COMMENT ON COLUMN "public"."repairs_maintenance_log"."submitted_by" IS 'Name of person who submitted the request';



COMMENT ON COLUMN "public"."repairs_maintenance_log"."payload" IS 'Full form data + checklist responses';



COMMENT ON COLUMN "public"."repairs_maintenance_log"."status" IS 'Current status of the request';



CREATE TABLE IF NOT EXISTS "public"."retail_calendar" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "year" integer NOT NULL,
    "period_no" integer NOT NULL,
    "quarter" integer NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "weeks" integer DEFAULT 4 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."retail_calendar" OWNER TO "postgres";


COMMENT ON TABLE "public"."retail_calendar" IS 'Retail calendar with 4-4-5 structure. 2025 seeded with P10 anchor (2025-09-28). Add 2026-2034 when corporate provides anchors. (Batch 5)';



COMMENT ON COLUMN "public"."retail_calendar"."period_no" IS 'Period number (1-12)';



COMMENT ON COLUMN "public"."retail_calendar"."quarter" IS 'Quarter number (1-4)';



COMMENT ON COLUMN "public"."retail_calendar"."weeks" IS 'Number of weeks in this period (4 or 5)';



CREATE TABLE IF NOT EXISTS "public"."service_catalog" (
    "item_slug" "text" NOT NULL,
    "item_name" "text" NOT NULL,
    "category" "text" NOT NULL,
    "menu_group" "text" NOT NULL,
    "oil_type_grade" "text",
    "brand" "text",
    "package" "text",
    "size_variant" "text",
    "is_customer_supplied" boolean DEFAULT false NOT NULL,
    "uom" "text" DEFAULT 'service'::"text" NOT NULL,
    "display_order" integer DEFAULT 999 NOT NULL,
    "sku" "text",
    "notes" "text"
);


ALTER TABLE "public"."service_catalog" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shop_alignment" (
    "shop" "text" NOT NULL,
    "region" "text",
    "district" "text",
    "shop_email" "text",
    "shop_pass" "text",
    "dm_email" "text",
    "dm_pass" "text",
    "rd_email" "text",
    "rd_pass" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."shop_alignment" OWNER TO "postgres";


COMMENT ON TABLE "public"."shop_alignment" IS 'Single source of truth for shop hierarchy: regions, districts, and shops. Used for authentication and access control.';



CREATE TABLE IF NOT EXISTS "public"."shop_catalog" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "text" NOT NULL,
    "item_number" "text" NOT NULL,
    "product_number" "text",
    "name" "text" NOT NULL,
    "category" "text" NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."shop_catalog" OWNER TO "postgres";


COMMENT ON TABLE "public"."shop_catalog" IS 'Individualized shop master inventory list - becomes source of truth after first modification';



CREATE TABLE IF NOT EXISTS "public"."shop_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid",
    "category" "text" NOT NULL,
    "alias" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."shop_categories" OWNER TO "postgres";


COMMENT ON TABLE "public"."shop_categories" IS 'Category mappings for each shop';



CREATE TABLE IF NOT EXISTS "public"."shop_checkbook_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "text" NOT NULL,
    "date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "check_number" "text",
    "payee" "text" NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "category" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "period_no" integer,
    "week_in_period" integer
);


ALTER TABLE "public"."shop_checkbook_entries" OWNER TO "postgres";


COMMENT ON TABLE "public"."shop_checkbook_entries" IS 'Shop checkbook entries with RLS enabled (Security Audit Fix - Jan 2025)';



CREATE TABLE IF NOT EXISTS "public"."shop_count_sheet_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sheet_id" "uuid",
    "product_id" "uuid",
    "sku" "text" NOT NULL,
    "count" numeric DEFAULT 0,
    "last_modified" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."shop_count_sheet_items" OWNER TO "postgres";


COMMENT ON TABLE "public"."shop_count_sheet_items" IS 'Individual product counts on count sheets';



COMMENT ON COLUMN "public"."shop_count_sheet_items"."count" IS 'Current count value for this product on this sheet';



COMMENT ON COLUMN "public"."shop_count_sheet_items"."last_modified" IS 'Timestamp of last count modification';



CREATE TABLE IF NOT EXISTS "public"."shop_count_sheets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid",
    "name" "text" NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "archived_at" timestamp with time zone,
    "import_snapshot" "jsonb" DEFAULT '{}'::"jsonb"
);


ALTER TABLE "public"."shop_count_sheets" OWNER TO "postgres";


COMMENT ON TABLE "public"."shop_count_sheets" IS 'Count sheet headers - one active per shop at a time';



COMMENT ON COLUMN "public"."shop_count_sheets"."import_snapshot" IS 'JSON snapshot of import dry-run and final state';



CREATE TABLE IF NOT EXISTS "public"."shop_inventory_items" (
    "id" bigint NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "itemnumber" "text" NOT NULL,
    "productnumber" "text" NOT NULL,
    "category" "text" NOT NULL,
    "floorcount" integer DEFAULT 0 NOT NULL,
    "storagecount" integer DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."shop_inventory_items" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."shop_inventory_items_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."shop_inventory_items_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."shop_inventory_items_id_seq" OWNED BY "public"."shop_inventory_items"."id";



CREATE TABLE IF NOT EXISTS "public"."shop_inventory_profile" (
    "shop_id" "text" NOT NULL,
    "mode" "public"."inventory_mode" DEFAULT 'MASTER'::"public"."inventory_mode" NOT NULL,
    "locked" boolean DEFAULT true NOT NULL,
    "source_note" "text",
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."shop_inventory_profile" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shop_master_products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid",
    "sku" "text" NOT NULL,
    "name" "text" NOT NULL,
    "category" "text",
    "upc" "text",
    "cost_cents" integer,
    "price_cents" integer,
    "uom" "text",
    "active" boolean DEFAULT true,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."shop_master_products" OWNER TO "postgres";


COMMENT ON TABLE "public"."shop_master_products" IS 'Master product catalog for each shop';



COMMENT ON COLUMN "public"."shop_master_products"."cost_cents" IS 'Cost in cents (e.g., 1099 = $10.99)';



COMMENT ON COLUMN "public"."shop_master_products"."price_cents" IS 'Selling price in cents (e.g., 1999 = $19.99)';



COMMENT ON COLUMN "public"."shop_master_products"."metadata" IS 'Flexible JSON field for additional product attributes';



CREATE TABLE IF NOT EXISTS "public"."shop_overrides" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "text" NOT NULL,
    "master_item_id" "uuid",
    "sku" "text",
    "item_name" "text" NOT NULL,
    "brand" "text",
    "oil_grade" "text",
    "type" "text",
    "price" numeric,
    "category_code" "text",
    "meta" "jsonb" DEFAULT '{}'::"jsonb",
    "source" "text" DEFAULT 'csv'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."shop_overrides" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shop_staff" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "text" NOT NULL,
    "staff_name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "employee_phone_number" "text",
    "date_of_hired" "date"
);


ALTER TABLE "public"."shop_staff" OWNER TO "postgres";


COMMENT ON TABLE "public"."shop_staff" IS 'Stores staff members for each shop - used across the app for staff selection';



COMMENT ON COLUMN "public"."shop_staff"."employee_phone_number" IS 'Optional phone number for the employee';



COMMENT ON COLUMN "public"."shop_staff"."date_of_hired" IS 'Date when the employee was hired';



CREATE TABLE IF NOT EXISTS "public"."shop_workbook_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "text" NOT NULL,
    "date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "vendor" "text" NOT NULL,
    "week1" numeric(10,2) DEFAULT 0,
    "week2" numeric(10,2) DEFAULT 0,
    "week3" numeric(10,2) DEFAULT 0,
    "week4" numeric(10,2) DEFAULT 0,
    "mtd_actual" numeric(10,2) DEFAULT 0,
    "mtd_budget" numeric(10,2) DEFAULT 0,
    "variance" numeric(10,2) DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "week5" numeric DEFAULT 0,
    "period_no" integer,
    "week_in_period" integer
);


ALTER TABLE "public"."shop_workbook_entries" OWNER TO "postgres";


COMMENT ON TABLE "public"."shop_workbook_entries" IS 'Shop workbook entries with RLS enabled (Security Audit Fix - Jan 2025)';



CREATE TABLE IF NOT EXISTS "public"."shops" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "shop_number" "text",
    "region" "text",
    "manager_name" "text",
    "export_email" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "shop_code" "text",
    "staffing_goal" integer DEFAULT 15
);


ALTER TABLE "public"."shops" OWNER TO "postgres";


COMMENT ON TABLE "public"."shops" IS 'Shop locations and basic information';



COMMENT ON COLUMN "public"."shops"."staffing_goal" IS 'Target number of staff members for this shop';



CREATE TABLE IF NOT EXISTS "public"."solink_audits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "text" NOT NULL,
    "shop_number" "text",
    "your_name" "text" NOT NULL,
    "solink_tag" "text" NOT NULL,
    "work_order_number" "text",
    "claim_number" "text",
    "audit_day" "date" DEFAULT CURRENT_DATE NOT NULL,
    "audit_time" time without time zone NOT NULL,
    "visit_day" "date",
    "visit_time" time without time zone,
    "audit_type" "text" NOT NULL,
    "checklist_form" "text" NOT NULL,
    "checklist_data" "jsonb" DEFAULT '{}'::"jsonb",
    "general_comments" "text",
    "submission_step" "text" DEFAULT 'first'::"text",
    "generated_code" "text",
    "status" "text" DEFAULT 'pending'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "expires_at" timestamp with time zone DEFAULT ("now"() + '90 days'::interval),
    CONSTRAINT "solink_audits_audit_type_check" CHECK (("audit_type" = ANY (ARRAY['full'::"text", 'quick_audit'::"text", 'coaching'::"text"]))),
    CONSTRAINT "solink_audits_checklist_form_check" CHECK (("checklist_form" = ANY (ARRAY['full'::"text", 'service_writer'::"text", 'pit_tech'::"text", 'safety_check'::"text", 'hood_tech'::"text", 'mod'::"text"]))),
    CONSTRAINT "solink_audits_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'completed'::"text", 'reviewed'::"text"]))),
    CONSTRAINT "solink_audits_submission_step_check" CHECK (("submission_step" = ANY (ARRAY['first'::"text", 'second'::"text"])))
);


ALTER TABLE "public"."solink_audits" OWNER TO "postgres";


COMMENT ON TABLE "public"."solink_audits" IS 'Stores SoLink audit submissions with 90-day retention';



CREATE TABLE IF NOT EXISTS "public"."speed_training_leaderboard" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "text" NOT NULL,
    "user_id" "uuid",
    "difficulty" "text" NOT NULL,
    "best_score" numeric DEFAULT 0 NOT NULL,
    "total_games" integer DEFAULT 0 NOT NULL,
    "total_revenue" numeric DEFAULT 0 NOT NULL,
    "total_cars_serviced" integer DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "speed_training_leaderboard_difficulty_check" CHECK (("difficulty" = ANY (ARRAY['easy'::"text", 'medium'::"text", 'hard'::"text", 'expert'::"text"])))
);


ALTER TABLE "public"."speed_training_leaderboard" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."speed_training_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "text" NOT NULL,
    "user_id" "uuid",
    "difficulty" "text" NOT NULL,
    "score" numeric DEFAULT 0 NOT NULL,
    "game_time" numeric DEFAULT 0 NOT NULL,
    "cars_serviced" integer DEFAULT 0 NOT NULL,
    "cars_exited" integer DEFAULT 0 NOT NULL,
    "total_revenue" numeric DEFAULT 0 NOT NULL,
    "big4_percentage" numeric DEFAULT 0 NOT NULL,
    "customer_satisfaction" numeric DEFAULT 0 NOT NULL,
    "kpi_data" "jsonb" DEFAULT '{}'::"jsonb",
    "scoring_data" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "speed_training_runs_difficulty_check" CHECK (("difficulty" = ANY (ARRAY['easy'::"text", 'medium'::"text", 'hard'::"text", 'expert'::"text"])))
);


ALTER TABLE "public"."speed_training_runs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."spif_tracker" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "text" NOT NULL,
    "shop_number" "text",
    "date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "employee_name" "text" NOT NULL,
    "employee_role" "text" NOT NULL,
    "coolant_count" integer DEFAULT 0,
    "coolant_amount" numeric DEFAULT 0,
    "differential_count" integer DEFAULT 0,
    "differential_amount" numeric DEFAULT 0,
    "fuel_filter_count" integer DEFAULT 0,
    "fuel_filter_amount" numeric DEFAULT 0,
    "transmission_count" integer DEFAULT 0,
    "transmission_amount" numeric DEFAULT 0,
    "air_filter_count" integer DEFAULT 0,
    "air_filter_amount" numeric DEFAULT 0,
    "cabin_filter_count" integer DEFAULT 0,
    "cabin_filter_amount" numeric DEFAULT 0,
    "wiper_blades_count" integer DEFAULT 0,
    "wiper_blades_amount" numeric DEFAULT 0,
    "total_spif" numeric GENERATED ALWAYS AS ((((((("coolant_amount" + "differential_amount") + "fuel_filter_amount") + "transmission_amount") + "air_filter_amount") + "cabin_filter_amount") + "wiper_blades_amount")) STORED,
    "asm_bonus" numeric GENERATED ALWAYS AS (
CASE
    WHEN ("employee_role" = 'asm'::"text") THEN ((((((("coolant_amount" + "differential_amount") + "fuel_filter_amount") + "transmission_amount") + "air_filter_amount") + "cabin_filter_amount") + "wiper_blades_amount") * 0.005)
    ELSE (0)::numeric
END) STORED,
    "sm_bonus" numeric GENERATED ALWAYS AS (
CASE
    WHEN ("employee_role" = 'sm'::"text") THEN ((((((("coolant_amount" + "differential_amount") + "fuel_filter_amount") + "transmission_amount") + "air_filter_amount") + "cabin_filter_amount") + "wiper_blades_amount") * 0.01)
    ELSE (0)::numeric
END) STORED,
    "total_with_bonus" numeric GENERATED ALWAYS AS (((((((("coolant_amount" + "differential_amount") + "fuel_filter_amount") + "transmission_amount") + "air_filter_amount") + "cabin_filter_amount") + "wiper_blades_amount") +
CASE
    WHEN ("employee_role" = 'asm'::"text") THEN ((((((("coolant_amount" + "differential_amount") + "fuel_filter_amount") + "transmission_amount") + "air_filter_amount") + "cabin_filter_amount") + "wiper_blades_amount") * 0.005)
    WHEN ("employee_role" = 'sm'::"text") THEN ((((((("coolant_amount" + "differential_amount") + "fuel_filter_amount") + "transmission_amount") + "air_filter_amount") + "cabin_filter_amount") + "wiper_blades_amount") * 0.01)
    ELSE (0)::numeric
END)) STORED,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "economy_oil_count" integer DEFAULT 0,
    "economy_oil_amount" numeric DEFAULT 0,
    "premium_oil_count" integer DEFAULT 0,
    "premium_oil_amount" numeric DEFAULT 0,
    "xlt_mobil_count" integer DEFAULT 0,
    "xlt_mobil_amount" numeric DEFAULT 0,
    "fuel_system_count" integer DEFAULT 0,
    "fuel_system_amount" numeric DEFAULT 0,
    CONSTRAINT "spif_tracker_employee_role_check" CHECK (("employee_role" = ANY (ARRAY['technician'::"text", 'asm'::"text", 'sm'::"text"])))
);


ALTER TABLE "public"."spif_tracker" OWNER TO "postgres";


COMMENT ON TABLE "public"."spif_tracker" IS 'Tracks SPIF (Sales Performance Incentive Fund) earnings for technicians, ASMs, and SMs with automatic bonus calculations. Supports oil services, filters, wipers, coolant, fuel filters, and differentials.';



COMMENT ON COLUMN "public"."spif_tracker"."economy_oil_count" IS 'Economy Oil (T4) unit count';



COMMENT ON COLUMN "public"."spif_tracker"."economy_oil_amount" IS 'Economy Oil (T4) SPIF earnings ($0.25 per unit)';



COMMENT ON COLUMN "public"."spif_tracker"."premium_oil_count" IS 'Premium / SynBlend HM (T5) unit count';



COMMENT ON COLUMN "public"."spif_tracker"."premium_oil_amount" IS 'Premium / SynBlend HM (T5) SPIF earnings ($1.00 per unit)';



COMMENT ON COLUMN "public"."spif_tracker"."xlt_mobil_count" IS 'XLT / Mobil (T6) unit count';



COMMENT ON COLUMN "public"."spif_tracker"."xlt_mobil_amount" IS 'XLT / Mobil (T6) SPIF earnings ($2.00 per unit)';



COMMENT ON COLUMN "public"."spif_tracker"."fuel_system_count" IS 'Fuel System Cleaner unit count';



COMMENT ON COLUMN "public"."spif_tracker"."fuel_system_amount" IS 'Fuel System Cleaner SPIF earnings ($0.50 per unit)';



CREATE TABLE IF NOT EXISTS "public"."spiff_gain_loss_tracking" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "text" NOT NULL,
    "shop_number" "text",
    "date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "employee_role" "text" NOT NULL,
    "cars_per_day" numeric DEFAULT 0,
    "economy_oil_goal" numeric DEFAULT 0,
    "economy_oil_actual" numeric DEFAULT 0,
    "economy_oil_spiff_diff" numeric DEFAULT 0,
    "premium_oil_goal" numeric DEFAULT 0,
    "premium_oil_actual" numeric DEFAULT 0,
    "premium_oil_spiff_diff" numeric DEFAULT 0,
    "xlt_mobil_goal" numeric DEFAULT 0,
    "xlt_mobil_actual" numeric DEFAULT 0,
    "xlt_mobil_spiff_diff" numeric DEFAULT 0,
    "fuel_system_goal" numeric DEFAULT 0,
    "fuel_system_actual" numeric DEFAULT 0,
    "fuel_system_spiff_diff" numeric DEFAULT 0,
    "air_filter_goal" numeric DEFAULT 0,
    "air_filter_actual" numeric DEFAULT 0,
    "air_filter_spiff_diff" numeric DEFAULT 0,
    "cabin_filter_goal" numeric DEFAULT 0,
    "cabin_filter_actual" numeric DEFAULT 0,
    "cabin_filter_spiff_diff" numeric DEFAULT 0,
    "coolant_goal" numeric DEFAULT 0,
    "coolant_actual" numeric DEFAULT 0,
    "coolant_spiff_diff" numeric DEFAULT 0,
    "total_spiff_difference" numeric DEFAULT 0,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    CONSTRAINT "spiff_gain_loss_tracking_employee_role_check" CHECK (("employee_role" = ANY (ARRAY['technician'::"text", 'asm'::"text", 'sm'::"text"])))
);


ALTER TABLE "public"."spiff_gain_loss_tracking" OWNER TO "postgres";


COMMENT ON TABLE "public"."spiff_gain_loss_tracking" IS 'Tracks SPIFF Gain/Loss calculations with Goal% vs Actual% performance metrics';



CREATE TABLE IF NOT EXISTS "public"."supply_ordering_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "text" NOT NULL,
    "shop_number" "text",
    "order_id" "uuid",
    "submitted_by" "text",
    "payload" "jsonb" DEFAULT '{}'::"jsonb",
    "status" "text" DEFAULT 'submitted'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone DEFAULT ("now"() + '90 days'::interval),
    CONSTRAINT "supply_ordering_log_status_check" CHECK (("status" = ANY (ARRAY['submitted'::"text", 'ordered'::"text", 'received'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."supply_ordering_log" OWNER TO "postgres";


COMMENT ON TABLE "public"."supply_ordering_log" IS 'Stores supply ordering submissions with 90-day retention';



COMMENT ON COLUMN "public"."supply_ordering_log"."expires_at" IS 'Automatic expiration date set to 90 days from creation';



CREATE TABLE IF NOT EXISTS "public"."supply_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "text" NOT NULL,
    "shop_number" "text",
    "order_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "vendor" "text" NOT NULL,
    "items" "text" NOT NULL,
    "quantity" numeric DEFAULT 0 NOT NULL,
    "unit_cost" numeric DEFAULT 0 NOT NULL,
    "total_cost" numeric GENERATED ALWAYS AS (("quantity" * "unit_cost")) STORED,
    "notes" "text",
    "status" "text" DEFAULT 'pending'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "supply_orders_quantity_check" CHECK (("quantity" >= (0)::numeric)),
    CONSTRAINT "supply_orders_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'ordered'::"text", 'received'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "supply_orders_unit_cost_check" CHECK (("unit_cost" >= (0)::numeric))
);


ALTER TABLE "public"."supply_orders" OWNER TO "postgres";


COMMENT ON TABLE "public"."supply_orders" IS 'Stores supply ordering records with vendor, items, and cost tracking';



CREATE TABLE IF NOT EXISTS "public"."termed_employees" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "text" NOT NULL,
    "staff_id" "uuid",
    "staff_name" "text" NOT NULL,
    "employee_phone_number" "text",
    "date_of_hired" "date",
    "date_of_termination" "date" DEFAULT CURRENT_DATE NOT NULL,
    "termination_reason" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."termed_employees" OWNER TO "postgres";


COMMENT ON TABLE "public"."termed_employees" IS 'Stores terminated employee records with termination date and reason';



CREATE TABLE IF NOT EXISTS "public"."turned_log_daily_counts" (
    "shop_id" "text" NOT NULL,
    "day" "date" NOT NULL,
    "count" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."turned_log_daily_counts" OWNER TO "postgres";


COMMENT ON TABLE "public"."turned_log_daily_counts" IS 'Daily aggregated counts of turned logs per shop';



COMMENT ON COLUMN "public"."turned_log_daily_counts"."shop_id" IS 'Shop identifier';



COMMENT ON COLUMN "public"."turned_log_daily_counts"."day" IS 'Date of the count';



COMMENT ON COLUMN "public"."turned_log_daily_counts"."count" IS 'Number of turned logs for this shop on this day';



CREATE TABLE IF NOT EXISTS "public"."turned_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "car_type" "text",
    "mod" "text" NOT NULL,
    "notes" "text",
    "user_id" "uuid" NOT NULL,
    "shop_id" "text" NOT NULL,
    "timestamp" timestamp with time zone DEFAULT "now"(),
    "make_model" "text",
    "why_turned" "text",
    "turned_at" timestamp with time zone DEFAULT "now"(),
    "vin" "text",
    "stock_no" "text",
    "make" "text",
    "model" "text",
    "year" "text",
    "media" "jsonb" DEFAULT '[]'::"jsonb",
    "status" "text" DEFAULT 'done'::"text",
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."turned_logs" OWNER TO "postgres";


COMMENT ON TABLE "public"."turned_logs" IS 'Stores turned log entries with 90-day retention policy';



COMMENT ON COLUMN "public"."turned_logs"."timestamp" IS 'Time when the car was turned away';



COMMENT ON COLUMN "public"."turned_logs"."make_model" IS 'Make and model of the vehicle';



COMMENT ON COLUMN "public"."turned_logs"."why_turned" IS 'Reason why the car was turned: Inspection, Other Services, General Inquiries, Price';



COMMENT ON COLUMN "public"."turned_logs"."turned_at" IS 'Timestamp when the vehicle was turned away';



COMMENT ON COLUMN "public"."turned_logs"."vin" IS 'Vehicle Identification Number';



COMMENT ON COLUMN "public"."turned_logs"."stock_no" IS 'Stock number';



COMMENT ON COLUMN "public"."turned_logs"."make" IS 'Vehicle make';



COMMENT ON COLUMN "public"."turned_logs"."model" IS 'Vehicle model';



COMMENT ON COLUMN "public"."turned_logs"."year" IS 'Vehicle year';



COMMENT ON COLUMN "public"."turned_logs"."media" IS 'Array of media URLs (photos, videos)';



COMMENT ON COLUMN "public"."turned_logs"."status" IS 'Status of the turned log entry';



CREATE TABLE IF NOT EXISTS "public"."upload_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "total_items" integer DEFAULT 0,
    "category_counts" "jsonb" DEFAULT '{}'::"jsonb",
    "timestamp" timestamp with time zone DEFAULT "now"(),
    "uploader_id" "text",
    "uploader_email" "text",
    "file_name" "text",
    "new_items" integer DEFAULT 0,
    "updated_items" integer DEFAULT 0,
    "skipped_items" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."upload_logs" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_active_employees" AS
 SELECT "id",
    "staff_name" AS "full_name",
    "employee_phone_number" AS "phone",
    'staff'::"text" AS "role",
    'active'::"text" AS "status",
    "shop_id",
    "date_of_hired",
    "created_at",
    "updated_at"
   FROM "public"."shop_staff"
  WHERE ("staff_name" IS NOT NULL)
  ORDER BY "staff_name";


ALTER VIEW "public"."v_active_employees" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_active_employees" IS 'View of active employees with standardized fields';



CREATE OR REPLACE VIEW "public"."v_alignment_master" AS
 SELECT "region_id",
    "region_name",
    "district_id",
    "district_name",
    "shop_id",
    "shop_name",
    "is_active",
    "shop_email",
    "shop_pass",
    "dm_email",
    "dm_pass",
    "rd_email",
    "rd_pass",
    "Store" AS "store_number"
   FROM "public"."alignment_master"
  WHERE ("is_active" = true)
  ORDER BY "region_name", "district_name", "shop_name";


ALTER VIEW "public"."v_alignment_master" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_employees_min" AS
 SELECT "id",
    ((COALESCE("first_name", ''::"text") || ' '::"text") || COALESCE("last_name", ''::"text")) AS "full_name",
    "phone",
    "hire_date",
    COALESCE("active", true) AS "active"
   FROM "public"."employees" "e";


ALTER VIEW "public"."v_employees_min" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_employees_min" IS 'Lightweight view for employee lists';



CREATE OR REPLACE VIEW "public"."v_inventory_by_category" AS
 SELECT "mp"."item_number" AS "itemNumber",
    "mp"."product_number" AS "productNumber",
    "mp"."category",
    COALESCE("ic"."floor_count", 0) AS "floorCount",
    COALESCE("ic"."storage_count", 0) AS "storageCount",
    COALESCE("ic"."updated_at", "mp"."updated_at") AS "updated_at",
    "ic"."shop_id",
    "mp"."id" AS "product_id",
    "ic"."id" AS "count_id"
   FROM ("public"."master_products" "mp"
     LEFT JOIN "public"."inventory_counts" "ic" ON (("mp"."id" = "ic"."item_id")))
  WHERE ("mp"."is_active" = true)
  ORDER BY "mp"."category", "mp"."item_number";


ALTER VIEW "public"."v_inventory_by_category" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_inventory_by_category" IS 'View of inventory with counts joined by category';



CREATE OR REPLACE VIEW "public"."v_inventory_effective" AS
 SELECT "s"."shop_code",
    "si"."shop_id",
    "si"."itemnumber",
    "si"."productnumber",
    "si"."category",
    "si"."floorcount",
    "si"."storagecount",
    "si"."updated_at",
    true AS "is_shop_specific"
   FROM ("public"."shop_inventory_items" "si"
     JOIN "public"."shops" "s" ON (("s"."id" = "si"."shop_id")))
UNION ALL
 SELECT "s"."shop_code",
    "s"."id" AS "shop_id",
    "g"."itemnumber",
    "g"."productnumber",
    "g"."category",
    "g"."floorcount",
    "g"."storagecount",
    "g"."updated_at",
    false AS "is_shop_specific"
   FROM ("public"."shops" "s"
     CROSS JOIN "public"."inventory_items" "g")
  WHERE (NOT (EXISTS ( SELECT 1
           FROM "public"."shop_inventory_items" "si2"
          WHERE (("si2"."shop_id" = "s"."id") AND ("si2"."itemnumber" = "g"."itemnumber")))));


ALTER VIEW "public"."v_inventory_effective" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_inventory_master" AS
 SELECT "smp"."shop_id",
    "smp"."sku" AS "item_number",
    "smp"."name" AS "product_name",
    "smp"."active" AS "is_active",
    COALESCE("scsi"."count", (0)::numeric) AS "floor_count",
    0 AS "storage_count",
    COALESCE("scsi"."count", (0)::numeric) AS "total_count",
    "smp"."category",
    "c"."id" AS "category_id",
    "smp"."cost_cents",
    "smp"."price_cents",
    "smp"."uom",
    "scsi"."last_modified"
   FROM ((("public"."shop_master_products" "smp"
     LEFT JOIN "public"."shop_count_sheets" "scs" ON ((("scs"."shop_id" = "smp"."shop_id") AND ("scs"."is_active" = true))))
     LEFT JOIN "public"."shop_count_sheet_items" "scsi" ON ((("scsi"."sheet_id" = "scs"."id") AND ("scsi"."product_id" = "smp"."id"))))
     LEFT JOIN "public"."categories" "c" ON (("lower"("c"."name") = "lower"("smp"."category"))))
  WHERE ("smp"."active" = true);


ALTER VIEW "public"."v_inventory_master" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_inventory_master" IS 'Consolidated view of products with current counts';



CREATE OR REPLACE VIEW "public"."v_kpi_board" AS
 SELECT "d"."shop_id",
    "d"."date_key",
    "d"."cars",
    "d"."sales",
    "d"."aro",
    "d"."ticket",
    "d"."big4_pct",
    "d"."coolant_pct",
    "d"."diff_pct",
    "d"."mobil1_pct",
    "d"."labor_pct",
    "d"."exits",
    "d"."wipers_ct",
    COALESCE("gd"."cars_target", "gp"."cars_target") AS "cars_target",
    COALESCE("gd"."sales_target", "gp"."sales_target") AS "sales_target",
    COALESCE("gd"."aro_target", "gp"."aro_target") AS "aro_target",
    COALESCE("gd"."ticket_target", "gp"."ticket_target") AS "ticket_target",
    COALESCE("gd"."big4_target", "gp"."big4_target") AS "big4_target",
    COALESCE("gd"."coolant_target", "gp"."coolant_target") AS "coolant_target",
    COALESCE("gd"."diff_target", "gp"."diff_target") AS "diff_target",
    COALESCE("gd"."mobil1_target", "gp"."mobil1_target") AS "mobil1_target",
    COALESCE("gd"."labor_target", "gp"."labor_target") AS "labor_target",
    COALESCE("gd"."exits_target", "gp"."exits_target") AS "exits_target",
    COALESCE("gd"."wipers_target", "gp"."wipers_target") AS "wipers_target"
   FROM (("public"."kpi_daily" "d"
     LEFT JOIN "public"."kpi_goals" "gd" ON ((("gd"."shop_id" = "d"."shop_id") AND ("gd"."scope" = 'day'::"text") AND ("gd"."date_key" = "d"."date_key"))))
     LEFT JOIN "public"."kpi_goals" "gp" ON ((("gp"."shop_id" = "d"."shop_id") AND ("gp"."scope" = 'period'::"text") AND ("gp"."period_id" = ( SELECT
                CASE
                    WHEN (EXISTS ( SELECT 1
                       FROM "public"."retail_calendar"
                      WHERE (("d"."date_key" >= "retail_calendar"."start_date") AND ("d"."date_key" <= "retail_calendar"."end_date")))) THEN ( SELECT ('P'::"text" || "lpad"(("retail_calendar"."period_no")::"text", 2, '0'::"text"))
                       FROM "public"."retail_calendar"
                      WHERE (("d"."date_key" >= "retail_calendar"."start_date") AND ("d"."date_key" <= "retail_calendar"."end_date"))
                     LIMIT 1)
                    ELSE "to_char"(("d"."date_key")::timestamp with time zone, '"P"MM'::"text")
                END AS "to_char")))));


ALTER VIEW "public"."v_kpi_board" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_kpi_board" IS 'Canonical KPI board view that combines daily KPIs with goals (day-specific or period-based)';



CREATE OR REPLACE VIEW "public"."v_shop_effective_items" AS
 SELECT COALESCE("o"."shop_id", 'MASTER'::"text") AS "shop_id",
    COALESCE("o"."sku", "m"."sku") AS "sku",
    COALESCE("o"."item_name", "m"."item_name") AS "item_name",
    COALESCE("o"."brand", "m"."brand") AS "brand",
    COALESCE("o"."oil_grade", "m"."oil_grade") AS "oil_grade",
    COALESCE("o"."type", "m"."type") AS "type",
    COALESCE("o"."price", "m"."price") AS "price",
    COALESCE("o"."category_code", "m"."category_code") AS "category_code",
    COALESCE("o"."meta", "m"."meta") AS "meta",
    COALESCE("o"."id", "m"."id") AS "id",
        CASE
            WHEN ("o"."id" IS NOT NULL) THEN 'override'::"text"
            ELSE 'master'::"text"
        END AS "source"
   FROM ("public"."master_items" "m"
     LEFT JOIN "public"."shop_overrides" "o" ON (("o"."master_item_id" = "m"."id")));


ALTER VIEW "public"."v_shop_effective_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vin_decode_cache" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "vin" "text" NOT NULL,
    "model_year" "text",
    "make" "text",
    "model" "text",
    "decode_response" "jsonb",
    "decoded_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."vin_decode_cache" OWNER TO "postgres";


COMMENT ON TABLE "public"."vin_decode_cache" IS 'Caches VIN decode results from NHTSA API to avoid redundant calls';



CREATE TABLE IF NOT EXISTS "public"."weekly_projections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "text" NOT NULL,
    "week_start_date" "date" NOT NULL,
    "sunday_cars" integer DEFAULT 0,
    "monday_cars" integer DEFAULT 0,
    "tuesday_cars" integer DEFAULT 0,
    "wednesday_cars" integer DEFAULT 0,
    "thursday_cars" integer DEFAULT 0,
    "friday_cars" integer DEFAULT 0,
    "saturday_cars" integer DEFAULT 0,
    "sunday_hours" numeric GENERATED ALWAYS AS ((("sunday_cars")::numeric * 0.79)) STORED,
    "monday_hours" numeric GENERATED ALWAYS AS ((("monday_cars")::numeric * 0.79)) STORED,
    "tuesday_hours" numeric GENERATED ALWAYS AS ((("tuesday_cars")::numeric * 0.79)) STORED,
    "wednesday_hours" numeric GENERATED ALWAYS AS ((("wednesday_cars")::numeric * 0.79)) STORED,
    "thursday_hours" numeric GENERATED ALWAYS AS ((("thursday_cars")::numeric * 0.79)) STORED,
    "friday_hours" numeric GENERATED ALWAYS AS ((("friday_cars")::numeric * 0.79)) STORED,
    "saturday_hours" numeric GENERATED ALWAYS AS ((("saturday_cars")::numeric * 0.79)) STORED,
    "weekday_total_hours" numeric GENERATED ALWAYS AS ((((((("monday_cars")::numeric * 0.79) + (("tuesday_cars")::numeric * 0.79)) + (("wednesday_cars")::numeric * 0.79)) + (("thursday_cars")::numeric * 0.79)) + (("friday_cars")::numeric * 0.79))) STORED,
    "total_hours" numeric GENERATED ALWAYS AS ((((((((("sunday_cars")::numeric * 0.79) + (("monday_cars")::numeric * 0.79)) + (("tuesday_cars")::numeric * 0.79)) + (("wednesday_cars")::numeric * 0.79)) + (("thursday_cars")::numeric * 0.79)) + (("friday_cars")::numeric * 0.79)) + (("saturday_cars")::numeric * 0.79))) STORED,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."weekly_projections" OWNER TO "postgres";


COMMENT ON TABLE "public"."weekly_projections" IS 'Stores weekly car projections and calculated hours allowed (cars * 0.79) for employee scheduling';



CREATE TABLE IF NOT EXISTS "public"."weekly_sales_data" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "text" NOT NULL,
    "week_start_date" "date" NOT NULL,
    "week_ending_date" "date" NOT NULL,
    "week_data" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."weekly_sales_data" OWNER TO "postgres";


COMMENT ON TABLE "public"."weekly_sales_data" IS 'Weekly sales data with RLS enabled (Security Audit Fix - Jan 2025)';



CREATE TABLE IF NOT EXISTS "public"."work_calendar_config" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "year" integer NOT NULL,
    "quarter" integer NOT NULL,
    "period" integer NOT NULL,
    "week_start_date" "date" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "work_calendar_config_period_check" CHECK ((("period" >= 1) AND ("period" <= 12))),
    CONSTRAINT "work_calendar_config_quarter_check" CHECK ((("quarter" >= 1) AND ("quarter" <= 4)))
);


ALTER TABLE "public"."work_calendar_config" OWNER TO "postgres";


COMMENT ON TABLE "public"."work_calendar_config" IS 'Stores work calendar anchor dates and configuration for 5-4-4 week pattern';



CREATE TABLE IF NOT EXISTS "public"."workbook_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."workbook_categories" OWNER TO "postgres";


COMMENT ON TABLE "public"."workbook_categories" IS 'Categories for workbook entries';



CREATE TABLE IF NOT EXISTS "public"."workbook_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entry_date" "date" NOT NULL,
    "description" "text" NOT NULL,
    "category_id" "uuid",
    "debit" numeric(12,2) DEFAULT 0,
    "credit" numeric(12,2) DEFAULT 0,
    "running_balance" numeric(12,2),
    "reference" "text",
    "reconciled" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid" NOT NULL,
    "shop_id" "text" NOT NULL,
    "period_no" integer,
    "week_in_period" integer,
    CONSTRAINT "check_debit_or_credit" CHECK (((("debit" > (0)::numeric) AND ("credit" = (0)::numeric)) OR (("credit" > (0)::numeric) AND ("debit" = (0)::numeric)))),
    CONSTRAINT "workbook_entries_credit_check" CHECK (("credit" >= (0)::numeric)),
    CONSTRAINT "workbook_entries_debit_check" CHECK (("debit" >= (0)::numeric))
);


ALTER TABLE "public"."workbook_entries" OWNER TO "postgres";


COMMENT ON TABLE "public"."workbook_entries" IS 'Stores workbook entries with running balance calculation';



ALTER TABLE ONLY "public"."category_keywords" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."category_keywords_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."inventory_items" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."inventory_items_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."inventory_staging" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."inventory_staging_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."shop_inventory_items" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."shop_inventory_items_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."Shop_alignment"
    ADD CONSTRAINT "Shop_alignment_pkey" PRIMARY KEY ("Shop");



ALTER TABLE ONLY "public"."ai_scanned_items"
    ADD CONSTRAINT "ai_scanned_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."alignment_master"
    ADD CONSTRAINT "alignment_master_pkey" PRIMARY KEY ("Store");



ALTER TABLE ONLY "public"."app_settings"
    ADD CONSTRAINT "app_settings_key_key" UNIQUE ("key");



ALTER TABLE ONLY "public"."app_settings"
    ADD CONSTRAINT "app_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."budgets"
    ADD CONSTRAINT "budgets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_name_unique" UNIQUE ("name");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."category_keywords"
    ADD CONSTRAINT "category_keywords_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."challenges_log"
    ADD CONSTRAINT "challenges_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."claims_log"
    ADD CONSTRAINT "claims_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."claims"
    ADD CONSTRAINT "claims_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."coaching_logs"
    ADD CONSTRAINT "coaching_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contacts"
    ADD CONSTRAINT "contacts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."crash_kit_customers"
    ADD CONSTRAINT "crash_kit_customers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."crash_kit_invoices"
    ADD CONSTRAINT "crash_kit_invoices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."crash_kit_logbook"
    ADD CONSTRAINT "crash_kit_logbook_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."crash_kit_offline_queue"
    ADD CONSTRAINT "crash_kit_offline_queue_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."crash_kit_products"
    ADD CONSTRAINT "crash_kit_products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."crash_kit_vehicles"
    ADD CONSTRAINT "crash_kit_vehicles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."crew_challenges"
    ADD CONSTRAINT "crew_challenges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."daily_cadence"
    ADD CONSTRAINT "daily_cadence_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."daily_checkbook_monthly_totals"
    ADD CONSTRAINT "daily_checkbook_monthly_totals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."daily_checkbook_monthly_totals"
    ADD CONSTRAINT "daily_checkbook_monthly_totals_shop_id_month_start_date_key" UNIQUE ("shop_id", "month_start_date");



ALTER TABLE ONLY "public"."daily_log_config"
    ADD CONSTRAINT "daily_log_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."daily_log_config"
    ADD CONSTRAINT "daily_log_config_shop_id_key" UNIQUE ("shop_id");



ALTER TABLE ONLY "public"."daily_logbook_close"
    ADD CONSTRAINT "daily_logbook_close_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."daily_logbook_close"
    ADD CONSTRAINT "daily_logbook_close_shop_id_report_date_key" UNIQUE ("shop_id", "report_date");



ALTER TABLE ONLY "public"."daily_logbook_entries"
    ADD CONSTRAINT "daily_logbook_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."daily_logbook"
    ADD CONSTRAINT "daily_logbook_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."daily_sales_entries"
    ADD CONSTRAINT "daily_sales_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."daily_sales_entries"
    ADD CONSTRAINT "daily_sales_entries_shop_id_date_key" UNIQUE ("shop_id", "date");



ALTER TABLE ONLY "public"."daily_summary_reports"
    ADD CONSTRAINT "daily_summary_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."daily_summary_reports"
    ADD CONSTRAINT "daily_summary_reports_shop_id_report_date_key" UNIQUE ("shop_id", "report_date");



ALTER TABLE ONLY "public"."daily_workbook_monthly_totals"
    ADD CONSTRAINT "daily_workbook_monthly_totals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."daily_workbook_monthly_totals"
    ADD CONSTRAINT "daily_workbook_monthly_totals_shop_id_month_start_date_key" UNIQUE ("shop_id", "month_start_date");



ALTER TABLE ONLY "public"."districts"
    ADD CONSTRAINT "districts_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."districts"
    ADD CONSTRAINT "districts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dm_logbook"
    ADD CONSTRAINT "dm_logbook_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dm_schedule"
    ADD CONSTRAINT "dm_schedule_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."employee_challenge_logs"
    ADD CONSTRAINT "employee_challenge_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."employee_challenges"
    ADD CONSTRAINT "employee_challenges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."employee_coaching"
    ADD CONSTRAINT "employee_coaching_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."employee_development"
    ADD CONSTRAINT "employee_development_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."employee_goals"
    ADD CONSTRAINT "employee_goals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."employee_hours_tracking"
    ADD CONSTRAINT "employee_hours_tracking_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."employee_hours_tracking"
    ADD CONSTRAINT "employee_hours_tracking_shop_id_staff_id_date_key" UNIQUE ("shop_id", "staff_id", "date");



ALTER TABLE ONLY "public"."employee_kpis"
    ADD CONSTRAINT "employee_kpis_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."employee_kpis"
    ADD CONSTRAINT "employee_kpis_shop_id_staff_id_week_start_date_key" UNIQUE ("shop_id", "staff_id", "week_start");



ALTER TABLE ONLY "public"."employee_kpis"
    ADD CONSTRAINT "employee_kpis_workday_employee_id_week_start_key" UNIQUE ("workday_employee_id", "week_start");



ALTER TABLE ONLY "public"."employee_logbook"
    ADD CONSTRAINT "employee_logbook_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."employee_master_logs"
    ADD CONSTRAINT "employee_master_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."employee_meetings"
    ADD CONSTRAINT "employee_meetings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."employee_schedules"
    ADD CONSTRAINT "employee_schedules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."employee_schedules"
    ADD CONSTRAINT "employee_schedules_staff_id_week_start_date_key" UNIQUE ("staff_id", "week_start_date");



ALTER TABLE ONLY "public"."employee_service_certifications"
    ADD CONSTRAINT "employee_service_certifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."employee_service_certifications"
    ADD CONSTRAINT "employee_service_certifications_staff_id_service_type_key" UNIQUE ("staff_id", "service_type");



ALTER TABLE ONLY "public"."employee_shifts"
    ADD CONSTRAINT "employee_shifts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."employee_shifts"
    ADD CONSTRAINT "employee_shifts_shop_id_employee_id_date_key" UNIQUE ("shop_id", "employee_id", "date");



ALTER TABLE ONLY "public"."employee_training"
    ADD CONSTRAINT "employee_training_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."employee_training"
    ADD CONSTRAINT "employee_training_staff_id_key" UNIQUE ("staff_id");



ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."equipment_check_logs"
    ADD CONSTRAINT "equipment_check_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."equipment_check_selections"
    ADD CONSTRAINT "equipment_check_selections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."equipment_check_selections"
    ADD CONSTRAINT "equipment_check_selections_shop_id_checklist_item_id_key" UNIQUE ("shop_id", "checklist_item_id");



ALTER TABLE ONLY "public"."export_snapshots"
    ADD CONSTRAINT "export_snapshots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fleet_accounts"
    ADD CONSTRAINT "fleet_accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."game_decks"
    ADD CONSTRAINT "game_decks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."game_leaderboard"
    ADD CONSTRAINT "game_leaderboard_pkey" PRIMARY KEY ("shop_id", "user_id");



ALTER TABLE ONLY "public"."game_results"
    ADD CONSTRAINT "game_results_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."game_runs"
    ADD CONSTRAINT "game_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."import_logs"
    ADD CONSTRAINT "import_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_categories"
    ADD CONSTRAINT "inventory_categories_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."inventory_counts"
    ADD CONSTRAINT "inventory_counts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_counts"
    ADD CONSTRAINT "inventory_counts_shop_id_count_date_item_id_key" UNIQUE ("shop_id", "count_date", "item_id");



ALTER TABLE ONLY "public"."inventory_counts_v2"
    ADD CONSTRAINT "inventory_counts_v2_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_counts_v2"
    ADD CONSTRAINT "inventory_counts_v2_shop_id_item_number_category_count_date_key" UNIQUE ("shop_id", "item_number", "category", "count_date");



ALTER TABLE ONLY "public"."inventory_export_history"
    ADD CONSTRAINT "inventory_export_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_export_logs"
    ADD CONSTRAINT "inventory_export_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_items"
    ADD CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_staging"
    ADD CONSTRAINT "inventory_staging_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invoice_items"
    ADD CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."item_numbers"
    ADD CONSTRAINT "item_numbers_item_number_key" UNIQUE ("item_number");



ALTER TABLE ONLY "public"."item_numbers"
    ADD CONSTRAINT "item_numbers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kpi_goals"
    ADD CONSTRAINT "kpi_goals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kpi_imports"
    ADD CONSTRAINT "kpi_imports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kpi_projections"
    ADD CONSTRAINT "kpi_projections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."labor_staff_entries"
    ADD CONSTRAINT "labor_staff_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."labor_tracking"
    ADD CONSTRAINT "labor_tracking_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."labor_tracking"
    ADD CONSTRAINT "labor_tracking_shop_id_date_key" UNIQUE ("shop_id", "date");



ALTER TABLE ONLY "public"."manager_challenges"
    ADD CONSTRAINT "manager_challenges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."master-inventory-list 10.25.25"
    ADD CONSTRAINT "master-inventory-list 10.25.25_pkey" PRIMARY KEY ("itemNumber");



ALTER TABLE ONLY "public"."master-inventory-list"
    ADD CONSTRAINT "master-inventory-list_pkey" PRIMARY KEY ("itemNumber");



ALTER TABLE ONLY "public"."master_checklist_items"
    ADD CONSTRAINT "master_checklist_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."master_checklist_reports"
    ADD CONSTRAINT "master_checklist_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."master_checklist_responses"
    ADD CONSTRAINT "master_checklist_responses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."master_inventory_list"
    ADD CONSTRAINT "master_inventory_list_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."master_inventory_list"
    ADD CONSTRAINT "master_inventory_list_sku_key" UNIQUE ("sku");



ALTER TABLE ONLY "public"."master_items"
    ADD CONSTRAINT "master_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."master_items"
    ADD CONSTRAINT "master_items_sku_key" UNIQUE ("sku");



ALTER TABLE ONLY "public"."master_products"
    ADD CONSTRAINT "master_products_category_item_number_key" UNIQUE ("category", "item_number");



ALTER TABLE ONLY "public"."master_products"
    ADD CONSTRAINT "master_products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."micro_challenges"
    ADD CONSTRAINT "micro_challenges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mod_challenges"
    ADD CONSTRAINT "mod_challenges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."opening_closing_checklists"
    ADD CONSTRAINT "opening_closing_checklists_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."performance_reviews"
    ADD CONSTRAINT "performance_reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kpi_daily"
    ADD CONSTRAINT "pk_kpi_daily" PRIMARY KEY ("shop_id", "date_key");



ALTER TABLE ONLY "public"."pos_button_color_palette"
    ADD CONSTRAINT "pos_button_color_palette_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pos_button_groups"
    ADD CONSTRAINT "pos_button_groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pos_buttons"
    ADD CONSTRAINT "pos_buttons_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pos_nested_buttons"
    ADD CONSTRAINT "pos_nested_buttons_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."price_list"
    ADD CONSTRAINT "price_list_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."refunds"
    ADD CONSTRAINT "refunds_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."regions"
    ADD CONSTRAINT "regions_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."regions"
    ADD CONSTRAINT "regions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."repair_requests"
    ADD CONSTRAINT "repair_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."repairs_maintenance_log"
    ADD CONSTRAINT "repairs_maintenance_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."retail_calendar"
    ADD CONSTRAINT "retail_calendar_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."retail_calendar"
    ADD CONSTRAINT "retail_calendar_year_period_no_key" UNIQUE ("year", "period_no");



ALTER TABLE ONLY "public"."service_catalog"
    ADD CONSTRAINT "service_catalog_pkey" PRIMARY KEY ("item_slug");



ALTER TABLE ONLY "public"."shop_alignment"
    ADD CONSTRAINT "shop_alignment_pkey" PRIMARY KEY ("shop");



ALTER TABLE ONLY "public"."shop_catalog"
    ADD CONSTRAINT "shop_catalog_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shop_catalog"
    ADD CONSTRAINT "shop_catalog_shop_id_item_number_category_key" UNIQUE ("shop_id", "item_number", "category");



ALTER TABLE ONLY "public"."shop_categories"
    ADD CONSTRAINT "shop_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shop_checkbook_entries"
    ADD CONSTRAINT "shop_checkbook_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shop_count_sheet_items"
    ADD CONSTRAINT "shop_count_sheet_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shop_count_sheet_items"
    ADD CONSTRAINT "shop_count_sheet_items_sheet_id_product_id_key" UNIQUE ("sheet_id", "product_id");



ALTER TABLE ONLY "public"."shop_count_sheets"
    ADD CONSTRAINT "shop_count_sheets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shop_inventory_items"
    ADD CONSTRAINT "shop_inventory_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shop_inventory_items"
    ADD CONSTRAINT "shop_inventory_items_shop_id_itemnumber_key" UNIQUE ("shop_id", "itemnumber");



ALTER TABLE ONLY "public"."shop_inventory_profile"
    ADD CONSTRAINT "shop_inventory_profile_pkey" PRIMARY KEY ("shop_id");



ALTER TABLE ONLY "public"."shop_master_products"
    ADD CONSTRAINT "shop_master_products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shop_master_products"
    ADD CONSTRAINT "shop_master_products_shop_id_sku_key" UNIQUE ("shop_id", "sku");



ALTER TABLE ONLY "public"."shop_overrides"
    ADD CONSTRAINT "shop_overrides_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shop_overrides"
    ADD CONSTRAINT "shop_overrides_shop_id_sku_key" UNIQUE ("shop_id", "sku");



ALTER TABLE ONLY "public"."shop_staff"
    ADD CONSTRAINT "shop_staff_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shop_workbook_entries"
    ADD CONSTRAINT "shop_workbook_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shop_workbook_entries"
    ADD CONSTRAINT "shop_workbook_entries_shop_id_date_vendor_key" UNIQUE ("shop_id", "date", "vendor");



ALTER TABLE ONLY "public"."shops"
    ADD CONSTRAINT "shops_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shops"
    ADD CONSTRAINT "shops_shop_code_key" UNIQUE ("shop_code");



ALTER TABLE ONLY "public"."shops"
    ADD CONSTRAINT "shops_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."solink_audits"
    ADD CONSTRAINT "solink_audits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."speed_training_leaderboard"
    ADD CONSTRAINT "speed_training_leaderboard_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."speed_training_leaderboard"
    ADD CONSTRAINT "speed_training_leaderboard_shop_id_user_id_difficulty_key" UNIQUE ("shop_id", "user_id", "difficulty");



ALTER TABLE ONLY "public"."speed_training_runs"
    ADD CONSTRAINT "speed_training_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."spif_tracker"
    ADD CONSTRAINT "spif_tracker_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."spiff_gain_loss_tracking"
    ADD CONSTRAINT "spiff_gain_loss_tracking_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."supply_ordering_log"
    ADD CONSTRAINT "supply_ordering_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."supply_orders"
    ADD CONSTRAINT "supply_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."termed_employees"
    ADD CONSTRAINT "termed_employees_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."turned_log_daily_counts"
    ADD CONSTRAINT "turned_log_daily_counts_pkey" PRIMARY KEY ("shop_id", "day");



ALTER TABLE ONLY "public"."turned_logs"
    ADD CONSTRAINT "turned_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."upload_logs"
    ADD CONSTRAINT "upload_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kpi_goals"
    ADD CONSTRAINT "uq_kpi_goals_shop_scope_key" UNIQUE ("shop_id", "scope", "date_key", "period_id");



ALTER TABLE ONLY "public"."vin_decode_cache"
    ADD CONSTRAINT "vin_decode_cache_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vin_decode_cache"
    ADD CONSTRAINT "vin_decode_cache_vin_key" UNIQUE ("vin");



ALTER TABLE ONLY "public"."weekly_projections"
    ADD CONSTRAINT "weekly_projections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."weekly_projections"
    ADD CONSTRAINT "weekly_projections_shop_id_week_start_date_key" UNIQUE ("shop_id", "week_start_date");



ALTER TABLE ONLY "public"."weekly_sales_data"
    ADD CONSTRAINT "weekly_sales_data_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."weekly_sales_data"
    ADD CONSTRAINT "weekly_sales_data_shop_id_week_start_date_key" UNIQUE ("shop_id", "week_start_date");



ALTER TABLE ONLY "public"."work_calendar_config"
    ADD CONSTRAINT "work_calendar_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."work_calendar_config"
    ADD CONSTRAINT "work_calendar_config_year_quarter_period_key" UNIQUE ("year", "quarter", "period");



ALTER TABLE ONLY "public"."workbook_categories"
    ADD CONSTRAINT "workbook_categories_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."workbook_categories"
    ADD CONSTRAINT "workbook_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workbook_entries"
    ADD CONSTRAINT "workbook_entries_pkey" PRIMARY KEY ("id");



CREATE INDEX "ai_scanned_items_scanned_at_idx" ON "public"."ai_scanned_items" USING "btree" ("scanned_at" DESC);



CREATE INDEX "ai_scanned_items_shop_id_idx" ON "public"."ai_scanned_items" USING "btree" ("shop_id");



CREATE INDEX "ai_scanned_items_status_idx" ON "public"."ai_scanned_items" USING "btree" ("status");



CREATE INDEX "crew_challenges_shop_id_date_idx" ON "public"."crew_challenges" USING "btree" ("shop_id", "date");



CREATE INDEX "daily_cadence_period_idx" ON "public"."daily_cadence" USING "btree" ("period");



CREATE INDEX "daily_cadence_shop_id_date_idx" ON "public"."daily_cadence" USING "btree" ("shop_id", "date");



CREATE INDEX "game_results_deck_id_idx" ON "public"."game_results" USING "btree" ("deck_id");



CREATE INDEX "game_results_started_at_idx" ON "public"."game_results" USING "btree" ("started_at" DESC);



CREATE INDEX "idx_app_settings_key" ON "public"."app_settings" USING "btree" ("key");



CREATE INDEX "idx_budgets_month" ON "public"."budgets" USING "btree" ("month");



CREATE INDEX "idx_budgets_shop_id" ON "public"."budgets" USING "btree" ("shop_id");



CREATE INDEX "idx_categories_name" ON "public"."categories" USING "btree" ("name");



CREATE INDEX "idx_challenges_log_created_at" ON "public"."challenges_log" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_challenges_log_employee_name" ON "public"."challenges_log" USING "btree" ("employee_name");



CREATE INDEX "idx_challenges_log_expires_at" ON "public"."challenges_log" USING "btree" ("expires_at");



CREATE INDEX "idx_challenges_log_shop_id" ON "public"."challenges_log" USING "btree" ("shop_id");



CREATE INDEX "idx_checkbook_monthly_shop_date" ON "public"."daily_checkbook_monthly_totals" USING "btree" ("shop_id", "month_start_date");



CREATE INDEX "idx_claims_claim_type" ON "public"."claims" USING "btree" ("claim_type");



CREATE INDEX "idx_claims_created_at" ON "public"."claims" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_claims_log_expires_at" ON "public"."claims_log" USING "btree" ("expires_at");



CREATE INDEX "idx_claims_log_shop_id" ON "public"."claims_log" USING "btree" ("shop_id");



CREATE INDEX "idx_claims_log_submitted_at" ON "public"."claims_log" USING "btree" ("submitted_at" DESC);



CREATE INDEX "idx_claims_shop_id" ON "public"."claims" USING "btree" ("shop_id");



CREATE INDEX "idx_claims_shop_status" ON "public"."claims" USING "btree" ("shop_id", "status");



CREATE INDEX "idx_coaching_logs_coached_at" ON "public"."coaching_logs" USING "btree" ("coached_at");



CREATE INDEX "idx_coaching_logs_expires_at" ON "public"."coaching_logs" USING "btree" ("expires_at");



CREATE INDEX "idx_coaching_logs_shop_id" ON "public"."coaching_logs" USING "btree" ("shop_id");



CREATE INDEX "idx_crash_kit_customers_shop" ON "public"."crash_kit_customers" USING "btree" ("shop_id");



CREATE INDEX "idx_crash_kit_invoices_invoice_number" ON "public"."crash_kit_invoices" USING "btree" ("invoice_number");



CREATE INDEX "idx_crash_kit_invoices_shop_created" ON "public"."crash_kit_invoices" USING "btree" ("shop_id", "created_at" DESC);



CREATE INDEX "idx_crash_kit_invoices_vin" ON "public"."crash_kit_invoices" USING "btree" ("vin");



CREATE INDEX "idx_crash_kit_logbook_shop_date" ON "public"."crash_kit_logbook" USING "btree" ("shop_id", "log_date" DESC);



CREATE INDEX "idx_crash_kit_offline_queue_status" ON "public"."crash_kit_offline_queue" USING "btree" ("sync_status", "created_at");



CREATE INDEX "idx_crash_kit_products_category" ON "public"."crash_kit_products" USING "btree" ("category", "display_order");



CREATE INDEX "idx_crash_kit_vehicles_customer" ON "public"."crash_kit_vehicles" USING "btree" ("customer_id");



CREATE INDEX "idx_crash_kit_vehicles_shop" ON "public"."crash_kit_vehicles" USING "btree" ("shop_id");



CREATE INDEX "idx_crew_challenges_date" ON "public"."crew_challenges" USING "btree" ("date");



CREATE INDEX "idx_crew_challenges_shop_date" ON "public"."crew_challenges" USING "btree" ("shop_id", "date" DESC);



CREATE INDEX "idx_crew_challenges_shop_id" ON "public"."crew_challenges" USING "btree" ("shop_id");



CREATE INDEX "idx_daily_cadence_date" ON "public"."daily_cadence" USING "btree" ("date");



CREATE INDEX "idx_daily_cadence_day_shop" ON "public"."daily_cadence" USING "btree" ("shop_id", "day_of_week", "date");



CREATE INDEX "idx_daily_cadence_shop_id" ON "public"."daily_cadence" USING "btree" ("shop_id");



CREATE INDEX "idx_daily_logbook_close_shop_date" ON "public"."daily_logbook_close" USING "btree" ("shop_id", "report_date" DESC);



CREATE INDEX "idx_daily_logbook_created_at_desc" ON "public"."daily_logbook" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_daily_logbook_entries_shop_date" ON "public"."daily_logbook_entries" USING "btree" ("shop_id", "report_date" DESC);



CREATE INDEX "idx_daily_logbook_entries_type" ON "public"."daily_logbook_entries" USING "btree" ("entry_type");



CREATE INDEX "idx_daily_logbook_shop_date" ON "public"."daily_logbook" USING "btree" ("shop_id", "happened_at" DESC);



CREATE INDEX "idx_daily_logbook_source" ON "public"."daily_logbook" USING "btree" ("source");



CREATE INDEX "idx_daily_sales_entries_shop_date" ON "public"."daily_sales_entries" USING "btree" ("shop_id", "date" DESC);



CREATE INDEX "idx_daily_sales_period_week" ON "public"."daily_sales_entries" USING "btree" ("period_no", "week_in_period");



CREATE INDEX "idx_daily_sales_shop_date" ON "public"."daily_sales_entries" USING "btree" ("shop_id", "date" DESC);



COMMENT ON INDEX "public"."idx_daily_sales_shop_date" IS 'Batch 9: Speeds up daily sales queries for reports';



CREATE INDEX "idx_daily_summary_reports_report_date" ON "public"."daily_summary_reports" USING "btree" ("report_date");



CREATE INDEX "idx_daily_summary_reports_shop_id" ON "public"."daily_summary_reports" USING "btree" ("shop_id");



CREATE INDEX "idx_daily_summary_reports_status" ON "public"."daily_summary_reports" USING "btree" ("status");



CREATE INDEX "idx_daily_summary_shop_date" ON "public"."daily_summary_reports" USING "btree" ("shop_id", "report_date" DESC);



CREATE INDEX "idx_dm_logbook_log_date" ON "public"."dm_logbook" USING "btree" ("log_date");



CREATE INDEX "idx_dm_logbook_log_type" ON "public"."dm_logbook" USING "btree" ("log_type");



CREATE INDEX "idx_dm_logbook_shop_id" ON "public"."dm_logbook" USING "btree" ("shop_id");



CREATE INDEX "idx_dm_schedule_date" ON "public"."dm_schedule" USING "btree" ("date");



CREATE INDEX "idx_dm_schedule_dm_id_date" ON "public"."dm_schedule" USING "btree" ("dm_id", "date");



CREATE INDEX "idx_dm_schedule_location_id" ON "public"."dm_schedule" USING "btree" ("location_id");



CREATE INDEX "idx_employee_challenge_logs_challenge_log_id" ON "public"."employee_challenge_logs" USING "btree" ("challenge_log_id");



CREATE INDEX "idx_employee_challenge_logs_staff_id" ON "public"."employee_challenge_logs" USING "btree" ("staff_id");



CREATE INDEX "idx_employee_challenges_date" ON "public"."employee_challenges" USING "btree" ("date");



CREATE INDEX "idx_employee_challenges_shop_date" ON "public"."employee_challenges" USING "btree" ("shop_id", "date");



CREATE INDEX "idx_employee_challenges_shop_id" ON "public"."employee_challenges" USING "btree" ("shop_id");



CREATE INDEX "idx_employee_coaching_emp" ON "public"."employee_coaching" USING "btree" ("employee_id", "created_at" DESC);



CREATE INDEX "idx_employee_development_shop_id" ON "public"."employee_development" USING "btree" ("shop_id");



CREATE INDEX "idx_employee_development_staff_id" ON "public"."employee_development" USING "btree" ("staff_id");



CREATE INDEX "idx_employee_hours_shop_date" ON "public"."employee_hours_tracking" USING "btree" ("shop_id", "date");



CREATE INDEX "idx_employee_hours_staff_week" ON "public"."employee_hours_tracking" USING "btree" ("staff_id", "week_start_date");



CREATE INDEX "idx_employee_kpis_workday_employee_id_week_start" ON "public"."employee_kpis" USING "btree" ("workday_employee_id", "week_start");



CREATE INDEX "idx_employee_logbook_emp" ON "public"."employee_logbook" USING "btree" ("employee_id", "created_at" DESC);



CREATE INDEX "idx_employee_master_logs_log_date" ON "public"."employee_master_logs" USING "btree" ("log_date" DESC);



CREATE INDEX "idx_employee_master_logs_log_type" ON "public"."employee_master_logs" USING "btree" ("log_type");



CREATE INDEX "idx_employee_master_logs_shop_id" ON "public"."employee_master_logs" USING "btree" ("shop_id");



CREATE INDEX "idx_employee_master_logs_staff_id" ON "public"."employee_master_logs" USING "btree" ("staff_id");



CREATE INDEX "idx_employee_meetings_date" ON "public"."employee_meetings" USING "btree" ("meeting_date" DESC);



CREATE INDEX "idx_employee_meetings_shop_id" ON "public"."employee_meetings" USING "btree" ("shop_id");



CREATE INDEX "idx_employee_schedules_shop_id" ON "public"."employee_schedules" USING "btree" ("shop_id");



CREATE INDEX "idx_employee_schedules_staff_id" ON "public"."employee_schedules" USING "btree" ("staff_id");



CREATE INDEX "idx_employee_schedules_week_start" ON "public"."employee_schedules" USING "btree" ("week_start_date");



CREATE INDEX "idx_employee_service_certifications_shop_id" ON "public"."employee_service_certifications" USING "btree" ("shop_id");



CREATE INDEX "idx_employee_service_certifications_staff_id" ON "public"."employee_service_certifications" USING "btree" ("staff_id");



CREATE INDEX "idx_employee_shifts_employee" ON "public"."employee_shifts" USING "btree" ("employee_id");



CREATE INDEX "idx_employee_shifts_shop_date" ON "public"."employee_shifts" USING "btree" ("shop_id", "date");



CREATE INDEX "idx_employee_training_shop_id" ON "public"."employee_training" USING "btree" ("shop_id");



CREATE INDEX "idx_employee_training_staff_id" ON "public"."employee_training" USING "btree" ("staff_id");



CREATE INDEX "idx_equipment_check_logs_date" ON "public"."equipment_check_logs" USING "btree" ("date");



CREATE INDEX "idx_equipment_check_logs_shop_id" ON "public"."equipment_check_logs" USING "btree" ("shop_id");



CREATE INDEX "idx_equipment_check_selections_shop_id" ON "public"."equipment_check_selections" USING "btree" ("shop_id");



CREATE INDEX "idx_export_snapshots_export_date" ON "public"."export_snapshots" USING "btree" ("export_date" DESC);



CREATE INDEX "idx_fleet_accounts_invoice_id" ON "public"."fleet_accounts" USING "btree" ("invoice_id");



CREATE INDEX "idx_fleet_accounts_shop_id" ON "public"."fleet_accounts" USING "btree" ("shop_id");



CREATE INDEX "idx_game_leaderboard_best_score" ON "public"."game_leaderboard" USING "btree" ("best_score" DESC);



CREATE INDEX "idx_game_leaderboard_shop_id" ON "public"."game_leaderboard" USING "btree" ("shop_id");



CREATE INDEX "idx_game_runs_shop_id" ON "public"."game_runs" USING "btree" ("shop_id");



CREATE INDEX "idx_game_runs_started_at" ON "public"."game_runs" USING "btree" ("started_at" DESC);



CREATE INDEX "idx_game_runs_user_id" ON "public"."game_runs" USING "btree" ("user_id");



CREATE INDEX "idx_inventory_counts_category" ON "public"."inventory_counts" USING "btree" ("category");



CREATE INDEX "idx_inventory_counts_count_date" ON "public"."inventory_counts" USING "btree" ("count_date");



CREATE INDEX "idx_inventory_counts_item" ON "public"."inventory_counts" USING "btree" ("item_id");



CREATE INDEX "idx_inventory_counts_item_id" ON "public"."inventory_counts" USING "btree" ("item_id");



CREATE INDEX "idx_inventory_counts_shop_category_date" ON "public"."inventory_counts" USING "btree" ("shop_id", "category", "count_date");



CREATE INDEX "idx_inventory_counts_shop_date" ON "public"."inventory_counts" USING "btree" ("shop_id", "count_date");



CREATE INDEX "idx_inventory_counts_shop_id" ON "public"."inventory_counts" USING "btree" ("shop_id");



CREATE INDEX "idx_inventory_counts_v2_category" ON "public"."inventory_counts_v2" USING "btree" ("shop_id", "category", "count_date");



CREATE INDEX "idx_inventory_counts_v2_shop_date" ON "public"."inventory_counts_v2" USING "btree" ("shop_id", "count_date");



CREATE INDEX "idx_inventory_export_logs_shop_date" ON "public"."inventory_export_logs" USING "btree" ("shop_id", "exported_at" DESC);



CREATE INDEX "idx_inventory_items_cat" ON "public"."inventory_items" USING "btree" ("category");



CREATE INDEX "idx_inventory_items_item" ON "public"."inventory_items" USING "btree" ("itemnumber");



CREATE INDEX "idx_item_numbers_category" ON "public"."item_numbers" USING "btree" ("category");



CREATE INDEX "idx_item_numbers_item_number" ON "public"."item_numbers" USING "btree" ("item_number");



CREATE INDEX "idx_kpi_daily_date_key" ON "public"."kpi_daily" USING "btree" ("date_key" DESC);



CREATE INDEX "idx_kpi_daily_shop_date" ON "public"."kpi_daily" USING "btree" ("shop_id", "date_key" DESC);



CREATE INDEX "idx_kpi_daily_shop_id" ON "public"."kpi_daily" USING "btree" ("shop_id");



CREATE INDEX "idx_kpi_goals_date_key" ON "public"."kpi_goals" USING "btree" ("date_key") WHERE ("date_key" IS NOT NULL);



CREATE INDEX "idx_kpi_goals_period_id" ON "public"."kpi_goals" USING "btree" ("period_id") WHERE ("period_id" IS NOT NULL);



CREATE INDEX "idx_kpi_goals_scope" ON "public"."kpi_goals" USING "btree" ("scope");



CREATE INDEX "idx_kpi_goals_shop_id" ON "public"."kpi_goals" USING "btree" ("shop_id");



CREATE INDEX "idx_kpi_imports_imported_at" ON "public"."kpi_imports" USING "btree" ("imported_at" DESC);



CREATE INDEX "idx_kpi_imports_shop_id" ON "public"."kpi_imports" USING "btree" ("shop_id");



CREATE INDEX "idx_kpi_projections_shop_period" ON "public"."kpi_projections" USING "btree" ("shop_id", "period_no", "week_in_period");



CREATE INDEX "idx_labor_staff_entries_shop_date" ON "public"."labor_staff_entries" USING "btree" ("shop_id", "date");



CREATE INDEX "idx_labor_tracking_date" ON "public"."labor_tracking" USING "btree" ("date");



CREATE INDEX "idx_labor_tracking_shop_id" ON "public"."labor_tracking" USING "btree" ("shop_id");



CREATE INDEX "idx_manager_challenges_date" ON "public"."manager_challenges" USING "btree" ("date");



CREATE INDEX "idx_manager_challenges_shop_date" ON "public"."manager_challenges" USING "btree" ("shop_id", "date" DESC);



CREATE INDEX "idx_manager_challenges_shop_id" ON "public"."manager_challenges" USING "btree" ("shop_id");



CREATE INDEX "idx_manager_challenges_shop_number" ON "public"."manager_challenges" USING "btree" ("shop_number", "date" DESC);



CREATE INDEX "idx_master_checklist_items_active" ON "public"."master_checklist_items" USING "btree" ("is_active");



CREATE INDEX "idx_master_checklist_items_shop_id" ON "public"."master_checklist_items" USING "btree" ("shop_id");



CREATE INDEX "idx_master_checklist_reports_shop_date" ON "public"."master_checklist_reports" USING "btree" ("shop_id", "date");



CREATE INDEX "idx_master_checklist_responses_date" ON "public"."master_checklist_responses" USING "btree" ("date");



CREATE INDEX "idx_master_checklist_responses_item" ON "public"."master_checklist_responses" USING "btree" ("checklist_item_id");



CREATE INDEX "idx_master_checklist_responses_shop_date" ON "public"."master_checklist_responses" USING "btree" ("shop_id", "date");



CREATE INDEX "idx_master_checklist_responses_shop_id" ON "public"."master_checklist_responses" USING "btree" ("shop_id");



CREATE INDEX "idx_master_inventory_list_active" ON "public"."master_inventory_list" USING "btree" ("active");



CREATE INDEX "idx_master_inventory_list_sku" ON "public"."master_inventory_list" USING "btree" ("sku");



CREATE INDEX "idx_master_items_cat" ON "public"."master_items" USING "btree" ("category_code");



CREATE INDEX "idx_master_products_category" ON "public"."master_products" USING "btree" ("category");



CREATE INDEX "idx_master_products_category_active" ON "public"."master_products" USING "btree" ("category", "is_active");



CREATE INDEX "idx_master_products_item_number" ON "public"."master_products" USING "btree" ("item_number");



CREATE INDEX "idx_micro_challenges_shop_date" ON "public"."micro_challenges" USING "btree" ("shop_id", "date");



CREATE INDEX "idx_micro_challenges_type" ON "public"."micro_challenges" USING "btree" ("challenge_type");



CREATE INDEX "idx_mod_challenges_shop_date" ON "public"."mod_challenges" USING "btree" ("shop_id", "date");



CREATE INDEX "idx_opening_closing_checklists_shop_date_type" ON "public"."opening_closing_checklists" USING "btree" ("shop_id", "date", "checklist_type");



CREATE INDEX "idx_overrides_cat" ON "public"."shop_overrides" USING "btree" ("category_code");



CREATE INDEX "idx_overrides_shop" ON "public"."shop_overrides" USING "btree" ("shop_id");



CREATE INDEX "idx_pos_buttons_parent_button_id" ON "public"."pos_buttons" USING "btree" ("parent_button_id");



CREATE INDEX "idx_pos_buttons_shop_id_active" ON "public"."pos_buttons" USING "btree" ("shop_id", "is_active") WHERE ("parent_button_id" IS NULL);



CREATE INDEX "idx_pos_nested_buttons_parent" ON "public"."pos_nested_buttons" USING "btree" ("parent_button_id");



CREATE INDEX "idx_price_active_from" ON "public"."price_list" USING "btree" ("item_slug", "active", "price_effective_from" DESC);



CREATE INDEX "idx_profiles_district_id" ON "public"."profiles" USING "btree" ("district_id");



CREATE INDEX "idx_profiles_region_id" ON "public"."profiles" USING "btree" ("region_id");



CREATE INDEX "idx_profiles_role" ON "public"."profiles" USING "btree" ("role");



CREATE INDEX "idx_profiles_shop_id" ON "public"."profiles" USING "btree" ("shop_id");



CREATE INDEX "idx_profiles_store_number" ON "public"."profiles" USING "btree" ("store_number");



CREATE INDEX "idx_profiles_user_id" ON "public"."profiles" USING "btree" ("user_id");



CREATE INDEX "idx_refunds_created_at" ON "public"."refunds" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_refunds_shop_id" ON "public"."refunds" USING "btree" ("shop_id");



CREATE INDEX "idx_refunds_status" ON "public"."refunds" USING "btree" ("status");



CREATE INDEX "idx_repair_requests_shop_created" ON "public"."repair_requests" USING "btree" ("shop_id", "created_at" DESC);



CREATE INDEX "idx_repair_requests_shop_id" ON "public"."repair_requests" USING "btree" ("shop_id");



CREATE INDEX "idx_repair_requests_shop_status" ON "public"."repair_requests" USING "btree" ("shop_id", "status");



CREATE INDEX "idx_repair_requests_type" ON "public"."repair_requests" USING "btree" ("repair_type");



CREATE INDEX "idx_repairs_maintenance_log_building_id" ON "public"."repairs_maintenance_log" USING "btree" ("building_id");



CREATE INDEX "idx_repairs_maintenance_log_created_at" ON "public"."repairs_maintenance_log" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_repairs_maintenance_log_request_id" ON "public"."repairs_maintenance_log" USING "btree" ("request_id");



CREATE INDEX "idx_retail_calendar_dates" ON "public"."retail_calendar" USING "btree" ("start_date", "end_date");



CREATE INDEX "idx_retail_calendar_year_period" ON "public"."retail_calendar" USING "btree" ("year", "period_no");



CREATE INDEX "idx_sc_category_grade" ON "public"."service_catalog" USING "btree" ("category", "oil_type_grade");



CREATE INDEX "idx_sc_category_group_order" ON "public"."service_catalog" USING "btree" ("category", "menu_group", "display_order");



CREATE INDEX "idx_shop_alignment_district" ON "public"."shop_alignment" USING "btree" ("district");



CREATE INDEX "idx_shop_alignment_dm_email" ON "public"."shop_alignment" USING "btree" ("dm_email");



CREATE INDEX "idx_shop_alignment_rd_email" ON "public"."shop_alignment" USING "btree" ("rd_email");



CREATE INDEX "idx_shop_alignment_region" ON "public"."shop_alignment" USING "btree" ("region");



CREATE INDEX "idx_shop_alignment_shop" ON "public"."shop_alignment" USING "btree" ("shop");



CREATE INDEX "idx_shop_alignment_shop_email" ON "public"."shop_alignment" USING "btree" ("shop_email");



CREATE INDEX "idx_shop_catalog_active" ON "public"."shop_catalog" USING "btree" ("shop_id", "is_active");



CREATE INDEX "idx_shop_catalog_shop_category" ON "public"."shop_catalog" USING "btree" ("shop_id", "category");



CREATE INDEX "idx_shop_checkbook_period_week" ON "public"."shop_checkbook_entries" USING "btree" ("period_no", "week_in_period");



CREATE INDEX "idx_shop_checkbook_shop_date" ON "public"."shop_checkbook_entries" USING "btree" ("shop_id", "date" DESC);



CREATE INDEX "idx_shop_count_sheet_items_product_id" ON "public"."shop_count_sheet_items" USING "btree" ("product_id");



CREATE INDEX "idx_shop_count_sheet_items_sheet_id" ON "public"."shop_count_sheet_items" USING "btree" ("sheet_id");



CREATE INDEX "idx_shop_count_sheets_active" ON "public"."shop_count_sheets" USING "btree" ("is_active");



CREATE INDEX "idx_shop_count_sheets_shop_id" ON "public"."shop_count_sheets" USING "btree" ("shop_id");



CREATE INDEX "idx_shop_inv_item" ON "public"."shop_inventory_items" USING "btree" ("shop_id", "itemnumber");



CREATE INDEX "idx_shop_inv_shop" ON "public"."shop_inventory_items" USING "btree" ("shop_id");



CREATE INDEX "idx_shop_master_products_active" ON "public"."shop_master_products" USING "btree" ("active");



CREATE INDEX "idx_shop_master_products_shop_id" ON "public"."shop_master_products" USING "btree" ("shop_id");



CREATE INDEX "idx_shop_master_products_sku" ON "public"."shop_master_products" USING "btree" ("sku");



CREATE INDEX "idx_shop_staff_shop_id" ON "public"."shop_staff" USING "btree" ("shop_id");



CREATE INDEX "idx_shop_workbook_period_week" ON "public"."shop_workbook_entries" USING "btree" ("period_no", "week_in_period");



CREATE INDEX "idx_solink_audits_audit_day" ON "public"."solink_audits" USING "btree" ("audit_day");



CREATE INDEX "idx_solink_audits_generated_code" ON "public"."solink_audits" USING "btree" ("generated_code");



CREATE INDEX "idx_solink_audits_shop_id" ON "public"."solink_audits" USING "btree" ("shop_id");



CREATE INDEX "idx_speed_training_leaderboard_best_score" ON "public"."speed_training_leaderboard" USING "btree" ("best_score" DESC);



CREATE INDEX "idx_speed_training_leaderboard_difficulty" ON "public"."speed_training_leaderboard" USING "btree" ("difficulty");



CREATE INDEX "idx_speed_training_leaderboard_shop_id" ON "public"."speed_training_leaderboard" USING "btree" ("shop_id");



CREATE INDEX "idx_speed_training_runs_difficulty" ON "public"."speed_training_runs" USING "btree" ("difficulty");



CREATE INDEX "idx_speed_training_runs_shop_id" ON "public"."speed_training_runs" USING "btree" ("shop_id");



CREATE INDEX "idx_speed_training_runs_user_id" ON "public"."speed_training_runs" USING "btree" ("user_id");



CREATE INDEX "idx_spif_tracker_employee" ON "public"."spif_tracker" USING "btree" ("employee_name");



CREATE INDEX "idx_spif_tracker_shop_date" ON "public"."spif_tracker" USING "btree" ("shop_id", "date" DESC);



CREATE INDEX "idx_spiff_gain_loss_shop_date" ON "public"."spiff_gain_loss_tracking" USING "btree" ("shop_id", "date" DESC);



CREATE INDEX "idx_supply_ordering_log_created_at" ON "public"."supply_ordering_log" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_supply_ordering_log_expires_at" ON "public"."supply_ordering_log" USING "btree" ("expires_at");



CREATE INDEX "idx_supply_ordering_log_shop_id" ON "public"."supply_ordering_log" USING "btree" ("shop_id");



CREATE INDEX "idx_supply_orders_order_date" ON "public"."supply_orders" USING "btree" ("order_date" DESC);



CREATE INDEX "idx_supply_orders_shop_id" ON "public"."supply_orders" USING "btree" ("shop_id");



CREATE INDEX "idx_termed_employees_date" ON "public"."termed_employees" USING "btree" ("date_of_termination");



CREATE INDEX "idx_termed_employees_shop_id" ON "public"."termed_employees" USING "btree" ("shop_id");



CREATE INDEX "idx_turned_logs_created_at_desc" ON "public"."turned_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_turned_logs_shop_created" ON "public"."turned_logs" USING "btree" ("shop_id", "created_at" DESC);



CREATE INDEX "idx_turned_logs_shop_date" ON "public"."turned_logs" USING "btree" ("shop_id", "turned_at" DESC);



CREATE INDEX "idx_turned_logs_shop_turned_at" ON "public"."turned_logs" USING "btree" ("shop_id", "turned_at" DESC);



CREATE INDEX "idx_turned_logs_user_created" ON "public"."turned_logs" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_upload_logs_timestamp" ON "public"."upload_logs" USING "btree" ("timestamp" DESC);



CREATE INDEX "idx_vin_decode_cache_vin" ON "public"."vin_decode_cache" USING "btree" ("vin");



CREATE INDEX "idx_work_calendar_config_date" ON "public"."work_calendar_config" USING "btree" ("week_start_date");



CREATE INDEX "idx_work_calendar_config_year_quarter" ON "public"."work_calendar_config" USING "btree" ("year", "quarter");



CREATE INDEX "idx_workbook_entries_created_by" ON "public"."workbook_entries" USING "btree" ("created_by");



CREATE INDEX "idx_workbook_entries_entry_date" ON "public"."workbook_entries" USING "btree" ("entry_date");



CREATE INDEX "idx_workbook_entries_period_week" ON "public"."workbook_entries" USING "btree" ("period_no", "week_in_period");



CREATE INDEX "idx_workbook_entries_shop_id" ON "public"."workbook_entries" USING "btree" ("shop_id");



CREATE INDEX "idx_workbook_monthly_shop_date" ON "public"."daily_workbook_monthly_totals" USING "btree" ("shop_id", "month_start_date");



CREATE INDEX "repair_requests_created_at_idx" ON "public"."repair_requests" USING "btree" ("created_at" DESC);



CREATE INDEX "repair_requests_shop_id_idx" ON "public"."repair_requests" USING "btree" ("shop_id");



CREATE INDEX "shop_staff_shop_id_idx" ON "public"."shop_staff" USING "btree" ("shop_id");



CREATE OR REPLACE TRIGGER "count_sheet_items_last_modified" BEFORE UPDATE ON "public"."shop_count_sheet_items" FOR EACH ROW EXECUTE FUNCTION "public"."update_count_sheet_items_last_modified"();



CREATE OR REPLACE TRIGGER "dm_schedule_updated_at" BEFORE UPDATE ON "public"."dm_schedule" FOR EACH ROW EXECUTE FUNCTION "public"."update_dm_schedule_updated_at"();



CREATE OR REPLACE TRIGGER "shop_master_products_updated_at" BEFORE UPDATE ON "public"."shop_master_products" FOR EACH ROW EXECUTE FUNCTION "public"."update_shop_master_products_updated_at"();



CREATE OR REPLACE TRIGGER "shops_updated_at" BEFORE UPDATE ON "public"."shops" FOR EACH ROW EXECUTE FUNCTION "public"."update_shops_updated_at"();



CREATE OR REPLACE TRIGGER "trg_align_touch" BEFORE UPDATE ON "public"."alignment_master" FOR EACH ROW EXECUTE FUNCTION "public"."touch_alignment_updated"();



CREATE OR REPLACE TRIGGER "trg_daily_sales_retail_period" BEFORE INSERT OR UPDATE ON "public"."daily_sales_entries" FOR EACH ROW EXECUTE FUNCTION "public"."auto_tag_retail_period"();



CREATE OR REPLACE TRIGGER "trg_profiles_touch" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."touch_profiles_updated"();



CREATE OR REPLACE TRIGGER "trg_shop_checkbook_retail_period" BEFORE INSERT OR UPDATE ON "public"."shop_checkbook_entries" FOR EACH ROW EXECUTE FUNCTION "public"."auto_tag_retail_period"();



CREATE OR REPLACE TRIGGER "trg_shop_workbook_retail_period" BEFORE INSERT OR UPDATE ON "public"."shop_workbook_entries" FOR EACH ROW EXECUTE FUNCTION "public"."auto_tag_retail_period"();



CREATE OR REPLACE TRIGGER "trg_touch_master" BEFORE UPDATE ON "public"."master_items" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_touch_overrides" BEFORE UPDATE ON "public"."shop_overrides" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_workbook_entries_retail_period" BEFORE INSERT OR UPDATE ON "public"."workbook_entries" FOR EACH ROW EXECUTE FUNCTION "public"."auto_tag_retail_period"();



CREATE OR REPLACE TRIGGER "trigger_set_inventory_last_changed_on_insert" BEFORE INSERT ON "public"."inventory_counts" FOR EACH ROW EXECUTE FUNCTION "public"."set_inventory_last_changed_on_insert"();



CREATE OR REPLACE TRIGGER "trigger_turned_logs_updated_at" BEFORE UPDATE ON "public"."turned_logs" FOR EACH ROW EXECUTE FUNCTION "public"."update_turned_logs_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_update_claims_updated_at" BEFORE UPDATE ON "public"."claims" FOR EACH ROW EXECUTE FUNCTION "public"."update_claims_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_update_inventory_last_changed" BEFORE UPDATE ON "public"."inventory_counts" FOR EACH ROW EXECUTE FUNCTION "public"."update_inventory_last_changed"();



CREATE OR REPLACE TRIGGER "trigger_update_turned_log_daily_count" AFTER INSERT ON "public"."turned_logs" FOR EACH ROW EXECUTE FUNCTION "public"."update_turned_log_daily_count"();



CREATE OR REPLACE TRIGGER "update_categories_updated_at" BEFORE UPDATE ON "public"."categories" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_daily_log_config_updated_at" BEFORE UPDATE ON "public"."daily_log_config" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_daily_summary_reports_updated_at" BEFORE UPDATE ON "public"."daily_summary_reports" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_inventory_counts_v2_updated_at" BEFORE UPDATE ON "public"."inventory_counts_v2" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_opening_closing_checklists_updated_at" BEFORE UPDATE ON "public"."opening_closing_checklists" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_shop_catalog_updated_at" BEFORE UPDATE ON "public"."shop_catalog" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."ai_scanned_items"
    ADD CONSTRAINT "ai_scanned_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."budgets"
    ADD CONSTRAINT "budgets_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."workbook_categories"("id");



ALTER TABLE ONLY "public"."category_keywords"
    ADD CONSTRAINT "category_keywords_category_code_fkey" FOREIGN KEY ("category_code") REFERENCES "public"."inventory_categories"("code") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."claims_log"
    ADD CONSTRAINT "claims_log_claim_id_fkey" FOREIGN KEY ("claim_id") REFERENCES "public"."claims"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."claims_log"
    ADD CONSTRAINT "claims_log_refund_id_fkey" FOREIGN KEY ("refund_id") REFERENCES "public"."refunds"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."coaching_logs"
    ADD CONSTRAINT "coaching_logs_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."shop_staff"("id");



ALTER TABLE ONLY "public"."crash_kit_invoices"
    ADD CONSTRAINT "crash_kit_invoices_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."crash_kit_logbook"
    ADD CONSTRAINT "crash_kit_logbook_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."crash_kit_vehicles"
    ADD CONSTRAINT "crash_kit_vehicles_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."crash_kit_customers"("id");



ALTER TABLE ONLY "public"."daily_logbook_close"
    ADD CONSTRAINT "daily_logbook_close_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."daily_logbook"
    ADD CONSTRAINT "daily_logbook_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."dm_schedule"
    ADD CONSTRAINT "dm_schedule_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."dm_schedule"
    ADD CONSTRAINT "dm_schedule_dm_id_fkey" FOREIGN KEY ("dm_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employee_challenge_logs"
    ADD CONSTRAINT "employee_challenge_logs_challenge_log_id_fkey" FOREIGN KEY ("challenge_log_id") REFERENCES "public"."challenges_log"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employee_challenge_logs"
    ADD CONSTRAINT "employee_challenge_logs_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."shop_staff"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employee_coaching"
    ADD CONSTRAINT "employee_coaching_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."shop_staff"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employee_coaching"
    ADD CONSTRAINT "employee_coaching_manager_user_id_fkey" FOREIGN KEY ("manager_user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."employee_development"
    ADD CONSTRAINT "employee_development_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."shop_staff"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employee_goals"
    ADD CONSTRAINT "employee_goals_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."shop_staff"("id");



ALTER TABLE ONLY "public"."employee_hours_tracking"
    ADD CONSTRAINT "employee_hours_tracking_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."shop_staff"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employee_kpis"
    ADD CONSTRAINT "employee_kpis_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employee_kpis"
    ADD CONSTRAINT "employee_kpis_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."shop_staff"("id");



ALTER TABLE ONLY "public"."employee_logbook"
    ADD CONSTRAINT "employee_logbook_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."shop_staff"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employee_master_logs"
    ADD CONSTRAINT "employee_master_logs_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."shop_staff"("id");



ALTER TABLE ONLY "public"."employee_meetings"
    ADD CONSTRAINT "employee_meetings_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."employee_schedules"
    ADD CONSTRAINT "employee_schedules_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."shop_staff"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employee_service_certifications"
    ADD CONSTRAINT "employee_service_certifications_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."shop_staff"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employee_shifts"
    ADD CONSTRAINT "employee_shifts_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."shop_staff"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employee_training"
    ADD CONSTRAINT "employee_training_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."shop_staff"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."equipment_check_selections"
    ADD CONSTRAINT "equipment_check_selections_checklist_item_id_fkey" FOREIGN KEY ("checklist_item_id") REFERENCES "public"."master_checklist_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fleet_accounts"
    ADD CONSTRAINT "fleet_accounts_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."game_leaderboard"
    ADD CONSTRAINT "game_leaderboard_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."game_runs"
    ADD CONSTRAINT "game_runs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."inventory_counts"
    ADD CONSTRAINT "inventory_counts_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."master_products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invoice_items"
    ADD CONSTRAINT "invoice_items_button_id_fkey" FOREIGN KEY ("button_id") REFERENCES "public"."pos_buttons"("id");



ALTER TABLE ONLY "public"."invoice_items"
    ADD CONSTRAINT "invoice_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."kpi_imports"
    ADD CONSTRAINT "kpi_imports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."master_checklist_responses"
    ADD CONSTRAINT "master_checklist_responses_checklist_item_id_fkey" FOREIGN KEY ("checklist_item_id") REFERENCES "public"."master_checklist_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."master_items"
    ADD CONSTRAINT "master_items_category_code_fkey" FOREIGN KEY ("category_code") REFERENCES "public"."inventory_categories"("code");



ALTER TABLE ONLY "public"."performance_reviews"
    ADD CONSTRAINT "performance_reviews_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."shop_staff"("id");



ALTER TABLE ONLY "public"."pos_buttons"
    ADD CONSTRAINT "pos_buttons_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."pos_button_groups"("id");



ALTER TABLE ONLY "public"."pos_buttons"
    ADD CONSTRAINT "pos_buttons_parent_button_id_fkey" FOREIGN KEY ("parent_button_id") REFERENCES "public"."pos_buttons"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pos_nested_buttons"
    ADD CONSTRAINT "pos_nested_buttons_parent_button_id_fkey" FOREIGN KEY ("parent_button_id") REFERENCES "public"."pos_buttons"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."price_list"
    ADD CONSTRAINT "price_list_item_slug_fkey" FOREIGN KEY ("item_slug") REFERENCES "public"."service_catalog"("item_slug") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."repairs_maintenance_log"
    ADD CONSTRAINT "repairs_maintenance_log_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "public"."repair_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shop_categories"
    ADD CONSTRAINT "shop_categories_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shop_count_sheet_items"
    ADD CONSTRAINT "shop_count_sheet_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."shop_master_products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shop_count_sheet_items"
    ADD CONSTRAINT "shop_count_sheet_items_sheet_id_fkey" FOREIGN KEY ("sheet_id") REFERENCES "public"."shop_count_sheets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shop_count_sheets"
    ADD CONSTRAINT "shop_count_sheets_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shop_inventory_items"
    ADD CONSTRAINT "shop_inventory_items_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shop_master_products"
    ADD CONSTRAINT "shop_master_products_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shop_overrides"
    ADD CONSTRAINT "shop_overrides_category_code_fkey" FOREIGN KEY ("category_code") REFERENCES "public"."inventory_categories"("code");



ALTER TABLE ONLY "public"."shop_overrides"
    ADD CONSTRAINT "shop_overrides_master_item_id_fkey" FOREIGN KEY ("master_item_id") REFERENCES "public"."master_items"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."solink_audits"
    ADD CONSTRAINT "solink_audits_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."speed_training_leaderboard"
    ADD CONSTRAINT "speed_training_leaderboard_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."speed_training_runs"
    ADD CONSTRAINT "speed_training_runs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."spif_tracker"
    ADD CONSTRAINT "spif_tracker_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."spiff_gain_loss_tracking"
    ADD CONSTRAINT "spiff_gain_loss_tracking_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."termed_employees"
    ADD CONSTRAINT "termed_employees_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."shop_staff"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."turned_logs"
    ADD CONSTRAINT "turned_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."workbook_entries"
    ADD CONSTRAINT "workbook_entries_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."workbook_categories"("id");



ALTER TABLE ONLY "public"."workbook_entries"
    ADD CONSTRAINT "workbook_entries_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



CREATE POLICY "Admin users can view all profiles" ON "public"."profiles" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "profiles_1"
  WHERE (("profiles_1"."user_id" = "auth"."uid"()) AND ("profiles_1"."role" = 'admin'::"text")))));



CREATE POLICY "Admin users can view all shops" ON "public"."shop_alignment" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."user_id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can delete profiles" ON "public"."profiles" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."user_id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can insert master products" ON "public"."master_products" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Admins can insert profiles" ON "public"."profiles" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."user_id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can update all profiles" ON "public"."profiles" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."user_id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can update master products" ON "public"."master_products" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Admins can view all profiles" ON "public"."profiles" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."user_id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))));



CREATE POLICY "Allow admins to manage app settings" ON "public"."app_settings" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."user_id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Allow all access to category_keywords" ON "public"."category_keywords" USING (true);



CREATE POLICY "Allow all access to inventory_categories" ON "public"."inventory_categories" USING (true);



CREATE POLICY "Allow all access to inventory_staging" ON "public"."inventory_staging" USING (true);



CREATE POLICY "Allow all access to master_items" ON "public"."master_items" USING (true);



CREATE POLICY "Allow all access to shop_inventory_profile" ON "public"."shop_inventory_profile" USING (true);



CREATE POLICY "Allow all access to shop_overrides" ON "public"."shop_overrides" USING (true);



CREATE POLICY "Allow all operations for authenticated users" ON "public"."manager_challenges" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all operations on crew_challenges" ON "public"."crew_challenges" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all operations on daily_cadence" ON "public"."daily_cadence" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all operations on daily_log_config" ON "public"."daily_log_config" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all operations on daily_summary_reports" ON "public"."daily_summary_reports" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all operations on employee_challenges" ON "public"."employee_challenges" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all operations on employee_development" ON "public"."employee_development" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all operations on employee_schedules" ON "public"."employee_schedules" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all operations on employee_training" ON "public"."employee_training" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all operations on equipment_check_logs" ON "public"."equipment_check_logs" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all operations on equipment_check_selections" ON "public"."equipment_check_selections" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all operations on export_snapshots" ON "public"."export_snapshots" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all operations on item_numbers" ON "public"."item_numbers" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all operations on master_checklist_items" ON "public"."master_checklist_items" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all operations on master_checklist_reports" ON "public"."master_checklist_reports" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all operations on master_checklist_responses" ON "public"."master_checklist_responses" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all operations on mod_challenges" ON "public"."mod_challenges" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all operations on refunds" ON "public"."refunds" USING (true);



CREATE POLICY "Allow all operations on upload_logs" ON "public"."upload_logs" USING (true) WITH CHECK (true);



CREATE POLICY "Allow anonymous read access to categories" ON "public"."categories" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Allow anonymous read access to challenges_log" ON "public"."challenges_log" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Allow anonymous read access to claims" ON "public"."claims" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Allow anonymous read access to daily_cadence" ON "public"."daily_cadence" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Allow anonymous read access to daily_logbook_entries" ON "public"."daily_logbook_entries" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Allow anonymous read access to employee_training" ON "public"."employee_training" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Allow anonymous read access to inventory_counts_v2" ON "public"."inventory_counts_v2" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Allow anonymous read access to inventory_items" ON "public"."inventory_items" FOR SELECT TO "anon" USING (true);



COMMENT ON POLICY "Allow anonymous read access to inventory_items" ON "public"."inventory_items" IS 'Allows anonymous read access for BYPASS_LOGIN development mode';



CREATE POLICY "Allow anonymous read access to kpi_daily" ON "public"."kpi_daily" FOR SELECT TO "anon" USING (true);



COMMENT ON POLICY "Allow anonymous read access to kpi_daily" ON "public"."kpi_daily" IS 'Allows anonymous read access for BYPASS_LOGIN development mode';



CREATE POLICY "Allow anonymous read access to kpi_imports" ON "public"."kpi_imports" FOR SELECT TO "anon" USING (true);



COMMENT ON POLICY "Allow anonymous read access to kpi_imports" ON "public"."kpi_imports" IS 'Allows anonymous read access for BYPASS_LOGIN development mode';



CREATE POLICY "Allow anonymous read access to labor_tracking" ON "public"."labor_tracking" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Allow anonymous read access to shop_staff" ON "public"."shop_staff" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Allow anonymous read access to solink_audits" ON "public"."solink_audits" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Allow anonymous read access to termed_employees" ON "public"."termed_employees" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Allow anonymous read access to turned_logs" ON "public"."turned_logs" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Allow authenticated users to read app settings" ON "public"."app_settings" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow public delete access to categories" ON "public"."categories" FOR DELETE USING (true);



CREATE POLICY "Allow public insert access to categories" ON "public"."categories" FOR INSERT WITH CHECK (true);



CREATE POLICY "Allow public insert access to import_logs" ON "public"."import_logs" FOR INSERT WITH CHECK (true);



CREATE POLICY "Allow public read access to categories" ON "public"."categories" FOR SELECT USING (true);



CREATE POLICY "Allow public read access to import_logs" ON "public"."import_logs" FOR SELECT USING (true);



CREATE POLICY "Allow public update access to categories" ON "public"."categories" FOR UPDATE USING (true);



CREATE POLICY "Anyone can insert game results" ON "public"."game_results" FOR INSERT WITH CHECK (true);



CREATE POLICY "Anyone can view active master products" ON "public"."master_products" FOR SELECT USING ((("auth"."role"() = 'authenticated'::"text") AND ("is_active" = true)));



CREATE POLICY "Anyone can view color palette" ON "public"."pos_button_color_palette" FOR SELECT USING (true);



CREATE POLICY "Anyone can view districts" ON "public"."districts" FOR SELECT USING (true);



CREATE POLICY "Anyone can view game decks" ON "public"."game_decks" FOR SELECT USING (true);



CREATE POLICY "Anyone can view game results" ON "public"."game_results" FOR SELECT USING (true);



CREATE POLICY "Anyone can view prices" ON "public"."price_list" FOR SELECT USING (true);



CREATE POLICY "Anyone can view regions" ON "public"."regions" FOR SELECT USING (true);



CREATE POLICY "Anyone can view retail calendar" ON "public"."retail_calendar" FOR SELECT USING (true);



CREATE POLICY "Anyone can view service catalog" ON "public"."service_catalog" FOR SELECT USING (true);



CREATE POLICY "Anyone can view work calendar config" ON "public"."work_calendar_config" FOR SELECT USING (true);



CREATE POLICY "Anyone can view workbook categories" ON "public"."workbook_categories" FOR SELECT USING (true);



CREATE POLICY "Authenticated users can delete game decks" ON "public"."game_decks" FOR DELETE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can delete prices" ON "public"."price_list" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can delete service catalog items" ON "public"."service_catalog" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can insert budgets" ON "public"."budgets" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated users can insert districts" ON "public"."districts" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can insert game decks" ON "public"."game_decks" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can insert prices" ON "public"."price_list" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated users can insert regions" ON "public"."regions" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can insert service catalog items" ON "public"."service_catalog" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated users can insert work calendar config" ON "public"."work_calendar_config" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can insert workbook categories" ON "public"."workbook_categories" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated users can update budgets" ON "public"."budgets" FOR UPDATE USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated users can update districts" ON "public"."districts" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can update game decks" ON "public"."game_decks" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can update prices" ON "public"."price_list" FOR UPDATE TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can update regions" ON "public"."regions" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can update service catalog items" ON "public"."service_catalog" FOR UPDATE TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can update work calendar config" ON "public"."work_calendar_config" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can update workbook categories" ON "public"."workbook_categories" FOR UPDATE USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "DM can manage own schedule entries" ON "public"."dm_schedule" USING (("dm_id" = "auth"."uid"()));



CREATE POLICY "District managers can view their district shops" ON "public"."shop_alignment" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."user_id" = "auth"."uid"()) AND ("profiles"."role" = 'district_manager'::"text") AND (("profiles"."district_id" = "shop_alignment"."district") OR ("profiles"."district_name" = "shop_alignment"."district"))))));



CREATE POLICY "RD can view district schedule entries" ON "public"."dm_schedule" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."user_id" = "auth"."uid"()) AND ("p"."role" = 'regional_director'::"text") AND (EXISTS ( SELECT 1
           FROM "public"."shop_alignment" "sa"
          WHERE (("sa"."shop" = "dm_schedule"."location_id") AND ("sa"."region" = "p"."region_id"))))))));



CREATE POLICY "Regional directors can view their region shops" ON "public"."shop_alignment" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."user_id" = "auth"."uid"()) AND ("profiles"."role" = 'regional_director'::"text") AND (("profiles"."region_id" = "shop_alignment"."region") OR ("profiles"."region_name" = "shop_alignment"."region"))))));



CREATE POLICY "Service role can manage all profiles" ON "public"."profiles" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Shop users can delete their shop cadence" ON "public"."daily_cadence" FOR DELETE USING ("public"."user_has_shop_access"("shop_id"));



CREATE POLICY "Shop users can delete their shop challenges" ON "public"."crew_challenges" FOR DELETE USING ("public"."user_has_shop_access"("shop_id"));



CREATE POLICY "Shop users can delete their shop claims" ON "public"."claims" FOR DELETE USING ("public"."user_has_shop_access"("shop_id"));



CREATE POLICY "Shop users can delete their shop coaching logs" ON "public"."coaching_logs" FOR DELETE USING ("public"."user_has_shop_access"("shop_id"));



CREATE POLICY "Shop users can delete their shop inventory" ON "public"."inventory_counts_v2" FOR DELETE USING ("public"."user_has_shop_access"("shop_id"));



CREATE POLICY "Shop users can delete their shop labor data" ON "public"."labor_tracking" FOR DELETE USING ("public"."user_has_shop_access"("shop_id"));



CREATE POLICY "Shop users can delete their shop labor staff entries" ON "public"."labor_staff_entries" FOR DELETE USING ("public"."user_has_shop_access"("shop_id"));



CREATE POLICY "Shop users can delete their shop repair requests" ON "public"."repair_requests" FOR DELETE USING ("public"."user_has_shop_access"("shop_id"));



CREATE POLICY "Shop users can delete their shop sales data" ON "public"."daily_sales_entries" FOR DELETE USING ("public"."user_has_shop_access"("shop_id"));



CREATE POLICY "Shop users can delete their shop staff" ON "public"."shop_staff" FOR DELETE USING ("public"."user_has_shop_access"("shop_id"));



CREATE POLICY "Shop users can insert their shop cadence" ON "public"."daily_cadence" FOR INSERT WITH CHECK ("public"."user_has_shop_access"("shop_id"));



CREATE POLICY "Shop users can insert their shop challenges" ON "public"."crew_challenges" FOR INSERT WITH CHECK ("public"."user_has_shop_access"("shop_id"));



CREATE POLICY "Shop users can insert their shop claims" ON "public"."claims" FOR INSERT WITH CHECK ("public"."user_has_shop_access"("shop_id"));



CREATE POLICY "Shop users can insert their shop coaching logs" ON "public"."coaching_logs" FOR INSERT WITH CHECK ("public"."user_has_shop_access"("shop_id"));



CREATE POLICY "Shop users can insert their shop inventory" ON "public"."inventory_counts_v2" FOR INSERT WITH CHECK ("public"."user_has_shop_access"("shop_id"));



CREATE POLICY "Shop users can insert their shop labor data" ON "public"."labor_tracking" FOR INSERT WITH CHECK ("public"."user_has_shop_access"("shop_id"));



CREATE POLICY "Shop users can insert their shop labor staff entries" ON "public"."labor_staff_entries" FOR INSERT WITH CHECK ("public"."user_has_shop_access"("shop_id"));



CREATE POLICY "Shop users can insert their shop repair requests" ON "public"."repair_requests" FOR INSERT WITH CHECK ("public"."user_has_shop_access"("shop_id"));



CREATE POLICY "Shop users can insert their shop sales data" ON "public"."daily_sales_entries" FOR INSERT WITH CHECK ("public"."user_has_shop_access"("shop_id"));



CREATE POLICY "Shop users can insert their shop staff" ON "public"."shop_staff" FOR INSERT WITH CHECK ("public"."user_has_shop_access"("shop_id"));



CREATE POLICY "Shop users can update their shop cadence" ON "public"."daily_cadence" FOR UPDATE USING ("public"."user_has_shop_access"("shop_id")) WITH CHECK ("public"."user_has_shop_access"("shop_id"));



CREATE POLICY "Shop users can update their shop challenges" ON "public"."crew_challenges" FOR UPDATE USING ("public"."user_has_shop_access"("shop_id")) WITH CHECK ("public"."user_has_shop_access"("shop_id"));



CREATE POLICY "Shop users can update their shop claims" ON "public"."claims" FOR UPDATE USING ("public"."user_has_shop_access"("shop_id")) WITH CHECK ("public"."user_has_shop_access"("shop_id"));



CREATE POLICY "Shop users can update their shop coaching logs" ON "public"."coaching_logs" FOR UPDATE USING ("public"."user_has_shop_access"("shop_id")) WITH CHECK ("public"."user_has_shop_access"("shop_id"));



CREATE POLICY "Shop users can update their shop inventory" ON "public"."inventory_counts_v2" FOR UPDATE USING ("public"."user_has_shop_access"("shop_id")) WITH CHECK ("public"."user_has_shop_access"("shop_id"));



CREATE POLICY "Shop users can update their shop labor data" ON "public"."labor_tracking" FOR UPDATE USING ("public"."user_has_shop_access"("shop_id")) WITH CHECK ("public"."user_has_shop_access"("shop_id"));



CREATE POLICY "Shop users can update their shop labor staff entries" ON "public"."labor_staff_entries" FOR UPDATE USING ("public"."user_has_shop_access"("shop_id")) WITH CHECK ("public"."user_has_shop_access"("shop_id"));



CREATE POLICY "Shop users can update their shop repair requests" ON "public"."repair_requests" FOR UPDATE USING ("public"."user_has_shop_access"("shop_id")) WITH CHECK ("public"."user_has_shop_access"("shop_id"));



CREATE POLICY "Shop users can update their shop sales data" ON "public"."daily_sales_entries" FOR UPDATE USING ("public"."user_has_shop_access"("shop_id")) WITH CHECK ("public"."user_has_shop_access"("shop_id"));



CREATE POLICY "Shop users can update their shop staff" ON "public"."shop_staff" FOR UPDATE USING ("public"."user_has_shop_access"("shop_id")) WITH CHECK ("public"."user_has_shop_access"("shop_id"));



CREATE POLICY "Shop users can view their own shop" ON "public"."shop_alignment" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."user_id" = "auth"."uid"()) AND ("profiles"."role" = 'shop'::"text") AND (("profiles"."shop_id" = "shop_alignment"."shop") OR ("profiles"."store_number" = "shop_alignment"."shop"))))));



CREATE POLICY "Shop users can view their shop cadence" ON "public"."daily_cadence" FOR SELECT USING ("public"."user_has_shop_access"("shop_id"));



CREATE POLICY "Shop users can view their shop challenges" ON "public"."crew_challenges" FOR SELECT USING ("public"."user_has_shop_access"("shop_id"));



CREATE POLICY "Shop users can view their shop claims" ON "public"."claims" FOR SELECT USING ("public"."user_has_shop_access"("shop_id"));



CREATE POLICY "Shop users can view their shop coaching logs" ON "public"."coaching_logs" FOR SELECT USING ("public"."user_has_shop_access"("shop_id"));



CREATE POLICY "Shop users can view their shop inventory" ON "public"."inventory_counts_v2" FOR SELECT USING ("public"."user_has_shop_access"("shop_id"));



CREATE POLICY "Shop users can view their shop labor data" ON "public"."labor_tracking" FOR SELECT USING ("public"."user_has_shop_access"("shop_id"));



CREATE POLICY "Shop users can view their shop labor staff entries" ON "public"."labor_staff_entries" FOR SELECT USING ("public"."user_has_shop_access"("shop_id"));



CREATE POLICY "Shop users can view their shop repair requests" ON "public"."repair_requests" FOR SELECT USING ("public"."user_has_shop_access"("shop_id"));



CREATE POLICY "Shop users can view their shop sales data" ON "public"."daily_sales_entries" FOR SELECT USING ("public"."user_has_shop_access"("shop_id"));



CREATE POLICY "Shop users can view their shop staff" ON "public"."shop_staff" FOR SELECT USING ("public"."user_has_shop_access"("shop_id"));



ALTER TABLE "public"."Shop_alignment" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Users can delete POS buttons for their shop" ON "public"."pos_buttons" FOR DELETE USING (true);



CREATE POLICY "Users can delete certifications for their shop" ON "public"."employee_service_certifications" FOR DELETE USING (true);



CREATE POLICY "Users can delete checklists" ON "public"."opening_closing_checklists" FOR DELETE USING (true);



CREATE POLICY "Users can delete contacts for their shop" ON "public"."contacts" FOR DELETE USING (true);



CREATE POLICY "Users can delete count sheet items" ON "public"."shop_count_sheet_items" FOR DELETE USING (true);



CREATE POLICY "Users can delete count sheets" ON "public"."shop_count_sheets" FOR DELETE USING (true);



CREATE POLICY "Users can delete employee challenge logs" ON "public"."employee_challenge_logs" FOR DELETE USING (true);



CREATE POLICY "Users can delete expired claims logs" ON "public"."claims_log" FOR DELETE USING (("expires_at" < "now"()));



CREATE POLICY "Users can delete fleet accounts for their shop" ON "public"."fleet_accounts" FOR DELETE USING (true);



CREATE POLICY "Users can delete from their shop catalog" ON "public"."shop_catalog" FOR DELETE USING (true);



CREATE POLICY "Users can delete micro challenges" ON "public"."micro_challenges" FOR DELETE USING (true);



CREATE POLICY "Users can delete nested POS buttons" ON "public"."pos_nested_buttons" FOR DELETE USING (true);



CREATE POLICY "Users can delete nested buttons for their shop" ON "public"."pos_nested_buttons" FOR DELETE USING (("parent_button_id" IN ( SELECT "pos_buttons"."id"
   FROM "public"."pos_buttons"
  WHERE ("pos_buttons"."shop_id" = "current_setting"('app.current_shop_id'::"text", true)))));



CREATE POLICY "Users can delete products" ON "public"."shop_master_products" FOR DELETE USING (true);



CREATE POLICY "Users can delete scanned items" ON "public"."ai_scanned_items" FOR DELETE USING (true);



CREATE POLICY "Users can delete shifts for their shop" ON "public"."employee_shifts" FOR DELETE USING (true);



CREATE POLICY "Users can delete shop categories" ON "public"."shop_categories" FOR DELETE USING (true);



CREATE POLICY "Users can delete solink audits" ON "public"."solink_audits" FOR DELETE USING (true);



CREATE POLICY "Users can delete staff for their shop" ON "public"."shop_staff" FOR DELETE USING (true);



CREATE POLICY "Users can delete supply orders for their shop" ON "public"."supply_orders" FOR DELETE USING (true);



CREATE POLICY "Users can delete termed employees" ON "public"."termed_employees" FOR DELETE USING (true);



CREATE POLICY "Users can delete their own meetings" ON "public"."employee_meetings" FOR DELETE USING (("created_by" = "auth"."uid"()));



CREATE POLICY "Users can delete their shop checkbook entries" ON "public"."shop_checkbook_entries" FOR DELETE USING (("shop_id" = COALESCE(( SELECT "profiles"."shop_id"
   FROM "public"."profiles"
  WHERE ("profiles"."user_id" = "auth"."uid"())), (("current_setting"('request.jwt.claims'::"text", true))::json ->> 'shop_id'::"text"))));



CREATE POLICY "Users can delete their shop workbook entries" ON "public"."shop_workbook_entries" FOR DELETE USING (("shop_id" = COALESCE(( SELECT "profiles"."shop_id"
   FROM "public"."profiles"
  WHERE ("profiles"."user_id" = "auth"."uid"())), (("current_setting"('request.jwt.claims'::"text", true))::json ->> 'shop_id'::"text"))));



CREATE POLICY "Users can delete their shop's KPI projections" ON "public"."kpi_projections" FOR DELETE USING (true);



CREATE POLICY "Users can delete their shop's SPIF data" ON "public"."spif_tracker" FOR DELETE USING (true);



CREATE POLICY "Users can delete their shop's SPIFF data" ON "public"."spiff_gain_loss_tracking" FOR DELETE USING (true);



CREATE POLICY "Users can delete their shop's challenge logs" ON "public"."challenges_log" FOR DELETE USING (true);



CREATE POLICY "Users can delete their shop's employee hours" ON "public"."employee_hours_tracking" FOR DELETE USING (true);



CREATE POLICY "Users can delete their shop's invoices" ON "public"."crash_kit_invoices" FOR DELETE USING (true);



CREATE POLICY "Users can delete their shop's labor staff entries" ON "public"."labor_staff_entries" FOR DELETE USING (true);



CREATE POLICY "Users can delete their shop's projections" ON "public"."weekly_projections" FOR DELETE USING (true);



CREATE POLICY "Users can insert DM logbook entries" ON "public"."dm_logbook" FOR INSERT WITH CHECK (true);



CREATE POLICY "Users can insert KPI daily data for their shop" ON "public"."kpi_daily" FOR INSERT WITH CHECK (("shop_id" IN ( SELECT "profiles"."shop_id"
   FROM "public"."profiles"
  WHERE ("profiles"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can insert KPI goals for their shop" ON "public"."kpi_goals" FOR INSERT WITH CHECK (("shop_id" IN ( SELECT "profiles"."shop_id"
   FROM "public"."profiles"
  WHERE ("profiles"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can insert KPI imports for their shop" ON "public"."kpi_imports" FOR INSERT WITH CHECK (("shop_id" IN ( SELECT "profiles"."shop_id"
   FROM "public"."profiles"
  WHERE ("profiles"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can insert KPIs for their shop" ON "public"."employee_kpis" FOR INSERT WITH CHECK (true);



CREATE POLICY "Users can insert POS buttons for their shop" ON "public"."pos_buttons" FOR INSERT WITH CHECK (true);



CREATE POLICY "Users can insert SPIF data for their shop" ON "public"."spif_tracker" FOR INSERT WITH CHECK (true);



CREATE POLICY "Users can insert SPIFF data for their shop" ON "public"."spiff_gain_loss_tracking" FOR INSERT WITH CHECK (true);



CREATE POLICY "Users can insert VIN cache" ON "public"."vin_decode_cache" FOR INSERT WITH CHECK (true);



CREATE POLICY "Users can insert certifications for their shop" ON "public"."employee_service_certifications" FOR INSERT WITH CHECK (true);



CREATE POLICY "Users can insert challenge logs" ON "public"."challenges_log" FOR INSERT WITH CHECK (true);



CREATE POLICY "Users can insert checklists" ON "public"."opening_closing_checklists" FOR INSERT WITH CHECK (true);



CREATE POLICY "Users can insert claims logs" ON "public"."claims_log" FOR INSERT WITH CHECK (true);



CREATE POLICY "Users can insert coaching logs for their shop" ON "public"."coaching_logs" FOR INSERT WITH CHECK (true);



CREATE POLICY "Users can insert contacts for their shop" ON "public"."contacts" FOR INSERT WITH CHECK (true);



CREATE POLICY "Users can insert count sheet items" ON "public"."shop_count_sheet_items" FOR INSERT WITH CHECK (true);



CREATE POLICY "Users can insert count sheets" ON "public"."shop_count_sheets" FOR INSERT WITH CHECK (true);



CREATE POLICY "Users can insert employee challenge logs" ON "public"."employee_challenge_logs" FOR INSERT WITH CHECK (true);



CREATE POLICY "Users can insert export history" ON "public"."inventory_export_history" FOR INSERT WITH CHECK (true);



CREATE POLICY "Users can insert fleet accounts for their shop" ON "public"."fleet_accounts" FOR INSERT WITH CHECK (true);



CREATE POLICY "Users can insert goals for their shop" ON "public"."employee_goals" FOR INSERT WITH CHECK (true);



CREATE POLICY "Users can insert into their shop catalog" ON "public"."shop_catalog" FOR INSERT WITH CHECK (true);



CREATE POLICY "Users can insert inventory export logs" ON "public"."inventory_export_logs" FOR INSERT WITH CHECK (true);



CREATE POLICY "Users can insert invoices" ON "public"."crash_kit_invoices" FOR INSERT WITH CHECK (true);



CREATE POLICY "Users can insert labor staff entries" ON "public"."labor_staff_entries" FOR INSERT WITH CHECK (true);



CREATE POLICY "Users can insert logbook entries" ON "public"."daily_logbook" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can insert logbook entries for their shop" ON "public"."daily_logbook_entries" FOR INSERT WITH CHECK (true);



CREATE POLICY "Users can insert logs for their shop" ON "public"."employee_master_logs" FOR INSERT WITH CHECK (true);



CREATE POLICY "Users can insert master inventory" ON "public"."master_inventory_list" FOR INSERT WITH CHECK (true);



CREATE POLICY "Users can insert meetings" ON "public"."employee_meetings" FOR INSERT WITH CHECK (true);



CREATE POLICY "Users can insert micro challenges" ON "public"."micro_challenges" FOR INSERT WITH CHECK (true);



CREATE POLICY "Users can insert nested POS buttons" ON "public"."pos_nested_buttons" FOR INSERT WITH CHECK (true);



CREATE POLICY "Users can insert nested buttons for their shop" ON "public"."pos_nested_buttons" FOR INSERT WITH CHECK (("parent_button_id" IN ( SELECT "pos_buttons"."id"
   FROM "public"."pos_buttons"
  WHERE ("pos_buttons"."shop_id" = "current_setting"('app.current_shop_id'::"text", true)))));



CREATE POLICY "Users can insert pos_button_groups" ON "public"."pos_button_groups" FOR INSERT WITH CHECK (true);



CREATE POLICY "Users can insert products" ON "public"."crash_kit_products" FOR INSERT WITH CHECK (true);



CREATE POLICY "Users can insert products" ON "public"."shop_master_products" FOR INSERT WITH CHECK (true);



CREATE POLICY "Users can insert reviews for their shop" ON "public"."performance_reviews" FOR INSERT WITH CHECK (true);



CREATE POLICY "Users can insert scanned items" ON "public"."ai_scanned_items" FOR INSERT WITH CHECK (true);



CREATE POLICY "Users can insert shifts for their shop" ON "public"."employee_shifts" FOR INSERT WITH CHECK (true);



CREATE POLICY "Users can insert shop alignment data" ON "public"."shop_alignment" FOR INSERT WITH CHECK (true);



CREATE POLICY "Users can insert shop categories" ON "public"."shop_categories" FOR INSERT WITH CHECK (true);



CREATE POLICY "Users can insert shops" ON "public"."shops" FOR INSERT WITH CHECK (true);



CREATE POLICY "Users can insert solink audits" ON "public"."solink_audits" FOR INSERT WITH CHECK (true);



CREATE POLICY "Users can insert staff for their shop" ON "public"."shop_staff" FOR INSERT WITH CHECK (true);



CREATE POLICY "Users can insert supply ordering logs for their shop" ON "public"."supply_ordering_log" FOR INSERT WITH CHECK (("shop_id" IN ( SELECT "profiles"."shop_id"
   FROM "public"."profiles"
  WHERE ("profiles"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can insert supply orders for their shop" ON "public"."supply_orders" FOR INSERT WITH CHECK (true);



CREATE POLICY "Users can insert termed employees" ON "public"."termed_employees" FOR INSERT WITH CHECK (true);



CREATE POLICY "Users can insert their own game runs" ON "public"."game_runs" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own runs" ON "public"."speed_training_runs" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can insert their own turned logs" ON "public"."turned_logs" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can insert their own workbook entries" ON "public"."workbook_entries" FOR INSERT WITH CHECK (("created_by" = "auth"."uid"()));



CREATE POLICY "Users can insert their shop R&M logs" ON "public"."repairs_maintenance_log" FOR INSERT WITH CHECK (("building_id" = COALESCE(( SELECT "profiles"."shop_id"
   FROM "public"."profiles"
  WHERE ("profiles"."user_id" = "auth"."uid"())), (("current_setting"('request.jwt.claims'::"text", true))::json ->> 'shop_id'::"text"))));



CREATE POLICY "Users can insert their shop checkbook entries" ON "public"."shop_checkbook_entries" FOR INSERT WITH CHECK (("shop_id" = COALESCE(( SELECT "profiles"."shop_id"
   FROM "public"."profiles"
  WHERE ("profiles"."user_id" = "auth"."uid"())), (("current_setting"('request.jwt.claims'::"text", true))::json ->> 'shop_id'::"text"))));



CREATE POLICY "Users can insert their shop claims" ON "public"."claims" FOR INSERT WITH CHECK (("shop_id" = COALESCE(( SELECT "profiles"."shop_id"
   FROM "public"."profiles"
  WHERE ("profiles"."user_id" = "auth"."uid"())), (("current_setting"('request.jwt.claims'::"text", true))::json ->> 'shop_id'::"text"))));



CREATE POLICY "Users can insert their shop inventory counts" ON "public"."inventory_counts" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Users can insert their shop repair requests" ON "public"."repair_requests" FOR INSERT WITH CHECK (("shop_id" = COALESCE(( SELECT "profiles"."shop_id"
   FROM "public"."profiles"
  WHERE ("profiles"."user_id" = "auth"."uid"())), (("current_setting"('request.jwt.claims'::"text", true))::json ->> 'shop_id'::"text"))));



CREATE POLICY "Users can insert their shop weekly sales" ON "public"."weekly_sales_data" FOR INSERT WITH CHECK (("shop_id" = COALESCE(( SELECT "profiles"."shop_id"
   FROM "public"."profiles"
  WHERE ("profiles"."user_id" = "auth"."uid"())), (("current_setting"('request.jwt.claims'::"text", true))::json ->> 'shop_id'::"text"))));



CREATE POLICY "Users can insert their shop workbook entries" ON "public"."shop_workbook_entries" FOR INSERT WITH CHECK (("shop_id" = COALESCE(( SELECT "profiles"."shop_id"
   FROM "public"."profiles"
  WHERE ("profiles"."user_id" = "auth"."uid"())), (("current_setting"('request.jwt.claims'::"text", true))::json ->> 'shop_id'::"text"))));



CREATE POLICY "Users can insert their shop's KPI projections" ON "public"."kpi_projections" FOR INSERT WITH CHECK (true);



CREATE POLICY "Users can insert their shop's checkbook monthly totals" ON "public"."daily_checkbook_monthly_totals" FOR INSERT WITH CHECK (true);



CREATE POLICY "Users can insert their shop's customers" ON "public"."crash_kit_customers" FOR INSERT WITH CHECK (true);



CREATE POLICY "Users can insert their shop's employee hours" ON "public"."employee_hours_tracking" FOR INSERT WITH CHECK (true);



CREATE POLICY "Users can insert their shop's logbook" ON "public"."crash_kit_logbook" FOR INSERT WITH CHECK (true);



CREATE POLICY "Users can insert their shop's logbook close entries" ON "public"."daily_logbook_close" FOR INSERT WITH CHECK (("shop_id" = "current_setting"('app.shop_id'::"text", true)));



CREATE POLICY "Users can insert their shop's offline queue" ON "public"."crash_kit_offline_queue" FOR INSERT WITH CHECK (true);



CREATE POLICY "Users can insert their shop's projections" ON "public"."weekly_projections" FOR INSERT WITH CHECK (true);



CREATE POLICY "Users can insert their shop's vehicles" ON "public"."crash_kit_vehicles" FOR INSERT WITH CHECK (true);



CREATE POLICY "Users can insert their shop's workbook monthly totals" ON "public"."daily_workbook_monthly_totals" FOR INSERT WITH CHECK (true);



CREATE POLICY "Users can insert turned logs for their shop" ON "public"."turned_logs" FOR INSERT WITH CHECK (true);



CREATE POLICY "Users can manage invoice_items" ON "public"."invoice_items" USING ((("auth"."jwt"() ->> 'role'::"text") = ANY (ARRAY['shop'::"text", 'district_manager'::"text", 'regional_director'::"text", 'admin'::"text"])));



CREATE POLICY "Users can manage invoices" ON "public"."invoices" USING ((("auth"."jwt"() ->> 'role'::"text") = ANY (ARRAY['shop'::"text", 'district_manager'::"text", 'regional_director'::"text", 'admin'::"text"])));



CREATE POLICY "Users can manage pos_buttons" ON "public"."pos_buttons" USING ((("auth"."jwt"() ->> 'role'::"text") = ANY (ARRAY['shop'::"text", 'district_manager'::"text", 'regional_director'::"text", 'admin'::"text"])));



CREATE POLICY "Users can update DM logbook entries" ON "public"."dm_logbook" FOR UPDATE USING (true);



CREATE POLICY "Users can update KPI daily data for their shop" ON "public"."kpi_daily" FOR UPDATE USING (("shop_id" IN ( SELECT "profiles"."shop_id"
   FROM "public"."profiles"
  WHERE ("profiles"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can update KPI goals for their shop" ON "public"."kpi_goals" FOR UPDATE USING (("shop_id" IN ( SELECT "profiles"."shop_id"
   FROM "public"."profiles"
  WHERE ("profiles"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can update KPIs for their shop" ON "public"."employee_kpis" FOR UPDATE USING (true);



CREATE POLICY "Users can update POS buttons for their shop" ON "public"."pos_buttons" FOR UPDATE USING (true);



CREATE POLICY "Users can update certifications for their shop" ON "public"."employee_service_certifications" FOR UPDATE USING (true);



CREATE POLICY "Users can update checklists" ON "public"."opening_closing_checklists" FOR UPDATE USING (true);



CREATE POLICY "Users can update coaching logs for their shop" ON "public"."coaching_logs" FOR UPDATE USING (true);



CREATE POLICY "Users can update contacts for their shop" ON "public"."contacts" FOR UPDATE USING (true);



CREATE POLICY "Users can update count sheet items" ON "public"."shop_count_sheet_items" FOR UPDATE USING (true);



CREATE POLICY "Users can update count sheets" ON "public"."shop_count_sheets" FOR UPDATE USING (true);



CREATE POLICY "Users can update fleet accounts for their shop" ON "public"."fleet_accounts" FOR UPDATE USING (true);



CREATE POLICY "Users can update goals for their shop" ON "public"."employee_goals" FOR UPDATE USING (true);



CREATE POLICY "Users can update logs for their shop" ON "public"."employee_master_logs" FOR UPDATE USING (true);



CREATE POLICY "Users can update master inventory" ON "public"."master_inventory_list" FOR UPDATE USING (true);



CREATE POLICY "Users can update micro challenges" ON "public"."micro_challenges" FOR UPDATE USING (true);



CREATE POLICY "Users can update nested POS buttons" ON "public"."pos_nested_buttons" FOR UPDATE USING (true);



CREATE POLICY "Users can update nested buttons for their shop" ON "public"."pos_nested_buttons" FOR UPDATE USING (("parent_button_id" IN ( SELECT "pos_buttons"."id"
   FROM "public"."pos_buttons"
  WHERE ("pos_buttons"."shop_id" = "current_setting"('app.current_shop_id'::"text", true)))));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update pos_button_groups" ON "public"."pos_button_groups" FOR UPDATE USING (true);



CREATE POLICY "Users can update products" ON "public"."crash_kit_products" FOR UPDATE USING (true);



CREATE POLICY "Users can update products" ON "public"."shop_master_products" FOR UPDATE USING (true);



CREATE POLICY "Users can update reviews for their shop" ON "public"."performance_reviews" FOR UPDATE USING (true);



CREATE POLICY "Users can update scanned items" ON "public"."ai_scanned_items" FOR UPDATE USING (true);



CREATE POLICY "Users can update shifts for their shop" ON "public"."employee_shifts" FOR UPDATE USING (true);



CREATE POLICY "Users can update shop alignment data" ON "public"."shop_alignment" FOR UPDATE USING (true);



CREATE POLICY "Users can update shop categories" ON "public"."shop_categories" FOR UPDATE USING (true);



CREATE POLICY "Users can update shops" ON "public"."shops" FOR UPDATE USING (true);



CREATE POLICY "Users can update solink audits" ON "public"."solink_audits" FOR UPDATE USING (true);



CREATE POLICY "Users can update staff for their shop" ON "public"."shop_staff" FOR UPDATE USING (true);



CREATE POLICY "Users can update supply ordering logs for their shop" ON "public"."supply_ordering_log" FOR UPDATE USING (("shop_id" IN ( SELECT "profiles"."shop_id"
   FROM "public"."profiles"
  WHERE ("profiles"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can update supply orders for their shop" ON "public"."supply_orders" FOR UPDATE USING (true);



CREATE POLICY "Users can update termed employees" ON "public"."termed_employees" FOR UPDATE USING (true);



CREATE POLICY "Users can update their own claims logs" ON "public"."claims_log" FOR UPDATE USING (true);



CREATE POLICY "Users can update their own game runs" ON "public"."game_runs" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own leaderboard" ON "public"."speed_training_leaderboard" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update their own leaderboard entries" ON "public"."speed_training_leaderboard" FOR UPDATE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update their own leaderboard entry" ON "public"."game_leaderboard" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own leaderboard score" ON "public"."game_leaderboard" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own meetings" ON "public"."employee_meetings" FOR UPDATE USING (("created_by" = "auth"."uid"()));



CREATE POLICY "Users can update their own profile" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own workbook entries" ON "public"."workbook_entries" FOR UPDATE USING (("created_by" = "auth"."uid"()));



CREATE POLICY "Users can update their shop catalog" ON "public"."shop_catalog" FOR UPDATE USING (true);



CREATE POLICY "Users can update their shop checkbook entries" ON "public"."shop_checkbook_entries" FOR UPDATE USING (("shop_id" = COALESCE(( SELECT "profiles"."shop_id"
   FROM "public"."profiles"
  WHERE ("profiles"."user_id" = "auth"."uid"())), (("current_setting"('request.jwt.claims'::"text", true))::json ->> 'shop_id'::"text"))));



CREATE POLICY "Users can update their shop claims" ON "public"."claims" FOR UPDATE USING (("shop_id" = COALESCE(( SELECT "profiles"."shop_id"
   FROM "public"."profiles"
  WHERE ("profiles"."user_id" = "auth"."uid"())), (("current_setting"('request.jwt.claims'::"text", true))::json ->> 'shop_id'::"text"))));



CREATE POLICY "Users can update their shop inventory counts" ON "public"."inventory_counts" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Users can update their shop repair requests" ON "public"."repair_requests" FOR UPDATE USING (("shop_id" = COALESCE(( SELECT "profiles"."shop_id"
   FROM "public"."profiles"
  WHERE ("profiles"."user_id" = "auth"."uid"())), (("current_setting"('request.jwt.claims'::"text", true))::json ->> 'shop_id'::"text"))));



CREATE POLICY "Users can update their shop weekly sales" ON "public"."weekly_sales_data" FOR UPDATE USING (("shop_id" = COALESCE(( SELECT "profiles"."shop_id"
   FROM "public"."profiles"
  WHERE ("profiles"."user_id" = "auth"."uid"())), (("current_setting"('request.jwt.claims'::"text", true))::json ->> 'shop_id'::"text"))));



CREATE POLICY "Users can update their shop workbook entries" ON "public"."shop_workbook_entries" FOR UPDATE USING (("shop_id" = COALESCE(( SELECT "profiles"."shop_id"
   FROM "public"."profiles"
  WHERE ("profiles"."user_id" = "auth"."uid"())), (("current_setting"('request.jwt.claims'::"text", true))::json ->> 'shop_id'::"text"))));



CREATE POLICY "Users can update their shop's KPI projections" ON "public"."kpi_projections" FOR UPDATE USING (true);



CREATE POLICY "Users can update their shop's SPIF data" ON "public"."spif_tracker" FOR UPDATE USING (true);



CREATE POLICY "Users can update their shop's SPIFF data" ON "public"."spiff_gain_loss_tracking" FOR UPDATE USING (true);



CREATE POLICY "Users can update their shop's challenge logs" ON "public"."challenges_log" FOR UPDATE USING (true);



CREATE POLICY "Users can update their shop's checkbook monthly totals" ON "public"."daily_checkbook_monthly_totals" FOR UPDATE USING (true);



CREATE POLICY "Users can update their shop's customers" ON "public"."crash_kit_customers" FOR UPDATE USING (true);



CREATE POLICY "Users can update their shop's employee hours" ON "public"."employee_hours_tracking" FOR UPDATE USING (true);



CREATE POLICY "Users can update their shop's invoices" ON "public"."crash_kit_invoices" FOR UPDATE USING (true);



CREATE POLICY "Users can update their shop's labor staff entries" ON "public"."labor_staff_entries" FOR UPDATE USING (true);



CREATE POLICY "Users can update their shop's logbook" ON "public"."crash_kit_logbook" FOR UPDATE USING (true);



CREATE POLICY "Users can update their shop's logbook close entries" ON "public"."daily_logbook_close" FOR UPDATE USING (("shop_id" = "current_setting"('app.shop_id'::"text", true)));



CREATE POLICY "Users can update their shop's logbook entries" ON "public"."daily_logbook_entries" FOR UPDATE USING (true);



CREATE POLICY "Users can update their shop's offline queue" ON "public"."crash_kit_offline_queue" FOR UPDATE USING (true);



CREATE POLICY "Users can update their shop's projections" ON "public"."weekly_projections" FOR UPDATE USING (true);



CREATE POLICY "Users can update their shop's vehicles" ON "public"."crash_kit_vehicles" FOR UPDATE USING (true);



CREATE POLICY "Users can update their shop's workbook monthly totals" ON "public"."daily_workbook_monthly_totals" FOR UPDATE USING (true);



CREATE POLICY "Users can update turned logs for their shop" ON "public"."turned_logs" FOR UPDATE USING (true);



CREATE POLICY "Users can view DM logbook entries for their shop" ON "public"."dm_logbook" FOR SELECT USING (true);



CREATE POLICY "Users can view KPIs for their shop" ON "public"."employee_kpis" FOR SELECT USING (true);



CREATE POLICY "Users can view POS buttons for their shop" ON "public"."pos_buttons" FOR SELECT USING (true);



CREATE POLICY "Users can view VIN cache" ON "public"."vin_decode_cache" FOR SELECT USING (true);



CREATE POLICY "Users can view alignment data" ON "public"."Shop_alignment" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Users can view all checklists" ON "public"."opening_closing_checklists" FOR SELECT USING (true);



CREATE POLICY "Users can view all count sheet items" ON "public"."shop_count_sheet_items" FOR SELECT USING (true);



CREATE POLICY "Users can view all count sheets" ON "public"."shop_count_sheets" FOR SELECT USING (true);



CREATE POLICY "Users can view all micro challenges" ON "public"."micro_challenges" FOR SELECT USING (true);



CREATE POLICY "Users can view all products" ON "public"."shop_master_products" FOR SELECT USING (true);



CREATE POLICY "Users can view all scanned items" ON "public"."ai_scanned_items" FOR SELECT USING (true);



CREATE POLICY "Users can view all shop categories" ON "public"."shop_categories" FOR SELECT USING (true);



CREATE POLICY "Users can view all shops" ON "public"."shops" FOR SELECT USING (true);



CREATE POLICY "Users can view budgets" ON "public"."budgets" FOR SELECT USING (true);



CREATE POLICY "Users can view certifications for their shop" ON "public"."employee_service_certifications" FOR SELECT USING (true);



CREATE POLICY "Users can view claims logs for their shop" ON "public"."claims_log" FOR SELECT USING (true);



CREATE POLICY "Users can view coaching logs for their shop" ON "public"."coaching_logs" FOR SELECT USING (true);



CREATE POLICY "Users can view contacts for their shop" ON "public"."contacts" FOR SELECT USING (true);



CREATE POLICY "Users can view daily counts for their shop" ON "public"."turned_log_daily_counts" FOR SELECT USING (true);



CREATE POLICY "Users can view fleet accounts for their shop" ON "public"."fleet_accounts" FOR SELECT USING (true);



CREATE POLICY "Users can view goals for their shop" ON "public"."employee_goals" FOR SELECT USING (true);



CREATE POLICY "Users can view inventory export logs for their shop" ON "public"."inventory_export_logs" FOR SELECT USING (true);



CREATE POLICY "Users can view invoice_items" ON "public"."invoice_items" FOR SELECT USING (true);



CREATE POLICY "Users can view invoices" ON "public"."invoices" FOR SELECT USING (true);



CREATE POLICY "Users can view leaderboard" ON "public"."speed_training_leaderboard" FOR SELECT USING (true);



CREATE POLICY "Users can view leaderboard for their shop" ON "public"."game_leaderboard" FOR SELECT USING (true);



CREATE POLICY "Users can view logs for their shop" ON "public"."employee_master_logs" FOR SELECT USING (true);



CREATE POLICY "Users can view master inventory" ON "public"."master_inventory_list" FOR SELECT USING (true);



CREATE POLICY "Users can view master inventory list" ON "public"."master-inventory-list" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Users can view master inventory list 10.25.25" ON "public"."master-inventory-list 10.25.25" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Users can view meetings for their shop" ON "public"."employee_meetings" FOR SELECT USING (true);



CREATE POLICY "Users can view nested POS buttons" ON "public"."pos_nested_buttons" FOR SELECT USING (true);



CREATE POLICY "Users can view nested buttons for their shop" ON "public"."pos_nested_buttons" FOR SELECT USING (("parent_button_id" IN ( SELECT "pos_buttons"."id"
   FROM "public"."pos_buttons"
  WHERE ("pos_buttons"."shop_id" = "current_setting"('app.current_shop_id'::"text", true)))));



CREATE POLICY "Users can view own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view pos_button_groups" ON "public"."pos_button_groups" FOR SELECT USING (true);



CREATE POLICY "Users can view pos_buttons" ON "public"."pos_buttons" FOR SELECT USING (true);



CREATE POLICY "Users can view products" ON "public"."crash_kit_products" FOR SELECT USING (true);



CREATE POLICY "Users can view reviews for their shop" ON "public"."performance_reviews" FOR SELECT USING (true);



CREATE POLICY "Users can view shifts for their shop" ON "public"."employee_shifts" FOR SELECT USING (true);



CREATE POLICY "Users can view shop alignment data" ON "public"."shop_alignment" FOR SELECT USING (true);



CREATE POLICY "Users can view solink audits for their shop" ON "public"."solink_audits" FOR SELECT USING (true);



CREATE POLICY "Users can view staff for their shop" ON "public"."shop_staff" FOR SELECT USING (true);



CREATE POLICY "Users can view supply ordering logs for their shop" ON "public"."supply_ordering_log" FOR SELECT USING (("shop_id" IN ( SELECT "profiles"."shop_id"
   FROM "public"."profiles"
  WHERE ("profiles"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view supply orders for their shop" ON "public"."supply_orders" FOR SELECT USING (true);



CREATE POLICY "Users can view termed employees for their shop" ON "public"."termed_employees" FOR SELECT USING (true);



CREATE POLICY "Users can view their export history" ON "public"."inventory_export_history" FOR SELECT USING (true);



CREATE POLICY "Users can view their own game runs" ON "public"."game_runs" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own profile" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own runs" ON "public"."speed_training_runs" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view their own shop's KPI daily data" ON "public"."kpi_daily" FOR SELECT USING (("shop_id" IN ( SELECT "profiles"."shop_id"
   FROM "public"."profiles"
  WHERE ("profiles"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view their own shop's KPI goals" ON "public"."kpi_goals" FOR SELECT USING (("shop_id" IN ( SELECT "profiles"."shop_id"
   FROM "public"."profiles"
  WHERE ("profiles"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view their own shop's KPI imports" ON "public"."kpi_imports" FOR SELECT USING (("shop_id" IN ( SELECT "profiles"."shop_id"
   FROM "public"."profiles"
  WHERE ("profiles"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view their own turned logs" ON "public"."turned_logs" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view their own workbook entries" ON "public"."workbook_entries" FOR SELECT USING (("created_by" = "auth"."uid"()));



CREATE POLICY "Users can view their shop R&M logs" ON "public"."repairs_maintenance_log" FOR SELECT USING (("building_id" = COALESCE(( SELECT "profiles"."shop_id"
   FROM "public"."profiles"
  WHERE ("profiles"."user_id" = "auth"."uid"())), (("current_setting"('request.jwt.claims'::"text", true))::json ->> 'shop_id'::"text"))));



COMMENT ON POLICY "Users can view their shop R&M logs" ON "public"."repairs_maintenance_log" IS 'Secure RLS using profiles table instead of user_metadata (Security Audit Fix - Jan 2025)';



CREATE POLICY "Users can view their shop catalog" ON "public"."shop_catalog" FOR SELECT USING (true);



CREATE POLICY "Users can view their shop checkbook entries" ON "public"."shop_checkbook_entries" FOR SELECT USING (("shop_id" = COALESCE(( SELECT "profiles"."shop_id"
   FROM "public"."profiles"
  WHERE ("profiles"."user_id" = "auth"."uid"())), (("current_setting"('request.jwt.claims'::"text", true))::json ->> 'shop_id'::"text"))));



CREATE POLICY "Users can view their shop claims" ON "public"."claims" FOR SELECT USING (("shop_id" = COALESCE(( SELECT "profiles"."shop_id"
   FROM "public"."profiles"
  WHERE ("profiles"."user_id" = "auth"."uid"())), (("current_setting"('request.jwt.claims'::"text", true))::json ->> 'shop_id'::"text"))));



COMMENT ON POLICY "Users can view their shop claims" ON "public"."claims" IS 'Secure RLS using profiles table instead of user_metadata (Security Audit Fix - Jan 2025)';



CREATE POLICY "Users can view their shop inventory counts" ON "public"."inventory_counts" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Users can view their shop repair requests" ON "public"."repair_requests" FOR SELECT USING (("shop_id" = COALESCE(( SELECT "profiles"."shop_id"
   FROM "public"."profiles"
  WHERE ("profiles"."user_id" = "auth"."uid"())), (("current_setting"('request.jwt.claims'::"text", true))::json ->> 'shop_id'::"text"))));



COMMENT ON POLICY "Users can view their shop repair requests" ON "public"."repair_requests" IS 'Secure RLS using profiles table instead of user_metadata (Security Audit Fix - Jan 2025)';



CREATE POLICY "Users can view their shop weekly sales" ON "public"."weekly_sales_data" FOR SELECT USING (("shop_id" = COALESCE(( SELECT "profiles"."shop_id"
   FROM "public"."profiles"
  WHERE ("profiles"."user_id" = "auth"."uid"())), (("current_setting"('request.jwt.claims'::"text", true))::json ->> 'shop_id'::"text"))));



CREATE POLICY "Users can view their shop workbook entries" ON "public"."shop_workbook_entries" FOR SELECT USING (("shop_id" = COALESCE(( SELECT "profiles"."shop_id"
   FROM "public"."profiles"
  WHERE ("profiles"."user_id" = "auth"."uid"())), (("current_setting"('request.jwt.claims'::"text", true))::json ->> 'shop_id'::"text"))));



CREATE POLICY "Users can view their shop's KPI projections" ON "public"."kpi_projections" FOR SELECT USING (true);



CREATE POLICY "Users can view their shop's SPIF data" ON "public"."spif_tracker" FOR SELECT USING (true);



CREATE POLICY "Users can view their shop's SPIFF data" ON "public"."spiff_gain_loss_tracking" FOR SELECT USING (true);



CREATE POLICY "Users can view their shop's challenge logs" ON "public"."challenges_log" FOR SELECT USING (true);



CREATE POLICY "Users can view their shop's checkbook monthly totals" ON "public"."daily_checkbook_monthly_totals" FOR SELECT USING (true);



CREATE POLICY "Users can view their shop's customers" ON "public"."crash_kit_customers" FOR SELECT USING (true);



CREATE POLICY "Users can view their shop's employee challenge logs" ON "public"."employee_challenge_logs" FOR SELECT USING (true);



CREATE POLICY "Users can view their shop's employee hours" ON "public"."employee_hours_tracking" FOR SELECT USING (true);



CREATE POLICY "Users can view their shop's invoices" ON "public"."crash_kit_invoices" FOR SELECT USING (true);



CREATE POLICY "Users can view their shop's labor staff entries" ON "public"."labor_staff_entries" FOR SELECT USING (true);



CREATE POLICY "Users can view their shop's logbook" ON "public"."crash_kit_logbook" FOR SELECT USING (true);



CREATE POLICY "Users can view their shop's logbook close entries" ON "public"."daily_logbook_close" FOR SELECT USING (("shop_id" = "current_setting"('app.shop_id'::"text", true)));



CREATE POLICY "Users can view their shop's logbook entries" ON "public"."daily_logbook" FOR SELECT USING (("shop_id" IN ( SELECT "turned_logs"."shop_id"
   FROM "public"."turned_logs"
  WHERE ("turned_logs"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view their shop's logbook entries" ON "public"."daily_logbook_entries" FOR SELECT USING (true);



CREATE POLICY "Users can view their shop's offline queue" ON "public"."crash_kit_offline_queue" FOR SELECT USING (true);



CREATE POLICY "Users can view their shop's projections" ON "public"."weekly_projections" FOR SELECT USING (true);



CREATE POLICY "Users can view their shop's vehicles" ON "public"."crash_kit_vehicles" FOR SELECT USING (true);



CREATE POLICY "Users can view their shop's workbook monthly totals" ON "public"."daily_workbook_monthly_totals" FOR SELECT USING (true);



CREATE POLICY "Users can view turned logs for their shop" ON "public"."turned_logs" FOR SELECT USING (true);



ALTER TABLE "public"."ai_scanned_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."alignment_master" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."app_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."budgets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."category_keywords" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."challenges_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."claims" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."claims_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."coaching_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contacts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."crash_kit_customers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."crash_kit_invoices" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."crash_kit_logbook" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."crash_kit_offline_queue" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."crash_kit_products" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."crash_kit_vehicles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."crew_challenges" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "d_align_admin" ON "public"."alignment_master" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."user_id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))));



ALTER TABLE "public"."daily_cadence" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."daily_checkbook_monthly_totals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."daily_log_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."daily_logbook" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."daily_logbook_close" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."daily_logbook_entries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."daily_sales_entries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."daily_summary_reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."daily_workbook_monthly_totals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."districts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."dm_logbook" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."dm_schedule" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "emp_read" ON "public"."employees" FOR SELECT USING ((("auth"."jwt"() ->> 'role'::"text") = ANY (ARRAY['RD'::"text", 'DM'::"text", 'SM'::"text", 'admin'::"text"])));



CREATE POLICY "emp_update_phone" ON "public"."employees" FOR UPDATE USING ((("auth"."jwt"() ->> 'role'::"text") = ANY (ARRAY['RD'::"text", 'DM'::"text", 'SM'::"text", 'admin'::"text"])));



ALTER TABLE "public"."employee_challenge_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."employee_challenges" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."employee_coaching" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."employee_development" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."employee_goals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."employee_hours_tracking" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."employee_kpis" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."employee_logbook" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."employee_master_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."employee_meetings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."employee_schedules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."employee_service_certifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."employee_shifts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."employee_training" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."employees" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."equipment_check_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."equipment_check_selections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."export_snapshots" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."fleet_accounts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."game_decks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."game_leaderboard" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."game_results" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."game_runs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."import_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inventory_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inventory_counts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inventory_counts_v2" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inventory_export_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inventory_export_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inventory_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inventory_staging" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."invoice_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."invoices" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."item_numbers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."kpi_daily" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."kpi_goals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."kpi_imports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."kpi_projections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."labor_staff_entries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."labor_tracking" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."manager_challenges" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "managers insert coaching" ON "public"."employee_coaching" FOR INSERT WITH CHECK (true);



CREATE POLICY "managers insert logbook" ON "public"."employee_logbook" FOR INSERT WITH CHECK (true);



CREATE POLICY "managers read coaching" ON "public"."employee_coaching" FOR SELECT USING (true);



CREATE POLICY "managers read logbook" ON "public"."employee_logbook" FOR SELECT USING (true);



ALTER TABLE "public"."master-inventory-list" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."master-inventory-list 10.25.25" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."master_checklist_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."master_checklist_reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."master_checklist_responses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."master_inventory_list" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."master_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."master_products" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."micro_challenges" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mod_challenges" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."opening_closing_checklists" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."performance_reviews" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pos_button_color_palette" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pos_button_groups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pos_buttons" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pos_nested_buttons" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."price_list" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "r_align" ON "public"."alignment_master" FOR SELECT USING (true);



CREATE POLICY "r_master_items" ON "public"."master_items" FOR SELECT USING (true);



CREATE POLICY "r_shop_overrides_select" ON "public"."shop_overrides" FOR SELECT USING (true);



ALTER TABLE "public"."refunds" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."regions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."repair_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."repairs_maintenance_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."retail_calendar" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "service can do all" ON "public"."employee_coaching" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (true);



CREATE POLICY "service can do all logbook" ON "public"."employee_logbook" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (true);



ALTER TABLE "public"."service_catalog" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "shop inv delete dev" ON "public"."shop_inventory_items" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "shop inv read dev" ON "public"."shop_inventory_items" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "shop inv update dev" ON "public"."shop_inventory_items" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "shop inv write dev" ON "public"."shop_inventory_items" FOR INSERT TO "authenticated" WITH CHECK (true);



ALTER TABLE "public"."shop_alignment" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."shop_catalog" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."shop_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."shop_checkbook_entries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."shop_count_sheet_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."shop_count_sheets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."shop_inventory_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."shop_inventory_profile" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."shop_master_products" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."shop_overrides" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."shop_staff" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."shop_workbook_entries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."shops" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."solink_audits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."speed_training_leaderboard" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."speed_training_runs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."spif_tracker" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."spiff_gain_loss_tracking" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."supply_ordering_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."supply_orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."termed_employees" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."turned_log_daily_counts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."turned_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "u_align_admin" ON "public"."alignment_master" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."user_id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))));



CREATE POLICY "u_shop_overrides_update" ON "public"."shop_overrides" FOR UPDATE USING (true);



ALTER TABLE "public"."upload_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vin_decode_cache" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "w_align_admin" ON "public"."alignment_master" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."user_id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))));



CREATE POLICY "w_shop_overrides_insert" ON "public"."shop_overrides" FOR INSERT WITH CHECK (true);



ALTER TABLE "public"."weekly_projections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."weekly_sales_data" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."work_calendar_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."workbook_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."workbook_entries" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."_ensure_counts"() TO "anon";
GRANT ALL ON FUNCTION "public"."_ensure_counts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."_ensure_counts"() TO "service_role";



GRANT ALL ON FUNCTION "public"."_touch_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."_touch_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."_touch_updated_at"() TO "service_role";



GRANT ALL ON PROCEDURE "public"."adopt_master_for_shop"(IN "_shop_id" "text", IN "_force" boolean) TO "anon";
GRANT ALL ON PROCEDURE "public"."adopt_master_for_shop"(IN "_shop_id" "text", IN "_force" boolean) TO "authenticated";
GRANT ALL ON PROCEDURE "public"."adopt_master_for_shop"(IN "_shop_id" "text", IN "_force" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."auto_tag_retail_period"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_tag_retail_period"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_tag_retail_period"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_all_expired_logs"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_all_expired_logs"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_all_expired_logs"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_expired_challenges_logs"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_expired_challenges_logs"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_expired_challenges_logs"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_expired_claims_logs"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_expired_claims_logs"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_expired_claims_logs"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_expired_rm_logs"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_expired_rm_logs"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_expired_rm_logs"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_expired_solink_audits"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_expired_solink_audits"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_expired_solink_audits"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_expired_supply_logs"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_expired_supply_logs"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_expired_supply_logs"() TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_expired_challenge_logs"() TO "anon";
GRANT ALL ON FUNCTION "public"."delete_expired_challenge_logs"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_expired_challenge_logs"() TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_old_turned_logs"() TO "anon";
GRANT ALL ON FUNCTION "public"."delete_old_turned_logs"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_old_turned_logs"() TO "service_role";



GRANT ALL ON FUNCTION "public"."ensure_default_admin_employee"() TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_default_admin_employee"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_default_admin_employee"() TO "service_role";



GRANT ALL ON FUNCTION "public"."export_summary"("_shop_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."export_summary"("_shop_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."export_summary"("_shop_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."fork_inventory_for_shop"("p_shop_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."fork_inventory_for_shop"("p_shop_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fork_inventory_for_shop"("p_shop_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_invoice_code"("p_invoice" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_invoice_code"("p_invoice" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_invoice_code"("p_invoice" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_accessible_shops"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_accessible_shops"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_accessible_shops"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_districts_by_region"("p_region" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_districts_by_region"("p_region" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_districts_by_region"("p_region" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_regions"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_regions"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_regions"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_retail_period_week"("p_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_retail_period_week"("p_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_retail_period_week"("p_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_shops_by_district"("p_district" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_shops_by_district"("p_district" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_shops_by_district"("p_district" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_hierarchy"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_hierarchy"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_hierarchy"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."has_shop_inventory"("p_shop_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."has_shop_inventory"("p_shop_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_shop_inventory"("p_shop_id" "uuid") TO "service_role";



GRANT ALL ON PROCEDURE "public"."import_master_from_staging"() TO "anon";
GRANT ALL ON PROCEDURE "public"."import_master_from_staging"() TO "authenticated";
GRANT ALL ON PROCEDURE "public"."import_master_from_staging"() TO "service_role";



GRANT ALL ON PROCEDURE "public"."import_shop_from_staging"(IN "_shop_id" "text") TO "anon";
GRANT ALL ON PROCEDURE "public"."import_shop_from_staging"(IN "_shop_id" "text") TO "authenticated";
GRANT ALL ON PROCEDURE "public"."import_shop_from_staging"(IN "_shop_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."map_category_for_item"("_name" "text", "_type" "text", "_hint" "text", "_sku" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."map_category_for_item"("_name" "text", "_type" "text", "_hint" "text", "_sku" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."map_category_for_item"("_name" "text", "_type" "text", "_hint" "text", "_sku" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_import_count_modification"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_import_count_modification"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_import_count_modification"() TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_materialized_view"("view_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_materialized_view"("view_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_materialized_view"("view_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."reset_count_sheet"("p_shop_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."reset_count_sheet"("p_shop_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reset_count_sheet"("p_shop_id" "uuid") TO "service_role";



GRANT ALL ON PROCEDURE "public"."reset_shop_profile"(IN "_shop_id" "text", IN "_strategy" "text", IN "_drop_custom" boolean) TO "anon";
GRANT ALL ON PROCEDURE "public"."reset_shop_profile"(IN "_shop_id" "text", IN "_strategy" "text", IN "_drop_custom" boolean) TO "authenticated";
GRANT ALL ON PROCEDURE "public"."reset_shop_profile"(IN "_shop_id" "text", IN "_strategy" "text", IN "_drop_custom" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_inventory_last_changed_on_insert"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_inventory_last_changed_on_insert"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_inventory_last_changed_on_insert"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."tag_with_retail_calendar"() TO "anon";
GRANT ALL ON FUNCTION "public"."tag_with_retail_calendar"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."tag_with_retail_calendar"() TO "service_role";



GRANT ALL ON PROCEDURE "public"."toggle_shop_lock"(IN "_shop_id" "text", IN "_locked" boolean) TO "anon";
GRANT ALL ON PROCEDURE "public"."toggle_shop_lock"(IN "_shop_id" "text", IN "_locked" boolean) TO "authenticated";
GRANT ALL ON PROCEDURE "public"."toggle_shop_lock"(IN "_shop_id" "text", IN "_locked" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."touch_alignment_updated"() TO "anon";
GRANT ALL ON FUNCTION "public"."touch_alignment_updated"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."touch_alignment_updated"() TO "service_role";



GRANT ALL ON FUNCTION "public"."touch_profiles_updated"() TO "anon";
GRANT ALL ON FUNCTION "public"."touch_profiles_updated"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."touch_profiles_updated"() TO "service_role";



GRANT ALL ON FUNCTION "public"."touch_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."touch_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."touch_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_claims_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_claims_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_claims_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_count_sheet_items_last_modified"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_count_sheet_items_last_modified"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_count_sheet_items_last_modified"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_dm_schedule_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_dm_schedule_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_dm_schedule_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_inventory_last_changed"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_inventory_last_changed"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_inventory_last_changed"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_pos_price_for_invoice"("p_button_id" "uuid", "p_new_price" numeric, "p_invoice_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."update_pos_price_for_invoice"("p_button_id" "uuid", "p_new_price" numeric, "p_invoice_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_pos_price_for_invoice"("p_button_id" "uuid", "p_new_price" numeric, "p_invoice_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_shop_master_products_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_shop_master_products_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_shop_master_products_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_shops_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_shops_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_shops_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_turned_log_daily_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_turned_log_daily_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_turned_log_daily_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_turned_logs_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_turned_logs_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_turned_logs_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."user_has_shop_access"("target_shop_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."user_has_shop_access"("target_shop_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_has_shop_access"("target_shop_id" "text") TO "service_role";



GRANT ALL ON TABLE "public"."Shop_alignment" TO "anon";
GRANT ALL ON TABLE "public"."Shop_alignment" TO "authenticated";
GRANT ALL ON TABLE "public"."Shop_alignment" TO "service_role";



GRANT ALL ON TABLE "public"."ai_scanned_items" TO "anon";
GRANT ALL ON TABLE "public"."ai_scanned_items" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_scanned_items" TO "service_role";



GRANT ALL ON TABLE "public"."alignment_master" TO "anon";
GRANT ALL ON TABLE "public"."alignment_master" TO "authenticated";
GRANT ALL ON TABLE "public"."alignment_master" TO "service_role";



GRANT ALL ON TABLE "public"."app_settings" TO "anon";
GRANT ALL ON TABLE "public"."app_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."app_settings" TO "service_role";



GRANT ALL ON TABLE "public"."budgets" TO "anon";
GRANT ALL ON TABLE "public"."budgets" TO "authenticated";
GRANT ALL ON TABLE "public"."budgets" TO "service_role";



GRANT ALL ON TABLE "public"."categories" TO "anon";
GRANT ALL ON TABLE "public"."categories" TO "authenticated";
GRANT ALL ON TABLE "public"."categories" TO "service_role";



GRANT ALL ON TABLE "public"."category_keywords" TO "anon";
GRANT ALL ON TABLE "public"."category_keywords" TO "authenticated";
GRANT ALL ON TABLE "public"."category_keywords" TO "service_role";



GRANT ALL ON SEQUENCE "public"."category_keywords_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."category_keywords_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."category_keywords_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."challenges_log" TO "anon";
GRANT ALL ON TABLE "public"."challenges_log" TO "authenticated";
GRANT ALL ON TABLE "public"."challenges_log" TO "service_role";



GRANT ALL ON TABLE "public"."claims" TO "anon";
GRANT ALL ON TABLE "public"."claims" TO "authenticated";
GRANT ALL ON TABLE "public"."claims" TO "service_role";



GRANT ALL ON TABLE "public"."claims_log" TO "anon";
GRANT ALL ON TABLE "public"."claims_log" TO "authenticated";
GRANT ALL ON TABLE "public"."claims_log" TO "service_role";



GRANT ALL ON TABLE "public"."coaching_logs" TO "anon";
GRANT ALL ON TABLE "public"."coaching_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."coaching_logs" TO "service_role";



GRANT ALL ON TABLE "public"."contacts" TO "anon";
GRANT ALL ON TABLE "public"."contacts" TO "authenticated";
GRANT ALL ON TABLE "public"."contacts" TO "service_role";



GRANT ALL ON TABLE "public"."crash_kit_customers" TO "anon";
GRANT ALL ON TABLE "public"."crash_kit_customers" TO "authenticated";
GRANT ALL ON TABLE "public"."crash_kit_customers" TO "service_role";



GRANT ALL ON TABLE "public"."crash_kit_invoices" TO "anon";
GRANT ALL ON TABLE "public"."crash_kit_invoices" TO "authenticated";
GRANT ALL ON TABLE "public"."crash_kit_invoices" TO "service_role";



GRANT ALL ON TABLE "public"."crash_kit_logbook" TO "anon";
GRANT ALL ON TABLE "public"."crash_kit_logbook" TO "authenticated";
GRANT ALL ON TABLE "public"."crash_kit_logbook" TO "service_role";



GRANT ALL ON TABLE "public"."crash_kit_offline_queue" TO "anon";
GRANT ALL ON TABLE "public"."crash_kit_offline_queue" TO "authenticated";
GRANT ALL ON TABLE "public"."crash_kit_offline_queue" TO "service_role";



GRANT ALL ON TABLE "public"."crash_kit_products" TO "anon";
GRANT ALL ON TABLE "public"."crash_kit_products" TO "authenticated";
GRANT ALL ON TABLE "public"."crash_kit_products" TO "service_role";



GRANT ALL ON TABLE "public"."crash_kit_vehicles" TO "anon";
GRANT ALL ON TABLE "public"."crash_kit_vehicles" TO "authenticated";
GRANT ALL ON TABLE "public"."crash_kit_vehicles" TO "service_role";



GRANT ALL ON TABLE "public"."crew_challenges" TO "anon";
GRANT ALL ON TABLE "public"."crew_challenges" TO "authenticated";
GRANT ALL ON TABLE "public"."crew_challenges" TO "service_role";



GRANT ALL ON TABLE "public"."daily_cadence" TO "anon";
GRANT ALL ON TABLE "public"."daily_cadence" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_cadence" TO "service_role";



GRANT ALL ON TABLE "public"."daily_checkbook_monthly_totals" TO "anon";
GRANT ALL ON TABLE "public"."daily_checkbook_monthly_totals" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_checkbook_monthly_totals" TO "service_role";



GRANT ALL ON TABLE "public"."daily_log_config" TO "anon";
GRANT ALL ON TABLE "public"."daily_log_config" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_log_config" TO "service_role";



GRANT ALL ON TABLE "public"."daily_logbook" TO "anon";
GRANT ALL ON TABLE "public"."daily_logbook" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_logbook" TO "service_role";



GRANT ALL ON TABLE "public"."daily_logbook_close" TO "anon";
GRANT ALL ON TABLE "public"."daily_logbook_close" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_logbook_close" TO "service_role";



GRANT ALL ON TABLE "public"."daily_logbook_entries" TO "anon";
GRANT ALL ON TABLE "public"."daily_logbook_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_logbook_entries" TO "service_role";



GRANT ALL ON TABLE "public"."daily_sales_entries" TO "anon";
GRANT ALL ON TABLE "public"."daily_sales_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_sales_entries" TO "service_role";



GRANT ALL ON TABLE "public"."daily_summary_reports" TO "anon";
GRANT ALL ON TABLE "public"."daily_summary_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_summary_reports" TO "service_role";



GRANT ALL ON TABLE "public"."daily_workbook_monthly_totals" TO "anon";
GRANT ALL ON TABLE "public"."daily_workbook_monthly_totals" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_workbook_monthly_totals" TO "service_role";



GRANT ALL ON TABLE "public"."districts" TO "anon";
GRANT ALL ON TABLE "public"."districts" TO "authenticated";
GRANT ALL ON TABLE "public"."districts" TO "service_role";



GRANT ALL ON TABLE "public"."dm_logbook" TO "anon";
GRANT ALL ON TABLE "public"."dm_logbook" TO "authenticated";
GRANT ALL ON TABLE "public"."dm_logbook" TO "service_role";



GRANT ALL ON TABLE "public"."dm_schedule" TO "anon";
GRANT ALL ON TABLE "public"."dm_schedule" TO "authenticated";
GRANT ALL ON TABLE "public"."dm_schedule" TO "service_role";



GRANT ALL ON TABLE "public"."employee_challenge_logs" TO "anon";
GRANT ALL ON TABLE "public"."employee_challenge_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."employee_challenge_logs" TO "service_role";



GRANT ALL ON TABLE "public"."employee_challenges" TO "anon";
GRANT ALL ON TABLE "public"."employee_challenges" TO "authenticated";
GRANT ALL ON TABLE "public"."employee_challenges" TO "service_role";



GRANT ALL ON TABLE "public"."employee_coaching" TO "anon";
GRANT ALL ON TABLE "public"."employee_coaching" TO "authenticated";
GRANT ALL ON TABLE "public"."employee_coaching" TO "service_role";



GRANT ALL ON TABLE "public"."employee_development" TO "anon";
GRANT ALL ON TABLE "public"."employee_development" TO "authenticated";
GRANT ALL ON TABLE "public"."employee_development" TO "service_role";



GRANT ALL ON TABLE "public"."employee_goals" TO "anon";
GRANT ALL ON TABLE "public"."employee_goals" TO "authenticated";
GRANT ALL ON TABLE "public"."employee_goals" TO "service_role";



GRANT ALL ON TABLE "public"."employee_hours_tracking" TO "anon";
GRANT ALL ON TABLE "public"."employee_hours_tracking" TO "authenticated";
GRANT ALL ON TABLE "public"."employee_hours_tracking" TO "service_role";



GRANT ALL ON TABLE "public"."employee_kpis" TO "anon";
GRANT ALL ON TABLE "public"."employee_kpis" TO "authenticated";
GRANT ALL ON TABLE "public"."employee_kpis" TO "service_role";



GRANT ALL ON TABLE "public"."employee_logbook" TO "anon";
GRANT ALL ON TABLE "public"."employee_logbook" TO "authenticated";
GRANT ALL ON TABLE "public"."employee_logbook" TO "service_role";



GRANT ALL ON TABLE "public"."employee_master_logs" TO "anon";
GRANT ALL ON TABLE "public"."employee_master_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."employee_master_logs" TO "service_role";



GRANT ALL ON TABLE "public"."employee_meetings" TO "anon";
GRANT ALL ON TABLE "public"."employee_meetings" TO "authenticated";
GRANT ALL ON TABLE "public"."employee_meetings" TO "service_role";



GRANT ALL ON TABLE "public"."employee_schedules" TO "anon";
GRANT ALL ON TABLE "public"."employee_schedules" TO "authenticated";
GRANT ALL ON TABLE "public"."employee_schedules" TO "service_role";



GRANT ALL ON TABLE "public"."employee_service_certifications" TO "anon";
GRANT ALL ON TABLE "public"."employee_service_certifications" TO "authenticated";
GRANT ALL ON TABLE "public"."employee_service_certifications" TO "service_role";



GRANT ALL ON TABLE "public"."employee_shifts" TO "anon";
GRANT ALL ON TABLE "public"."employee_shifts" TO "authenticated";
GRANT ALL ON TABLE "public"."employee_shifts" TO "service_role";



GRANT ALL ON TABLE "public"."employee_training" TO "anon";
GRANT ALL ON TABLE "public"."employee_training" TO "authenticated";
GRANT ALL ON TABLE "public"."employee_training" TO "service_role";



GRANT ALL ON TABLE "public"."employees" TO "anon";
GRANT ALL ON TABLE "public"."employees" TO "authenticated";
GRANT ALL ON TABLE "public"."employees" TO "service_role";



GRANT ALL ON TABLE "public"."equipment_check_logs" TO "anon";
GRANT ALL ON TABLE "public"."equipment_check_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."equipment_check_logs" TO "service_role";



GRANT ALL ON TABLE "public"."equipment_check_selections" TO "anon";
GRANT ALL ON TABLE "public"."equipment_check_selections" TO "authenticated";
GRANT ALL ON TABLE "public"."equipment_check_selections" TO "service_role";



GRANT ALL ON TABLE "public"."export_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."export_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."export_snapshots" TO "service_role";



GRANT ALL ON TABLE "public"."fleet_accounts" TO "anon";
GRANT ALL ON TABLE "public"."fleet_accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."fleet_accounts" TO "service_role";



GRANT ALL ON TABLE "public"."game_decks" TO "anon";
GRANT ALL ON TABLE "public"."game_decks" TO "authenticated";
GRANT ALL ON TABLE "public"."game_decks" TO "service_role";



GRANT ALL ON TABLE "public"."game_leaderboard" TO "anon";
GRANT ALL ON TABLE "public"."game_leaderboard" TO "authenticated";
GRANT ALL ON TABLE "public"."game_leaderboard" TO "service_role";



GRANT ALL ON TABLE "public"."game_results" TO "anon";
GRANT ALL ON TABLE "public"."game_results" TO "authenticated";
GRANT ALL ON TABLE "public"."game_results" TO "service_role";



GRANT ALL ON TABLE "public"."game_runs" TO "anon";
GRANT ALL ON TABLE "public"."game_runs" TO "authenticated";
GRANT ALL ON TABLE "public"."game_runs" TO "service_role";



GRANT ALL ON TABLE "public"."import_logs" TO "anon";
GRANT ALL ON TABLE "public"."import_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."import_logs" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_categories" TO "anon";
GRANT ALL ON TABLE "public"."inventory_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_categories" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_counts" TO "anon";
GRANT ALL ON TABLE "public"."inventory_counts" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_counts" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_counts_v2" TO "anon";
GRANT ALL ON TABLE "public"."inventory_counts_v2" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_counts_v2" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_export_history" TO "anon";
GRANT ALL ON TABLE "public"."inventory_export_history" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_export_history" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_export_logs" TO "anon";
GRANT ALL ON TABLE "public"."inventory_export_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_export_logs" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_items" TO "anon";
GRANT ALL ON TABLE "public"."inventory_items" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_items" TO "service_role";



GRANT ALL ON SEQUENCE "public"."inventory_items_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."inventory_items_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."inventory_items_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_staging" TO "anon";
GRANT ALL ON TABLE "public"."inventory_staging" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_staging" TO "service_role";



GRANT ALL ON SEQUENCE "public"."inventory_staging_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."inventory_staging_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."inventory_staging_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."invoice_items" TO "anon";
GRANT ALL ON TABLE "public"."invoice_items" TO "authenticated";
GRANT ALL ON TABLE "public"."invoice_items" TO "service_role";



GRANT ALL ON TABLE "public"."invoices" TO "anon";
GRANT ALL ON TABLE "public"."invoices" TO "authenticated";
GRANT ALL ON TABLE "public"."invoices" TO "service_role";



GRANT ALL ON TABLE "public"."item_numbers" TO "anon";
GRANT ALL ON TABLE "public"."item_numbers" TO "authenticated";
GRANT ALL ON TABLE "public"."item_numbers" TO "service_role";



GRANT ALL ON TABLE "public"."kpi_daily" TO "anon";
GRANT ALL ON TABLE "public"."kpi_daily" TO "authenticated";
GRANT ALL ON TABLE "public"."kpi_daily" TO "service_role";



GRANT ALL ON TABLE "public"."kpi_goals" TO "anon";
GRANT ALL ON TABLE "public"."kpi_goals" TO "authenticated";
GRANT ALL ON TABLE "public"."kpi_goals" TO "service_role";



GRANT ALL ON TABLE "public"."kpi_imports" TO "anon";
GRANT ALL ON TABLE "public"."kpi_imports" TO "authenticated";
GRANT ALL ON TABLE "public"."kpi_imports" TO "service_role";



GRANT ALL ON TABLE "public"."kpi_projections" TO "anon";
GRANT ALL ON TABLE "public"."kpi_projections" TO "authenticated";
GRANT ALL ON TABLE "public"."kpi_projections" TO "service_role";



GRANT ALL ON TABLE "public"."labor_staff_entries" TO "anon";
GRANT ALL ON TABLE "public"."labor_staff_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."labor_staff_entries" TO "service_role";



GRANT ALL ON TABLE "public"."labor_tracking" TO "anon";
GRANT ALL ON TABLE "public"."labor_tracking" TO "authenticated";
GRANT ALL ON TABLE "public"."labor_tracking" TO "service_role";



GRANT ALL ON TABLE "public"."manager_challenges" TO "anon";
GRANT ALL ON TABLE "public"."manager_challenges" TO "authenticated";
GRANT ALL ON TABLE "public"."manager_challenges" TO "service_role";



GRANT ALL ON TABLE "public"."master-inventory-list" TO "anon";
GRANT ALL ON TABLE "public"."master-inventory-list" TO "authenticated";
GRANT ALL ON TABLE "public"."master-inventory-list" TO "service_role";



GRANT ALL ON TABLE "public"."master-inventory-list 10.25.25" TO "anon";
GRANT ALL ON TABLE "public"."master-inventory-list 10.25.25" TO "authenticated";
GRANT ALL ON TABLE "public"."master-inventory-list 10.25.25" TO "service_role";



GRANT ALL ON TABLE "public"."master_checklist_items" TO "anon";
GRANT ALL ON TABLE "public"."master_checklist_items" TO "authenticated";
GRANT ALL ON TABLE "public"."master_checklist_items" TO "service_role";



GRANT ALL ON TABLE "public"."master_checklist_reports" TO "anon";
GRANT ALL ON TABLE "public"."master_checklist_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."master_checklist_reports" TO "service_role";



GRANT ALL ON TABLE "public"."master_checklist_responses" TO "anon";
GRANT ALL ON TABLE "public"."master_checklist_responses" TO "authenticated";
GRANT ALL ON TABLE "public"."master_checklist_responses" TO "service_role";



GRANT ALL ON TABLE "public"."master_inventory_list" TO "anon";
GRANT ALL ON TABLE "public"."master_inventory_list" TO "authenticated";
GRANT ALL ON TABLE "public"."master_inventory_list" TO "service_role";



GRANT ALL ON TABLE "public"."master_items" TO "anon";
GRANT ALL ON TABLE "public"."master_items" TO "authenticated";
GRANT ALL ON TABLE "public"."master_items" TO "service_role";



GRANT ALL ON TABLE "public"."master_products" TO "anon";
GRANT ALL ON TABLE "public"."master_products" TO "authenticated";
GRANT ALL ON TABLE "public"."master_products" TO "service_role";



GRANT ALL ON TABLE "public"."micro_challenges" TO "anon";
GRANT ALL ON TABLE "public"."micro_challenges" TO "authenticated";
GRANT ALL ON TABLE "public"."micro_challenges" TO "service_role";



GRANT ALL ON TABLE "public"."mod_challenges" TO "anon";
GRANT ALL ON TABLE "public"."mod_challenges" TO "authenticated";
GRANT ALL ON TABLE "public"."mod_challenges" TO "service_role";



GRANT ALL ON TABLE "public"."opening_closing_checklists" TO "anon";
GRANT ALL ON TABLE "public"."opening_closing_checklists" TO "authenticated";
GRANT ALL ON TABLE "public"."opening_closing_checklists" TO "service_role";



GRANT ALL ON TABLE "public"."performance_reviews" TO "anon";
GRANT ALL ON TABLE "public"."performance_reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."performance_reviews" TO "service_role";



GRANT ALL ON TABLE "public"."pos_button_color_palette" TO "anon";
GRANT ALL ON TABLE "public"."pos_button_color_palette" TO "authenticated";
GRANT ALL ON TABLE "public"."pos_button_color_palette" TO "service_role";



GRANT ALL ON TABLE "public"."pos_button_groups" TO "anon";
GRANT ALL ON TABLE "public"."pos_button_groups" TO "authenticated";
GRANT ALL ON TABLE "public"."pos_button_groups" TO "service_role";



GRANT ALL ON TABLE "public"."pos_buttons" TO "anon";
GRANT ALL ON TABLE "public"."pos_buttons" TO "authenticated";
GRANT ALL ON TABLE "public"."pos_buttons" TO "service_role";



GRANT ALL ON TABLE "public"."pos_nested_buttons" TO "anon";
GRANT ALL ON TABLE "public"."pos_nested_buttons" TO "authenticated";
GRANT ALL ON TABLE "public"."pos_nested_buttons" TO "service_role";



GRANT ALL ON TABLE "public"."price_list" TO "anon";
GRANT ALL ON TABLE "public"."price_list" TO "authenticated";
GRANT ALL ON TABLE "public"."price_list" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."refunds" TO "anon";
GRANT ALL ON TABLE "public"."refunds" TO "authenticated";
GRANT ALL ON TABLE "public"."refunds" TO "service_role";



GRANT ALL ON TABLE "public"."regions" TO "anon";
GRANT ALL ON TABLE "public"."regions" TO "authenticated";
GRANT ALL ON TABLE "public"."regions" TO "service_role";



GRANT ALL ON TABLE "public"."repair_requests" TO "anon";
GRANT ALL ON TABLE "public"."repair_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."repair_requests" TO "service_role";



GRANT ALL ON TABLE "public"."repairs_maintenance_log" TO "anon";
GRANT ALL ON TABLE "public"."repairs_maintenance_log" TO "authenticated";
GRANT ALL ON TABLE "public"."repairs_maintenance_log" TO "service_role";



GRANT ALL ON TABLE "public"."retail_calendar" TO "anon";
GRANT ALL ON TABLE "public"."retail_calendar" TO "authenticated";
GRANT ALL ON TABLE "public"."retail_calendar" TO "service_role";



GRANT ALL ON TABLE "public"."service_catalog" TO "anon";
GRANT ALL ON TABLE "public"."service_catalog" TO "authenticated";
GRANT ALL ON TABLE "public"."service_catalog" TO "service_role";



GRANT ALL ON TABLE "public"."shop_alignment" TO "anon";
GRANT ALL ON TABLE "public"."shop_alignment" TO "authenticated";
GRANT ALL ON TABLE "public"."shop_alignment" TO "service_role";



GRANT ALL ON TABLE "public"."shop_catalog" TO "anon";
GRANT ALL ON TABLE "public"."shop_catalog" TO "authenticated";
GRANT ALL ON TABLE "public"."shop_catalog" TO "service_role";



GRANT ALL ON TABLE "public"."shop_categories" TO "anon";
GRANT ALL ON TABLE "public"."shop_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."shop_categories" TO "service_role";



GRANT ALL ON TABLE "public"."shop_checkbook_entries" TO "anon";
GRANT ALL ON TABLE "public"."shop_checkbook_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."shop_checkbook_entries" TO "service_role";



GRANT ALL ON TABLE "public"."shop_count_sheet_items" TO "anon";
GRANT ALL ON TABLE "public"."shop_count_sheet_items" TO "authenticated";
GRANT ALL ON TABLE "public"."shop_count_sheet_items" TO "service_role";



GRANT ALL ON TABLE "public"."shop_count_sheets" TO "anon";
GRANT ALL ON TABLE "public"."shop_count_sheets" TO "authenticated";
GRANT ALL ON TABLE "public"."shop_count_sheets" TO "service_role";



GRANT ALL ON TABLE "public"."shop_inventory_items" TO "anon";
GRANT ALL ON TABLE "public"."shop_inventory_items" TO "authenticated";
GRANT ALL ON TABLE "public"."shop_inventory_items" TO "service_role";



GRANT ALL ON SEQUENCE "public"."shop_inventory_items_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."shop_inventory_items_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."shop_inventory_items_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."shop_inventory_profile" TO "anon";
GRANT ALL ON TABLE "public"."shop_inventory_profile" TO "authenticated";
GRANT ALL ON TABLE "public"."shop_inventory_profile" TO "service_role";



GRANT ALL ON TABLE "public"."shop_master_products" TO "anon";
GRANT ALL ON TABLE "public"."shop_master_products" TO "authenticated";
GRANT ALL ON TABLE "public"."shop_master_products" TO "service_role";



GRANT ALL ON TABLE "public"."shop_overrides" TO "anon";
GRANT ALL ON TABLE "public"."shop_overrides" TO "authenticated";
GRANT ALL ON TABLE "public"."shop_overrides" TO "service_role";



GRANT ALL ON TABLE "public"."shop_staff" TO "anon";
GRANT ALL ON TABLE "public"."shop_staff" TO "authenticated";
GRANT ALL ON TABLE "public"."shop_staff" TO "service_role";



GRANT ALL ON TABLE "public"."shop_workbook_entries" TO "anon";
GRANT ALL ON TABLE "public"."shop_workbook_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."shop_workbook_entries" TO "service_role";



GRANT ALL ON TABLE "public"."shops" TO "anon";
GRANT ALL ON TABLE "public"."shops" TO "authenticated";
GRANT ALL ON TABLE "public"."shops" TO "service_role";



GRANT ALL ON TABLE "public"."solink_audits" TO "anon";
GRANT ALL ON TABLE "public"."solink_audits" TO "authenticated";
GRANT ALL ON TABLE "public"."solink_audits" TO "service_role";



GRANT ALL ON TABLE "public"."speed_training_leaderboard" TO "anon";
GRANT ALL ON TABLE "public"."speed_training_leaderboard" TO "authenticated";
GRANT ALL ON TABLE "public"."speed_training_leaderboard" TO "service_role";



GRANT ALL ON TABLE "public"."speed_training_runs" TO "anon";
GRANT ALL ON TABLE "public"."speed_training_runs" TO "authenticated";
GRANT ALL ON TABLE "public"."speed_training_runs" TO "service_role";



GRANT ALL ON TABLE "public"."spif_tracker" TO "anon";
GRANT ALL ON TABLE "public"."spif_tracker" TO "authenticated";
GRANT ALL ON TABLE "public"."spif_tracker" TO "service_role";



GRANT ALL ON TABLE "public"."spiff_gain_loss_tracking" TO "anon";
GRANT ALL ON TABLE "public"."spiff_gain_loss_tracking" TO "authenticated";
GRANT ALL ON TABLE "public"."spiff_gain_loss_tracking" TO "service_role";



GRANT ALL ON TABLE "public"."supply_ordering_log" TO "anon";
GRANT ALL ON TABLE "public"."supply_ordering_log" TO "authenticated";
GRANT ALL ON TABLE "public"."supply_ordering_log" TO "service_role";



GRANT ALL ON TABLE "public"."supply_orders" TO "anon";
GRANT ALL ON TABLE "public"."supply_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."supply_orders" TO "service_role";



GRANT ALL ON TABLE "public"."termed_employees" TO "anon";
GRANT ALL ON TABLE "public"."termed_employees" TO "authenticated";
GRANT ALL ON TABLE "public"."termed_employees" TO "service_role";



GRANT ALL ON TABLE "public"."turned_log_daily_counts" TO "anon";
GRANT ALL ON TABLE "public"."turned_log_daily_counts" TO "authenticated";
GRANT ALL ON TABLE "public"."turned_log_daily_counts" TO "service_role";



GRANT ALL ON TABLE "public"."turned_logs" TO "anon";
GRANT ALL ON TABLE "public"."turned_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."turned_logs" TO "service_role";



GRANT ALL ON TABLE "public"."upload_logs" TO "anon";
GRANT ALL ON TABLE "public"."upload_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."upload_logs" TO "service_role";



GRANT ALL ON TABLE "public"."v_active_employees" TO "anon";
GRANT ALL ON TABLE "public"."v_active_employees" TO "authenticated";
GRANT ALL ON TABLE "public"."v_active_employees" TO "service_role";



GRANT ALL ON TABLE "public"."v_alignment_master" TO "anon";
GRANT ALL ON TABLE "public"."v_alignment_master" TO "authenticated";
GRANT ALL ON TABLE "public"."v_alignment_master" TO "service_role";



GRANT ALL ON TABLE "public"."v_employees_min" TO "anon";
GRANT ALL ON TABLE "public"."v_employees_min" TO "authenticated";
GRANT ALL ON TABLE "public"."v_employees_min" TO "service_role";



GRANT ALL ON TABLE "public"."v_inventory_by_category" TO "anon";
GRANT ALL ON TABLE "public"."v_inventory_by_category" TO "authenticated";
GRANT ALL ON TABLE "public"."v_inventory_by_category" TO "service_role";



GRANT ALL ON TABLE "public"."v_inventory_effective" TO "anon";
GRANT ALL ON TABLE "public"."v_inventory_effective" TO "authenticated";
GRANT ALL ON TABLE "public"."v_inventory_effective" TO "service_role";



GRANT ALL ON TABLE "public"."v_inventory_master" TO "anon";
GRANT ALL ON TABLE "public"."v_inventory_master" TO "authenticated";
GRANT ALL ON TABLE "public"."v_inventory_master" TO "service_role";



GRANT ALL ON TABLE "public"."v_kpi_board" TO "anon";
GRANT ALL ON TABLE "public"."v_kpi_board" TO "authenticated";
GRANT ALL ON TABLE "public"."v_kpi_board" TO "service_role";



GRANT ALL ON TABLE "public"."v_shop_effective_items" TO "anon";
GRANT ALL ON TABLE "public"."v_shop_effective_items" TO "authenticated";
GRANT ALL ON TABLE "public"."v_shop_effective_items" TO "service_role";



GRANT ALL ON TABLE "public"."vin_decode_cache" TO "anon";
GRANT ALL ON TABLE "public"."vin_decode_cache" TO "authenticated";
GRANT ALL ON TABLE "public"."vin_decode_cache" TO "service_role";



GRANT ALL ON TABLE "public"."weekly_projections" TO "anon";
GRANT ALL ON TABLE "public"."weekly_projections" TO "authenticated";
GRANT ALL ON TABLE "public"."weekly_projections" TO "service_role";



GRANT ALL ON TABLE "public"."weekly_sales_data" TO "anon";
GRANT ALL ON TABLE "public"."weekly_sales_data" TO "authenticated";
GRANT ALL ON TABLE "public"."weekly_sales_data" TO "service_role";



GRANT ALL ON TABLE "public"."work_calendar_config" TO "anon";
GRANT ALL ON TABLE "public"."work_calendar_config" TO "authenticated";
GRANT ALL ON TABLE "public"."work_calendar_config" TO "service_role";



GRANT ALL ON TABLE "public"."workbook_categories" TO "anon";
GRANT ALL ON TABLE "public"."workbook_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."workbook_categories" TO "service_role";



GRANT ALL ON TABLE "public"."workbook_entries" TO "anon";
GRANT ALL ON TABLE "public"."workbook_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."workbook_entries" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";








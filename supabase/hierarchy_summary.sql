-- View: public.hierarchy_summary_vw
-- NOTE: Adjust column names if your company_alignment table uses different casing.
-- This view can be shared by Pocket Manager5, Pulse Check5, and the web dashboard.

create or replace view public.hierarchy_summary_vw as
with base as (
  select
    lower(coalesce("Shop_Email", login)::text) as login,
    coalesce(scope_level, "Scope_Level", level, 'SHOP')::text as scope_level,
    coalesce("Division_Name", division_name)::text as division_name,
    coalesce("Region_Name", region_name)::text as region_name,
    coalesce("District_Name", district_name)::text as district_name,
    coalesce("Shop_Number", shop_number)::text as shop_number
  from public.company_alignment
),

district_shop_counts as (
  select district_name, region_name, count(*) filter (where shop_number is not null) as shops_in_district
  from base
  group by district_name, region_name
),

region_district_counts as (
  select
    region_name,
    count(distinct district_name) as districts_in_region,
    count(*) filter (where shop_number is not null) as shops_in_region
  from base
  group by region_name
),

division_region_counts as (
  select
    division_name,
    count(distinct region_name) as regions_in_division,
    count(*) filter (where shop_number is not null) as shops_in_division
  from base
  group by division_name
)
select
  base.login,
  base.scope_level,
  base.division_name,
  base.region_name,
  base.district_name,
  base.shop_number,
  district_shop_counts.shops_in_district,
  region_district_counts.districts_in_region,
  region_district_counts.shops_in_region,
  division_region_counts.regions_in_division,
  division_region_counts.shops_in_division
from base
left join district_shop_counts using (district_name, region_name)
left join region_district_counts using (region_name)
left join division_region_counts using (division_name);

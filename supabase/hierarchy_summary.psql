-- View: public.hierarchy_summary_vw
-- Uses existing public.company_alignment schema
-- Columns in company_alignment:
--   "Division", "Region", "District", "store", "Shop_Email", ...

create or replace view public.hierarchy_summary_vw as
with base as (
  select
    lower("Shop_Email"::text)                     as login,          -- e.g. '18@t5.com'
    'SHOP'::text                                  as scope_level,    -- for now everything is shop-level
    "Division"::text                              as division_name,  -- e.g. 'East'
    "Region"::text                                as region_name,    -- e.g. 'Gulf Coast'
    "District"::text                              as district_name,  -- e.g. 'Baton Rouge South'
    "store"::text                                 as shop_number     -- e.g. '18'
  from public.company_alignment
),

district_shop_counts as (
  select
    division_name,
    region_name,
    district_name,
    count(*) filter (where shop_number is not null) as shops_in_district
  from base
  group by division_name, region_name, district_name
),

region_district_counts as (
  select
    division_name,
    region_name,
    count(distinct district_name)                          as districts_in_region,
    count(*) filter (where shop_number is not null)        as shops_in_region
  from base
  group by division_name, region_name
),

division_region_counts as (
  select
    division_name,
    count(distinct region_name)                            as regions_in_division,
    count(*) filter (where shop_number is not null)        as shops_in_division
  from base
  group by division_name
)

select
  b.login,
  b.scope_level,
  b.division_name,
  b.region_name,
  b.district_name,
  b.shop_number,
  dsc.shops_in_district,
  rdc.districts_in_region,
  rdc.shops_in_region,
  drc.regions_in_division,
  drc.shops_in_division
from base b
left join district_shop_counts dsc
  on dsc.division_name = b.division_name
 and dsc.region_name   = b.region_name
 and dsc.district_name = b.district_name
left join region_district_counts rdc
  on rdc.division_name = b.division_name
 and rdc.region_name   = b.region_name
left join division_region_counts drc
  on drc.division_name = b.division_name;

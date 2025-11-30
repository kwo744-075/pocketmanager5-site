-- Includes SHOP, DISTRICT (DM), REGION (RD), and DIVISION (VP) scopes

create or replace view public.hierarchy_summary_vw as
with shop_rows as (
  select
    lower("Shop_Email"::text) as shop_login,
    "Division"::text          as division_name,
    "Region"::text            as region_name,
    "District"::text          as district_name,
    "store"::text             as shop_number
  from public.company_alignment
  where "Shop_Email" is not null
),

district_roles as (
  select
    lower("District_Email"::text) as login,
    'DISTRICT'::text              as scope_level,
    "Division"::text             as division_name,
    "Region"::text               as region_name,
    "District"::text             as district_name
  from public.company_alignment
  where "District_Email" is not null
  group by
    lower("District_Email"::text),
    "Division"::text,
    "Region"::text,
    "District"::text
),

region_roles as (
  select
    lower("Region_Email"::text) as login,
    'REGION'::text              as scope_level,
    "Division"::text           as division_name,
    "Region"::text             as region_name
  from public.company_alignment
  where "Region_Email" is not null
  group by
    lower("Region_Email"::text),
    "Division"::text,
    "Region"::text
),

division_roles as (
  select
    lower("Division_Email"::text) as login,
    'DIVISION'::text               as scope_level,
    "Division"::text              as division_name
  from public.company_alignment
  where "Division_Email" is not null
  group by
    lower("Division_Email"::text),
    "Division"::text
),

base as (
  select
    shop_login                     as login,
    'SHOP'::text                   as scope_level,
    division_name,
    region_name,
    district_name,
    shop_number
  from shop_rows

  union all

  select
    login,
    scope_level,
    division_name,
    region_name,
    district_name,
    null::text                     as shop_number
  from district_roles

  union all

  select
    login,
    scope_level,
    division_name,
    region_name,
    null::text                     as district_name,
    null::text                     as shop_number
  from region_roles

  union all

  select
    login,
    scope_level,
    division_name,
    null::text                     as region_name,
    null::text                     as district_name,
    null::text                     as shop_number
  from division_roles
),

district_shop_counts as (
  select
    division_name,
    region_name,
    district_name,
    count(*) as shops_in_district
  from shop_rows
  group by division_name, region_name, district_name
),

region_district_counts as (
  select
    division_name,
    region_name,
    count(distinct district_name) as districts_in_region,
    count(*)                     as shops_in_region
  from shop_rows
  group by division_name, region_name
),

division_region_counts as (
  select
    division_name,
    count(distinct region_name) as regions_in_division,
    count(*)                   as shops_in_division
  from shop_rows
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

-- View: public.shop_wtd_evening_totals
-- Provides week-to-date aggregates scoped to evening slots (5 PM + 8 PM)
-- Mirrors the shape of shop_wtd_totals but only counts evening submissions

create or replace view public.shop_wtd_evening_totals as
with evening_daily as (
  select
    shop_id,
    check_in_date::date as current_date,
    date_trunc('week', check_in_date::date)::date as week_start,
    coalesce(sum(cars), 0)      as total_cars,
    coalesce(sum(sales), 0)     as total_sales,
    coalesce(sum(big4), 0)      as total_big4,
    coalesce(sum(coolants), 0)  as total_coolants,
    coalesce(sum(diffs), 0)     as total_diffs,
    coalesce(sum(donations), 0) as total_donations,
    coalesce(sum(mobil1), 0)    as total_mobil1
  from public.check_ins
  where time_slot in ('5pm', '8pm')
  group by shop_id, check_in_date::date, date_trunc('week', check_in_date::date)
),
rolling as (
  select
    shop_id,
    week_start,
    current_date,
    sum(total_cars) over (partition by shop_id, week_start order by current_date rows between unbounded preceding and current row)      as total_cars,
    sum(total_sales) over (partition by shop_id, week_start order by current_date rows between unbounded preceding and current row)     as total_sales,
    sum(total_big4) over (partition by shop_id, week_start order by current_date rows between unbounded preceding and current row)      as total_big4,
    sum(total_coolants) over (partition by shop_id, week_start order by current_date rows between unbounded preceding and current row)  as total_coolants,
    sum(total_diffs) over (partition by shop_id, week_start order by current_date rows between unbounded preceding and current row)     as total_diffs,
    sum(total_donations) over (partition by shop_id, week_start order by current_date rows between unbounded preceding and current row) as total_donations,
    sum(total_mobil1) over (partition by shop_id, week_start order by current_date rows between unbounded preceding and current row)    as total_mobil1
  from evening_daily
)
select * from rolling;

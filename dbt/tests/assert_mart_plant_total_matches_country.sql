-- Mart düzeyinde: son 7 günün tam günlerinde (iki tarafta da 24 saat) santral toplamı (fct_generation_hourly)
-- = ülke toplamı (agg_generation_by_source_hourly), %0,5 tolerans. Dönen satırlar: farkı olan günler.
with country as (
    select date_tr, sum(generation_mw) as country_mwh, count(distinct hour_start_at_utc) as hours
    from {{ ref('agg_generation_by_source_hourly') }}
    where hour_start_at_utc >= timestamp_sub(current_timestamp(), interval 8 day)
    group by 1
),

plants as (
    select date_tr, sum(generation_mw) as plant_mwh, count(distinct hour_start_at_utc) as hours
    from {{ ref('fct_generation_hourly') }}
    where hour_start_at_utc >= timestamp_sub(current_timestamp(), interval 8 day)
    group by 1
)

select
    c.date_tr,
    c.country_mwh,
    p.plant_mwh,
    safe_divide(abs(c.country_mwh - p.plant_mwh), abs(c.country_mwh)) as relative_diff
from country as c
inner join plants as p
    on c.date_tr = p.date_tr
where c.hours = 24
  and p.hours = 24
  and c.date_tr >= date_sub(current_date('Europe/Istanbul'), interval 7 day)
  and abs(c.country_mwh - p.plant_mwh) > 0.005 * abs(c.country_mwh)

-- Son 30 günde her saat: il toplamı (konumsuz dahil) = santral toplamı (fct_generation_hourly), %0,5 tolerans.
-- Dönen satırlar: tutmayan saatler. Konumsuz üretim atılırsa ya da kopya oluşursa yakalar.
with prov as (
    select hour_start_at_utc, sum(generation_mw) as province_mw
    from {{ ref('agg_generation_by_province_hourly') }}
    where hour_start_at_utc >= timestamp_sub(current_timestamp(), interval 30 day)
    group by 1
),

plants as (
    select hour_start_at_utc, sum(generation_mw) as plant_mw
    from {{ ref('fct_generation_hourly') }}
    where hour_start_at_utc >= timestamp_sub(current_timestamp(), interval 30 day)
    group by 1
)

select
    coalesce(p.hour_start_at_utc, v.hour_start_at_utc) as hour_start_at_utc,
    p.plant_mw,
    v.province_mw
from plants as p
full outer join prov as v
    on p.hour_start_at_utc = v.hour_start_at_utc
where p.hour_start_at_utc is null
   or v.hour_start_at_utc is null
   or abs(p.plant_mw - v.province_mw) > 0.005 * abs(p.plant_mw)

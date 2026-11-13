-- Son 7 günde il x saat toplamı, GÜNCEL eşleştirmeyle (fct_generation_hourly + dim_plants.plate_code)
-- yeniden hesaplananla aynı olmalı (%0,5 tolerans). Artımlı il tablosu eşleştirme değişikliğinden sonra
-- bu pencereyi kapsayan lookback ile yeniden kurulmazsa eski saatlerin ili bayat kalır; bu test onu yakalar.
-- Pencere enerji_gunluk.MATCH_LOOKBACK_HOURS ile birlikte değişmeli.
-- Dönen satırlar: farkı olan saat x il (province_key 0 = konumsuz).
with agg as (
    select hour_start_at_utc, province_key, sum(generation_mw) as agg_mw
    from {{ ref('agg_generation_by_province_hourly') }}
    where hour_start_at_utc >= timestamp_sub(current_timestamp(), interval 7 day)
    group by 1, 2
),

current_matching as (
    select f.hour_start_at_utc, coalesce(d.plate_code, 0) as province_key, sum(f.generation_mw) as current_mw
    from {{ ref('fct_generation_hourly') }} as f
    left join {{ ref('dim_plants') }} as d
        on f.plant_id = d.plant_id
    where f.hour_start_at_utc >= timestamp_sub(current_timestamp(), interval 7 day)
    group by 1, 2
)

select
    coalesce(a.hour_start_at_utc, c.hour_start_at_utc) as hour_start_at_utc,
    coalesce(a.province_key, c.province_key) as province_key,
    a.agg_mw,
    c.current_mw
from agg as a
full outer join current_matching as c
    on a.hour_start_at_utc = c.hour_start_at_utc
   and a.province_key = c.province_key
where a.hour_start_at_utc is null
   or c.hour_start_at_utc is null
   or abs(a.agg_mw - c.current_mw) > 0.005 * greatest(abs(c.current_mw), 1)

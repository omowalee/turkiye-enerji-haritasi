-- Santral gününde (en son tam gün) konumu bilinmeyen santrallerin üretim payı.
-- Yalnızca uyarı (kullanıcı kararı 2026-11-08): pay > var unmatched_share_daily_warn ise 1 satır döner.
-- Ana kalite testi 30 günlük penceredir (assert_unmatched_generation_share); günlük değer
-- rüzgâr/hidro karışımıyla %6-11 arasında oynar, bu yüzden burada hata kademesi yok.
{{ config(severity='warn') }}

with plants_day as (
    select plants_day_date_tr as day from {{ ref('mart_live_snapshot') }}
),

share as (
    select
        d.day,
        sum(if(p.is_located, 0, f.generation_mw)) / sum(f.generation_mw) as unmatched_share
    from {{ ref('fct_generation_hourly') }} as f
    inner join plants_day as d on f.date_tr = d.day
    inner join {{ ref('dim_plants') }} as p on f.plant_id = p.plant_id
    group by d.day
)

select day, unmatched_share, {{ var('unmatched_share_daily_warn') }} as warn_share
from share
where unmatched_share > {{ var('unmatched_share_daily_warn') }}

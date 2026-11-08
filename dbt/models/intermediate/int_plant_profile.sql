{{ config(materialized='table') }}
-- Grain: bir satir = bir EPIAS santrali (plant_id), stg_epias__power_plants'taki her santral.
-- Pencere: santral verisinde 24 saati tam olan en son 30 gun (date_tr, Istanbul gunu).
-- Not: date_tr filtresi stg view'inde bolum budamasina iner (dedup penceresinde date_local var).
with recent as (
    select hour_start_at_utc, date_tr, plant_id, source_type, generation_mw
    from {{ ref('stg_epias__generation_by_plant') }}
    where date_tr >= date_sub(current_date('Europe/Istanbul'), interval 40 day)
),

complete_days as (
    select date_tr
    from recent
    group by date_tr
    having count(distinct hour_start_at_utc) = 24
    qualify row_number() over (order by date_tr desc) <= 30
),

windowed as (
    select r.*
    from recent as r
    inner join complete_days as d
        on r.date_tr = d.date_tr
),

by_source as (
    select plant_id, source_type, sum(generation_mw) as mwh
    from windowed
    group by 1, 2
),

dominant as (
    select plant_id, source_type
    from by_source
    qualify row_number() over (partition by plant_id order by mwh desc, source_type) = 1
),

by_hour as (
    select plant_id, hour_start_at_utc, sum(generation_mw) as mw
    from windowed
    group by 1, 2
),

totals as (
    select plant_id, sum(mw) as total_mwh_30d, max(mw) as max_hourly_mw_30d
    from by_hour
    group by 1
),

bounds as (
    select min(date_tr) as window_start_date_tr, max(date_tr) as window_end_date_tr
    from complete_days
)

select
    p.plant_id,
    p.plant_name,
    d.source_type,
    f.plant_family,
    coalesce(t.total_mwh_30d, 0) as total_mwh_30d,
    coalesce(t.max_hourly_mw_30d, 0) as max_hourly_mw_30d,
    b.window_start_date_tr,
    b.window_end_date_tr
from {{ ref('stg_epias__power_plants') }} as p
cross join bounds as b
left join totals as t
    on p.plant_id = t.plant_id
left join dominant as d
    on p.plant_id = d.plant_id
left join {{ ref('source_type_families') }} as f
    on d.source_type = f.source_type

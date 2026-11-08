-- Grain: saat x santral x source_type (lisanslı). Sıfır ve NULL üretim satırları atılır.
with raw_dedup as (
    select *
    from {{ source('epias_raw', 'realtime_generation_plant') }}
    qualify row_number() over (partition by ts, pp_id order by ingested_at desc) = 1
),

unpivoted as (
    select
        r.ts,
        r.date_local,
        r.pp_id,
        r.power_plant_name,
        u.epias_column,
        u.generation_mw
    from raw_dedup as r
    cross join {{ epias_unpivot_array(source('epias_raw', 'realtime_generation_plant')) }} as u
),

by_type as (
    select
        u.ts,
        u.date_local,
        u.pp_id,
        u.power_plant_name,
        {{ epias_source_type_expr('u.epias_column', 'm.source_type') }} as source_type,
        sum(u.generation_mw) as generation_mw
    from unpivoted as u
    left join {{ ref('epias_fuel_map') }} as m
        on u.epias_column = m.epias_column
    group by 1, 2, 3, 4, 5
)

select
    ts as hour_start_at_utc,
    date_local as date_tr,
    pp_id as plant_id,
    power_plant_name as plant_name_raw,
    source_type,
    generation_mw
from by_type
where generation_mw is not null
  and generation_mw != 0

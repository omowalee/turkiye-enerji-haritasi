-- Grain: saat x source_type (ülke toplamı, lisanslı, dış ticaret hariç).
-- importExport ve total dahil edilmez. Yeni EPİAŞ yakıt kolonları dinamik olarak bulunur.
with raw_dedup as (
    select *
    from {{ source('epias_raw', 'realtime_generation_source') }}
    qualify row_number() over (partition by ts order by ingested_at desc) = 1
),

unpivoted as (
    select
        r.ts,
        r.date_local,
        u.epias_column,
        u.generation_mw
    from raw_dedup as r
    cross join {{ epias_unpivot_array(source('epias_raw', 'realtime_generation_source')) }} as u
)

select
    u.ts as hour_start_at_utc,
    u.date_local as date_tr,
    {{ epias_source_type_expr('u.epias_column', 'm.source_type') }} as source_type,
    sum(u.generation_mw) as generation_mw
from unpivoted as u
left join {{ ref('epias_fuel_map') }} as m
    on u.epias_column = m.epias_column
group by 1, 2, 3

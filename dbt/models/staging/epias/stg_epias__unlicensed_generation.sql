-- Grain: saat x source_type (lisanssız üretim, ülke toplamı, aylık gecikmeli). toplam atılır.
with raw_dedup as (
    select *
    from {{ source('epias_raw', 'unlicensed_generation') }}
    qualify row_number() over (partition by date_local, ts order by ingested_at desc) = 1  -- date_local: bölüm budaması
),

unpivoted as (
    select ts, date_local, u.unlicensed_column, u.generation_mw
    from raw_dedup
    cross join unnest([
        struct('gunes' as unlicensed_column, gunes as generation_mw),
        struct('ruzgar', ruzgar),
        struct('biyokutle', biyokutle),
        struct('biyogaz', biyogaz),
        struct('kanalTipi', kanalTipi),
        struct('diger', diger)
    ]) as u
)

select
    u.ts as hour_start_at_utc,
    u.date_local as date_tr,
    m.source_type,
    sum(u.generation_mw) as generation_mw
from unpivoted as u
inner join {{ ref('unlicensed_fuel_map') }} as m
    on u.unlicensed_column = m.unlicensed_column
group by 1, 2, 3

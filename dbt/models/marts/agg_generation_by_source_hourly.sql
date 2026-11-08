{{ config(materialized='table', cluster_by=['source_type']) }}
-- Grain: bir satir = bir saat x bir source_type (ulke verisi rt-gen, lisansli, dis ticaret haric).
-- Kucuk tablo (~22 bin satir, birkac MB): her calismada bastan kurulur; is_finalized tum tabloya bagli.
with by_source as (
    select
        g.hour_start_at_utc,
        g.date_tr,
        g.source_type,
        s.is_renewable,
        g.generation_mw
    from {{ ref('stg_epias__generation_by_source') }} as g
    inner join {{ ref('source_types') }} as s
        on g.source_type = s.source_type
),

hourly as (
    select
        *,
        sum(generation_mw) over (partition by hour_start_at_utc) as total_generation_mw,
        sum(if(is_renewable, generation_mw, 0)) over (partition by hour_start_at_utc) as renewable_generation_mw,
        max(hour_start_at_utc) over () as latest_hour_start_at_utc
    from by_source
)

select
    h.hour_start_at_utc,
    datetime(h.hour_start_at_utc, 'Europe/Istanbul') as hour_start_tr,
    h.date_tr,
    h.source_type,
    h.is_renewable,
    h.generation_mw,
    100 * safe_divide(h.generation_mw, h.total_generation_mw) as share_pct,
    h.total_generation_mw,
    h.renewable_generation_mw,
    100 * safe_divide(h.renewable_generation_mw, h.total_generation_mw) as renewable_share_pct,
    p.price_try_per_mwh,
    -- en yeni saat on veridir (EPIAS once eksik yayimlar, sonra tamamlar)
    h.hour_start_at_utc < h.latest_hour_start_at_utc as is_finalized
from hourly as h
left join {{ ref('stg_epias__market_clearing_price') }} as p
    on h.hour_start_at_utc = p.hour_start_at_utc

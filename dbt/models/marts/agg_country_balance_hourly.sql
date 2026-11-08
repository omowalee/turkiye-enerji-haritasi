{{ config(materialized='table') }}
-- Grain: bir satir = bir saat (ulke dengesi). Saatler ulke uretim verisinden (rt-gen) gelir.
-- Tuketim rt-gen'den ~1 saat sonra yayimlanir: henuz yoksa consumption_mw ve balance_mw NULL.
-- Isaretler: net_import_mw + = net ithalat; balance_mw = lisansli uretim - tuketim (gunduz negatifi cogunlukla
-- lisanssiz / sayac arkasi gunesten gelir, dis ticaretten degil).
with hours as (
    select
        hour_start_at_utc,
        any_value(hour_start_tr) as hour_start_tr,
        any_value(date_tr) as date_tr,
        any_value(total_generation_mw) as licensed_generation_mw,
        logical_and(is_finalized) as is_finalized
    from {{ ref('agg_generation_by_source_hourly') }}
    group by 1
)

select
    h.hour_start_at_utc,
    h.hour_start_tr,
    h.date_tr,
    h.licensed_generation_mw,
    c.consumption_mw,
    n.net_import_mw,
    h.licensed_generation_mw - c.consumption_mw as balance_mw,
    h.is_finalized
from hours as h
left join {{ ref('stg_epias__consumption') }} as c
    on h.hour_start_at_utc = c.hour_start_at_utc
left join {{ ref('stg_epias__net_import') }} as n
    on h.hour_start_at_utc = n.hour_start_at_utc

{{ config(
    materialized='incremental',
    incremental_strategy='insert_overwrite',
    partition_by={'field': 'hour_start_at_utc', 'data_type': 'timestamp', 'granularity': 'day'},
    cluster_by=['province_key', 'source_type']
) }}
-- Grain: bir satir = bir saat x bir il x bir source_type (santral verisi, lisansli).
-- Konumu/ili bilinmeyen santraller plate_code NULL, is_unlocated = true satirinda toplanir; boylece saat
-- toplami santral toplamina esittir. province_key = plate_code, konumsuzda 0 (NULL olmayan anahtar; kume ve testler).
-- Artimli (insert_overwrite): son var('lookback_hours') saati iceren UTC gunleri bastan yazilir. Eslestirme degisince (seed'ler, int_plants_matched)
-- pencere disindaki saatlerin ili bayatlar: enerji_gunluk eslestirmeden sonra 192 saatle yeniden kurar (son 7 gun tutarli;
-- assert_province_agg_matches_current_matching kontrol eder). Daha eskisi icin --full-refresh.
with enriched as (
    select hour_start_at_utc, date_tr, plate_code, source_type, generation_mw
    from {{ ref('int_generation_enriched') }}
    {% if is_incremental() %}
    where date_tr >= date({{ incremental_lookback_start() }}, 'Europe/Istanbul')
      and hour_start_at_utc >= {{ incremental_lookback_start() }}
    {% endif %}
)

select
    e.hour_start_at_utc,
    datetime(e.hour_start_at_utc, 'Europe/Istanbul') as hour_start_tr,
    e.date_tr,
    coalesce(e.plate_code, 0) as province_key,
    e.plate_code,
    p.province_name,
    e.plate_code is null as is_unlocated,
    e.source_type,
    sum(e.generation_mw) as generation_mw
from enriched as e
left join {{ ref('stg_provinces') }} as p
    on e.plate_code = p.plate_code
group by 1, 2, 3, 4, 5, 6, 7, 8

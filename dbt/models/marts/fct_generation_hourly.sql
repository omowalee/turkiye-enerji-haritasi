{{ config(
    materialized='incremental',
    incremental_strategy='insert_overwrite',
    partition_by={'field': 'hour_start_at_utc', 'data_type': 'timestamp', 'granularity': 'day'},
    cluster_by=['plant_id', 'source_type']
) }}
-- Grain: bir satir = bir saat x bir santral (plant_id). Lisansli uretim, tum yakitlarin toplami.
-- Artimli (insert_overwrite): son var('lookback_hours') saati iceren UTC gunleri bastan yazilir; EPIAS revizyonu
-- ve sifira cekilen (stagingde atilan) santral-saatler boylece kaybolur.
with enriched as (
    select hour_start_at_utc, date_tr, plant_id, source_type, generation_mw
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
    e.plant_id,
    -- o saatte en cok ureten yakit; esitlikte source_types sirasi
    array_agg(e.source_type order by e.generation_mw desc, s.sort_order limit 1)[offset(0)] as source_type,
    sum(e.generation_mw) as generation_mw
from enriched as e
inner join {{ ref('source_types') }} as s
    on e.source_type = s.source_type
group by 1, 2, 3, 4

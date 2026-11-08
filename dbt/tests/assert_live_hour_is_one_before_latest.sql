-- Kesinleşmiş saat kuralı (sözleşme, karar 2026-11-08): mart_live_snapshot.live_hour_start_at_utc,
-- ülke kaynak verisindeki (stg_epias__generation_by_source) en yeni saatten tam 1 saat önce olmalı.
-- Dönen satır: kural bozulmuş (gerçek ve beklenen saat).
with latest as (
    select max(hour_start_at_utc) as latest_hour_start_at_utc
    from {{ ref('stg_epias__generation_by_source') }}
)

select
    s.live_hour_start_at_utc,
    l.latest_hour_start_at_utc,
    timestamp_sub(l.latest_hour_start_at_utc, interval 1 hour) as expected_live_hour_start_at_utc
from {{ ref('mart_live_snapshot') }} as s
cross join latest as l
where s.live_hour_start_at_utc is null
   or s.live_hour_start_at_utc != timestamp_sub(l.latest_hour_start_at_utc, interval 1 hour)

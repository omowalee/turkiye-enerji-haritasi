-- Grain: saat (gercek zamanli tuketim, rt-cons). ts saatin baslangicidir; consumption = saatteki MWh = ortalama MW.
-- rt-gen'den ~1 saat sonra yayimlanir.
select
    ts as hour_start_at_utc,
    date_local as date_tr,
    consumption as consumption_mw
from {{ source('epias_raw', 'realtime_consumption') }}
qualify row_number() over (partition by date_local, ts order by ingested_at desc) = 1  -- date_local: bölüm budaması

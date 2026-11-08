-- Grain: saat (PTF, gün öncesi piyasa). ts saatin başlangıcıdır.
select
    ts as hour_start_at_utc,
    date_local as date_tr,
    price as price_try_per_mwh,
    priceUsd as price_usd_per_mwh,
    priceEur as price_eur_per_mwh
from {{ source('epias_raw', 'market_clearing_price') }}
qualify row_number() over (partition by date_local, ts order by ingested_at desc) = 1  -- date_local: bölüm budaması

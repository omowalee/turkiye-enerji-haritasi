-- Grain: saat (ulke dis ticareti, rt-gen importExport). Uretim toplamlarina girmez.
-- Isaret: EPIAS importExport negatif = net ihracat; net_import_mw ayni isaretle tasinir (+ = net ithalat).
select
    ts as hour_start_at_utc,
    date_local as date_tr,
    importExport as net_import_mw
from {{ source('epias_raw', 'realtime_generation_source') }}
qualify row_number() over (partition by date_local, ts order by ingested_at desc) = 1  -- date_local: bölüm budaması

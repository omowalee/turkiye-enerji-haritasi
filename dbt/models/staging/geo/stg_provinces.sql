-- Grain: bir satir = bir il (plate_code).
select
    plate_code,
    province_name,
    iso_code,
    geom
from {{ source('geo_raw', 'provinces') }}
qualify row_number() over (partition by plate_code order by ingested_at desc) = 1

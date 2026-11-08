{{ config(materialized='table') }}
-- Grain: bir satir = bir EPIAS santrali (plant_id), santral listesinin en son snapshot'indaki her santral.
-- Kurulu guc kurali (kullanici karari 2026-11-08): konum kaydini tek bir santral kullaniyorsa ve kayit vekil
-- degilse kaydin gucu; aksi halde NULL ("bilinmiyor"). Paylasilan sahalar (ZETES, Karapinar) ve vekil kayitlar
-- (TUPRAS) NULL olur.
with matched as (
    select
        m.*,
        if(m.location_id is null, null,
           count(*) over (partition by m.location_source, m.location_id)) as location_plant_count
    from {{ ref('int_plants_matched') }} as m
)

select
    m.plant_id,
    m.plant_name,
    m.source_type,
    m.plant_family,
    p.total_mwh_30d as generation_mwh_30d,
    m.is_located,
    m.latitude,
    m.longitude,
    m.plate_code,
    pr.province_name,
    m.match_method,
    m.match_confidence,
    m.location_source,
    m.location_id,
    m.location_plant_count,
    m.is_location_proxy,
    if(m.location_plant_count = 1 and not m.is_location_proxy, m.installed_capacity_mw, null) as installed_capacity_mw
from matched as m
inner join {{ ref('int_plant_profile') }} as p
    on m.plant_id = p.plant_id
left join {{ ref('stg_provinces') }} as pr
    on m.plate_code = pr.plate_code

{{ config(severity='warn') }}
-- Konumlu santrallerde son 30 günün en yüksek saatlik üretimi, konum kaydının kurulu gücünün 1,3 katını aşıyor.
-- Olası nedenler: yanlış eşleşme, GEM/OSM kapasitesi eski (genişleme) ya da konum santralin yalnız bir parçası.
select
    m.plant_id,
    m.plant_name,
    m.match_method,
    m.location_source,
    m.location_id,
    m.installed_capacity_mw,
    p.max_hourly_mw_30d
from {{ ref('int_plants_matched') }} as m
inner join {{ ref('int_plant_profile') }} as p
    on m.plant_id = p.plant_id
where m.is_located
  and m.installed_capacity_mw > 0
  and p.max_hourly_mw_30d > 1.3 * m.installed_capacity_mw

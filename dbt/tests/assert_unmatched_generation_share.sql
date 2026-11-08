-- Son 30 tam günün lisanslı üretiminde konumu bilinmeyen santrallerin payı < var max_unmatched_generation_share.
-- Başarısızsa tek satır döner (pay ve eşik).
select
    sum(if(m.is_located, 0, p.total_mwh_30d)) / sum(p.total_mwh_30d) as unmatched_share,
    {{ var('max_unmatched_generation_share') }} as max_share
from {{ ref('int_plants_matched') }} as m
inner join {{ ref('int_plant_profile') }} as p
    on m.plant_id = p.plant_id
having sum(if(m.is_located, 0, p.total_mwh_30d)) / sum(p.total_mwh_30d) >= {{ var('max_unmatched_generation_share') }}

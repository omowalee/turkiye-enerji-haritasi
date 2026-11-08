-- plant_match_overrides: 'match' satırlarının konumu stg_plant_locations'ta olmalı;
-- 'no_match' satırlarında konum alanları boş olmalı. Dönen satırlar hatalı düzeltmelerdir.
select o.plant_id, o.action, o.location_source, o.location_id, 'konum kaydı yok' as problem
from {{ ref('plant_match_overrides') }} as o
left join {{ ref('stg_plant_locations') }} as l
    on o.location_source = l.location_source
   and o.location_id = l.location_id
where o.action = 'match'
  and l.location_id is null

union all

select o.plant_id, o.action, o.location_source, o.location_id, 'no_match satırında konum dolu' as problem
from {{ ref('plant_match_overrides') }} as o
where o.action = 'no_match'
  and (o.location_source is not null or o.location_id is not null)

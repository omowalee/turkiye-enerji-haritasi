{{ config(materialized='table') }}
-- Grain: bir satir = bir EPIAS santrali (plant_id); hicbir santral atilmaz.
-- Oncelik: elle duzeltme (plant_match_overrides) > bulanik aday (plant_match_candidates, score >= match_min_score) > yok.
with profile as (
    select plant_id, plant_name, source_type, plant_family
    from {{ ref('int_plant_profile') }}
),

chosen as (
    select
        p.plant_id,
        p.plant_name,
        p.source_type,
        p.plant_family,
        case
            when o.action = 'match' then 'override'
            when o.action = 'no_match' then 'none'
            when c.plant_id is not null then 'fuzzy'
            else 'none'
        end as match_method,
        case
            when o.action = 'match' then o.location_source
            when o.action is null then c.location_source
        end as location_source,
        case
            when o.action = 'match' then o.location_id
            when o.action is null then c.location_id
        end as location_id,
        case
            when o.action = 'match' then 1.0
            when o.action is null and c.plant_id is not null then c.score / 100
        end as match_confidence
    from profile as p
    left join {{ ref('plant_match_overrides') }} as o
        on p.plant_id = o.plant_id
    left join {{ ref('plant_match_candidates') }} as c
        on p.plant_id = c.plant_id
       and c.score >= {{ var('match_min_score') }}
),

located as (
    select
        ch.*,
        l.latitude,
        l.longitude,
        l.capacity_mw as installed_capacity_mw,
        st_geogpoint(l.longitude, l.latitude) as point
    from chosen as ch
    left join {{ ref('stg_plant_locations') }} as l
        on ch.location_source = l.location_source
       and ch.location_id = l.location_id
),

-- il: nokta-poligon; poligon disindaysa (kiyi) 10 km icindeki en yakin il
province as (
    select
        lc.plant_id,
        pr.plate_code
    from located as lc
    inner join {{ ref('stg_provinces') }} as pr
        on st_dwithin(pr.geom, lc.point, 10000)
    where lc.point is not null
    qualify row_number() over (
        partition by lc.plant_id
        order by st_contains(pr.geom, lc.point) desc, st_distance(pr.geom, lc.point), pr.plate_code
    ) = 1
)

select
    lc.plant_id,
    lc.plant_name,
    lc.source_type,
    lc.plant_family,
    lc.location_source,
    lc.location_id,
    lc.latitude,
    lc.longitude,
    lc.installed_capacity_mw,
    pv.plate_code,
    lc.match_method,
    lc.match_confidence,
    lc.latitude is not null as is_located
from located as lc
left join province as pv
    on lc.plant_id = pv.plant_id

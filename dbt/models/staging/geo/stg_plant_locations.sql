-- Grain: location_source ('gem' | 'osm') x location_id.
-- GEM: yalnizca 'operating' birimler, gem_location_id duzeyinde toplanir (kapasite toplami, koordinat ortalamasi).
-- OSM: power=plant ogeleri, osm_type/osm_id duzeyinde. Iki kaynagin yakit ailesi ayni kume ile kodlanir.
with gem_units as (
    select *
    from {{ source('geo_raw', 'gem_plants') }}
    where status = 'operating'
),

gem as (
    select
        'gem' as location_source,
        gem_location_id as location_id,
        -- ad ve yakit ailesi: konumdaki en buyuk birimden
        array_agg(plant_project_name order by capacity_mw desc limit 1)[offset(0)] as location_name,
        array_agg(plant_project_name_local ignore nulls order by capacity_mw desc limit 1)[safe_offset(0)] as location_name_local,
        array_agg(plant_project_name_other ignore nulls order by capacity_mw desc limit 1)[safe_offset(0)] as location_name_other,
        sum(capacity_mw) as capacity_mw,
        avg(latitude) as latitude,
        avg(longitude) as longitude,
        array_agg(
            case type
                when 'oil/gas' then 'gas'
                when 'hydropower' then 'hydro'
                when 'coal' then 'coal'
                when 'utility-scale solar' then 'solar'
                when 'wind' then 'wind'
                when 'geothermal' then 'geothermal'
                when 'bioenergy' then 'bio'
            end
            order by capacity_mw desc limit 1
        )[offset(0)] as plant_family
    from gem_units
    group by gem_location_id
),

osm as (
    select
        'osm' as location_source,
        concat(osm_type, '/', cast(osm_id as string)) as location_id,
        coalesce(name, json_value(tags_json, '$.name')) as location_name,
        json_value(tags_json, '$."name:tr"') as location_name_local,
        json_value(tags_json, '$.alt_name') as location_name_other,
        case upper(regexp_extract(plant_output_electricity, r'(?i)^\s*[0-9]+(?:[.,][0-9]+)?\s*(kW|MW|GW)e?\s*$'))
            when 'KW' then safe_cast(replace(regexp_extract(plant_output_electricity, r'^\s*([0-9]+(?:[.,][0-9]+)?)'), ',', '.') as float64) / 1000
            when 'MW' then safe_cast(replace(regexp_extract(plant_output_electricity, r'^\s*([0-9]+(?:[.,][0-9]+)?)'), ',', '.') as float64)
            when 'GW' then safe_cast(replace(regexp_extract(plant_output_electricity, r'^\s*([0-9]+(?:[.,][0-9]+)?)'), ',', '.') as float64) * 1000
        end as capacity_mw,
        lat as latitude,
        lon as longitude,
        case split(plant_source, ';')[offset(0)]
            when 'gas' then 'gas'
            when 'oil' then 'gas'
            when 'hydro' then 'hydro'
            when 'coal' then 'coal'
            when 'asphaltite' then 'coal'
            when 'solar' then 'solar'
            when 'wind' then 'wind'
            when 'geothermal' then 'geothermal'
            when 'biogas' then 'bio'
            when 'biomass' then 'bio'
            when 'waste' then 'bio'
        end as plant_family
    from {{ source('geo_raw', 'osm_plants') }}
)

select location_source, location_id, location_name, location_name_local, location_name_other,
       plant_family, capacity_mw, latitude, longitude
from gem
union all
select location_source, location_id, location_name, location_name_local, location_name_other,
       plant_family, capacity_mw, latitude, longitude
from osm

-- Grain: bir satır = bir EPİAŞ santrali (pp_id), en son snapshot_date.
with latest as (
    select *
    from {{ source('epias_raw', 'power_plants') }}
    qualify rank() over (order by snapshot_date desc) = 1
       and row_number() over (partition by pp_id order by ingested_at desc) = 1
)

select
    pp_id as plant_id,
    -- EIC eki (-40W...) ve varsa sondaki "-<pp_id>" atılır
    trim(regexp_replace(
        regexp_replace(name, r'-40W[0-9A-Z]+(-[0-9]+)?$', ''),
        concat('-', cast(pp_id as string), '$'), ''
    )) as plant_name,
    name as plant_name_raw,
    coalesce(eic, regexp_extract(name, r'-(40W[0-9A-Z]+)')) as eic,
    short_name,
    snapshot_date
from latest

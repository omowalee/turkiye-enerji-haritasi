-- Grain: bir satır = bir EPİAŞ santrali (pp_id), herhangi bir snapshot'ta görülmüş her santral; santralin
-- en son görüldüğü kayıt. EPİAŞ listeden çıkardığı santralin geçmiş üretimi sahipsiz kalmasın diye
-- (2026-11-10: ACIBADEM ESKİŞEHİR, pp_id 3213) yalnızca son snapshot'a bakılmaz. is_listed: son listede var mı.
with latest as (
    select
        *,
        snapshot_date = max(snapshot_date) over () as is_listed
    from {{ source('epias_raw', 'power_plants') }}
    qualify row_number() over (partition by pp_id order by snapshot_date desc, ingested_at desc) = 1
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
    snapshot_date,
    is_listed
from latest

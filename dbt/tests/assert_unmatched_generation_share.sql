-- Son 30 tam günün lisanslı üretiminde konumu bilinmeyen santrallerin payı.
-- İki kademe (kullanıcı kararı 2026-11-08): pay > var unmatched_share_warn -> WARN,
-- pay > var unmatched_share_error -> ERROR. Eşik aşılmazsa satır dönmez.
-- fail_calc: uyarı kademesinde 1, hata kademesinde 2 (dönen tek satır + exceeds_error).
{{ config(
    fail_calc="count(*) + countif(exceeds_error)",
    warn_if=">= 1",
    error_if=">= 2"
) }}

with share as (
    select sum(if(m.is_located, 0, p.total_mwh_30d)) / sum(p.total_mwh_30d) as unmatched_share
    from {{ ref('int_plants_matched') }} as m
    inner join {{ ref('int_plant_profile') }} as p
        on m.plant_id = p.plant_id
)

select
    unmatched_share,
    {{ var('unmatched_share_warn') }} as warn_share,
    {{ var('unmatched_share_error') }} as error_share,
    unmatched_share > {{ var('unmatched_share_error') }} as exceeds_error
from share
where unmatched_share > {{ var('unmatched_share_warn') }}

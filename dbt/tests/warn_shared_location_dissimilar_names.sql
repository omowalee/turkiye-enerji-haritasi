{{ config(severity='warn') }}
-- Aynı konumu birden çok santral kullanıyor ve adları ünite ekleri dışında benzemiyor
-- (çekirdek adlar arasındaki düzenleme mesafesi uzun adın %20'sinden fazla). Olası yanlış eşleşme.
with located as (
    select
        plant_id,
        plant_name,
        match_method,
        location_source,
        location_id,
        {{ plant_name_core('plant_name') }} as name_core
    from {{ ref('int_plants_matched') }}
    where is_located
)

select
    a.location_source,
    a.location_id,
    a.plant_id as plant_id_a,
    a.plant_name as plant_name_a,
    a.match_method as match_method_a,
    b.plant_id as plant_id_b,
    b.plant_name as plant_name_b,
    b.match_method as match_method_b
from located as a
inner join located as b
    on a.location_source = b.location_source
   and a.location_id = b.location_id
   and a.plant_id < b.plant_id
where edit_distance(a.name_core, b.name_core) > 0.2 * greatest(length(a.name_core), length(b.name_core))

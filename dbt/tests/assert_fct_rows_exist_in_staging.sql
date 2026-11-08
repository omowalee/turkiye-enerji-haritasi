-- Bayat satır denetimi: son 7 günde fct_generation_hourly'deki her (saat, santral), staging'de sıfırdan farklı
-- üretimle bulunmalı (staging sıfır/NULL satırları atar). EPİAŞ bir santral-saati sonradan sıfıra çekerse ve
-- o günün bölümü yeniden yazılmazsa eski satır fct'te kalır; bu test onu yakalar.
-- Dönen satırlar: staging'de karşılığı olmayan fct satırları.
with staged as (
    select distinct hour_start_at_utc, plant_id
    from {{ ref('stg_epias__generation_by_plant') }}
    where date_tr >= date_sub(current_date('Europe/Istanbul'), interval 8 day)
)

select
    f.hour_start_at_utc,
    f.plant_id,
    f.generation_mw
from {{ ref('fct_generation_hourly') }} as f
left join staged as s
    on f.hour_start_at_utc = s.hour_start_at_utc
   and f.plant_id = s.plant_id
where f.hour_start_at_utc >= timestamp_sub(current_timestamp(), interval 7 day)
  and s.plant_id is null

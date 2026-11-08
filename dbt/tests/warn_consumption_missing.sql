{{ config(severity='warn') }}
-- Tüketim yayımlanması rt-gen'den ~1 saat geç; 6 saatten eski bir saatte hâlâ yoksa uyarır.
-- Dönen satırlar: tüketimi eksik saatler.
select hour_start_at_utc, hour_start_tr, licensed_generation_mw
from {{ ref('agg_country_balance_hourly') }}
where consumption_mw is null
  and hour_start_at_utc < timestamp_sub(current_timestamp(), interval 6 hour)

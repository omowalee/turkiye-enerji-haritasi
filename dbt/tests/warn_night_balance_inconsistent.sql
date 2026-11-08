{{ config(severity='warn') }}
-- Gece tutarlılığı: son 30 günün tam günlerinde (24 saat, tüketim dolu) yerel 00:00-05:00 saat başlangıçlarında
-- |lisanslı üretim + net ithalat - tüketim| / tüketim < %3 olmalı. Gece lisanssız güneş yok, fark küçük beklenir
-- (2026-11-07: 60-400 MW). Dönen satırlar: farkı %3'ü aşan gece saatleri.
with complete_days as (
    select date_tr
    from {{ ref('agg_country_balance_hourly') }}
    where date_tr >= date_sub(current_date('Europe/Istanbul'), interval 30 day)
    group by 1
    having count(*) = 24 and count(consumption_mw) = 24
)

select
    b.hour_start_tr,
    b.licensed_generation_mw,
    b.net_import_mw,
    b.consumption_mw,
    abs(b.licensed_generation_mw + b.net_import_mw - b.consumption_mw) / b.consumption_mw as relative_gap
from {{ ref('agg_country_balance_hourly') }} as b
inner join complete_days as d
    on b.date_tr = d.date_tr
where extract(hour from b.hour_start_tr) between 0 and 5
  and abs(b.licensed_generation_mw + b.net_import_mw - b.consumption_mw) >= 0.03 * b.consumption_mw

-- Her saatte kaynak paylarının toplamı %100 olmalı (± 0,01 puan). Dönen satırlar: tutmayan saatler.
select
    hour_start_at_utc,
    sum(share_pct) as share_pct_sum,
    any_value(total_generation_mw) as hour_total_mw
from {{ ref('agg_generation_by_source_hourly') }}
group by 1
having any_value(total_generation_mw) != 0
   and abs(sum(share_pct) - 100) > 0.01

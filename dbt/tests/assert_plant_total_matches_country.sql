-- Son 7 günün tam günlerinde (iki tabloda da 24 saat var) santral toplamı = kaynak toplamı, %0,5 tolerans.
-- Gün x source_type düzeyinde karşılaştırır. Dönen satırlar: farkı olan gün/kaynak.
with country as (
    select
        date_tr,
        source_type,
        sum(generation_mw) as country_mwh
    from {{ ref('stg_epias__generation_by_source') }}
    where date_tr >= date_sub(current_date('Europe/Istanbul'), interval 7 day)
    group by 1, 2
),

plants as (
    select
        date_tr,
        source_type,
        sum(generation_mw) as plant_mwh
    from {{ ref('stg_epias__generation_by_plant') }}
    where date_tr >= date_sub(current_date('Europe/Istanbul'), interval 7 day)
    group by 1, 2
),

complete_days as (
    select date_tr
    from {{ ref('stg_epias__generation_by_source') }}
    where date_tr >= date_sub(current_date('Europe/Istanbul'), interval 7 day)
    group by 1
    having count(distinct hour_start_at_utc) = 24
    intersect distinct
    select date_tr
    from {{ ref('stg_epias__generation_by_plant') }}
    where date_tr >= date_sub(current_date('Europe/Istanbul'), interval 7 day)
    group by 1
    having count(distinct hour_start_at_utc) = 24
)

select
    c.date_tr,
    c.source_type,
    c.country_mwh,
    coalesce(p.plant_mwh, 0) as plant_mwh,
    safe_divide(abs(c.country_mwh - coalesce(p.plant_mwh, 0)), nullif(abs(c.country_mwh), 0)) as relative_diff
from country as c
inner join complete_days as d
    on c.date_tr = d.date_tr
left join plants as p
    on c.date_tr = p.date_tr
   and c.source_type = p.source_type
where abs(c.country_mwh - coalesce(p.plant_mwh, 0)) > 0.005 * abs(c.country_mwh)

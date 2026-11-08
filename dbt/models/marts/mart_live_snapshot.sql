{{ config(materialized='table') }}
-- Grain: tek satir. Panelin "su an" ozeti (snapshot_latest.json).
-- Kesinlesmis saat kurali (sozlesme, karar 2026-11-08): live saati = ulke verisindeki en yeni saat - 1 saat.
-- En yeni saat on veridir ve provisional_* kolonlarinda durur.
-- Sondaki cross join'ler tek satirlik CTE'leri yan yana koyar (satir cogalmaz).
with live_hour as (
    select
        max(hour_start_at_utc) as provisional_hour_start_at_utc,
        timestamp_sub(max(hour_start_at_utc), interval 1 hour) as live_hour_start_at_utc
    from {{ ref('agg_generation_by_source_hourly') }}
),

live as (
    select
        any_value(a.total_generation_mw) as live_total_mw,
        any_value(a.renewable_share_pct) as live_renewable_share_pct,
        any_value(a.price_try_per_mwh) as live_price_try_per_mwh,
        array_agg(
            struct(a.source_type, a.generation_mw, a.share_pct)
            order by s.sort_order
        ) as live_by_source
    from {{ ref('agg_generation_by_source_hourly') }} as a
    inner join live_hour as h
        on a.hour_start_at_utc = h.live_hour_start_at_utc
    inner join {{ ref('source_types') }} as s
        on a.source_type = s.source_type
),

provisional as (
    select any_value(a.total_generation_mw) as provisional_total_mw
    from {{ ref('agg_generation_by_source_hourly') }} as a
    inner join live_hour as h
        on a.hour_start_at_utc = h.provisional_hour_start_at_utc
),

-- santral verisi: 24 saati tam olan en son yerel gun (bolum budamasi icin son 14 gun)
plant_recent as (
    select hour_start_at_utc, hour_start_tr, date_tr, plant_id, generation_mw
    from {{ ref('fct_generation_hourly') }}
    where hour_start_at_utc >= timestamp_sub(current_timestamp(), interval 14 day)
),

plants_day as (
    select max(date_tr) as plants_day_date_tr
    from (
        select date_tr
        from plant_recent
        group by date_tr
        having count(distinct hour_start_at_utc) = 24
    )
),

plants_day_stats as (
    select
        max(r.hour_start_at_utc) as plants_day_last_hour_start_at_utc,
        max(r.hour_start_tr) as plants_day_last_hour_start_tr
    from plant_recent as r
    inner join plants_day as d
        on r.date_tr = d.plants_day_date_tr
),

plants_day_last_hour as (
    select sum(r.generation_mw) as plants_day_total_mw_last_hour
    from plant_recent as r
    inner join plants_day_stats as s
        on r.hour_start_at_utc = s.plants_day_last_hour_start_at_utc
),

plants_day_count as (
    -- o gun toplam uretimi > 0 olan santraller (generation_24h.json ile ayni kume)
    select count(*) as plants_day_plant_count
    from (
        select r.plant_id
        from plant_recent as r
        inner join plants_day as d
            on r.date_tr = d.plants_day_date_tr
        group by r.plant_id
        having sum(r.generation_mw) > 0
    )
),

-- ulke dengesi (tuketim ~1 saat gec yayimlanir; yoksa NULL)
live_balance as (
    select
        any_value(b.consumption_mw) as live_consumption_mw,
        any_value(b.net_import_mw) as live_net_import_mw,
        any_value(b.balance_mw) as live_balance_mw
    from {{ ref('agg_country_balance_hourly') }} as b
    inner join live_hour as h
        on b.hour_start_at_utc = h.live_hour_start_at_utc
),

plants_day_balance as (
    select
        any_value(b.consumption_mw) as plants_day_consumption_mw_last_hour,
        any_value(b.net_import_mw) as plants_day_net_import_mw_last_hour,
        any_value(b.balance_mw) as plants_day_balance_mw_last_hour
    from {{ ref('agg_country_balance_hourly') }} as b
    inner join plants_day_stats as s
        on b.hour_start_at_utc = s.plants_day_last_hour_start_at_utc
),

-- lisanssiz gunes: son yayimlanan ay; tepe = yerel saat basina aylik ortalamalarin en buyugu
unlicensed_last_month as (
    select
        u.hour_start_at_utc,
        u.generation_mw,
        date_trunc(u.date_tr, month) as month_start
    from {{ ref('stg_epias__unlicensed_generation') }} as u
    where u.source_type = 'solar'
    qualify date_trunc(u.date_tr, month) = max(date_trunc(u.date_tr, month)) over ()
),

unlicensed_hod as (
    select
        extract(hour from datetime(hour_start_at_utc, 'Europe/Istanbul')) as hour_of_day,
        avg(generation_mw) as avg_mw
    from unlicensed_last_month
    group by 1
),

unlicensed as (
    select
        any_value(month_start) as unlicensed_solar_month,
        avg(generation_mw) as unlicensed_solar_avg_mw,
        (select max(avg_mw) from unlicensed_hod) as unlicensed_solar_peak_mw
    from unlicensed_last_month
)

select
    h.live_hour_start_at_utc,
    datetime(h.live_hour_start_at_utc, 'Europe/Istanbul') as live_hour_start_tr,
    l.live_total_mw,
    l.live_renewable_share_pct,
    l.live_price_try_per_mwh,
    l.live_by_source,
    lb.live_consumption_mw,
    lb.live_net_import_mw,
    lb.live_balance_mw,
    h.provisional_hour_start_at_utc,
    datetime(h.provisional_hour_start_at_utc, 'Europe/Istanbul') as provisional_hour_start_tr,
    p.provisional_total_mw,
    d.plants_day_date_tr,
    ds.plants_day_last_hour_start_at_utc,
    ds.plants_day_last_hour_start_tr,
    dl.plants_day_total_mw_last_hour,
    dc.plants_day_plant_count,
    db.plants_day_consumption_mw_last_hour,
    db.plants_day_net_import_mw_last_hour,
    db.plants_day_balance_mw_last_hour,
    u.unlicensed_solar_month,
    u.unlicensed_solar_avg_mw,
    u.unlicensed_solar_peak_mw
from live_hour as h
cross join live as l
cross join provisional as p
cross join plants_day as d
cross join plants_day_stats as ds
cross join plants_day_last_hour as dl
cross join plants_day_count as dc
cross join unlicensed as u
cross join live_balance as lb
cross join plants_day_balance as db

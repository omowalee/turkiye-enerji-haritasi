-- Grain: bir satir = bir saat x bir santral (plant_id) x bir source_type (lisansli, sifir olmayan uretim).
-- Uretime santral konumu ve il eklenir. Santral listesinde olmayan plant_id de kalir (is_located = false).
-- View: date_tr filtresi stg view'inden ham tablonun bolumlerine iner; tuketiciler date_tr ile filtrelemeli.
select
    g.hour_start_at_utc,
    g.date_tr,
    g.plant_id,
    g.source_type,
    g.generation_mw,
    m.plate_code,
    m.latitude,
    m.longitude,
    coalesce(m.is_located, false) as is_located
from {{ ref('stg_epias__generation_by_plant') }} as g
left join {{ ref('int_plants_matched') }} as m
    on g.plant_id = m.plant_id

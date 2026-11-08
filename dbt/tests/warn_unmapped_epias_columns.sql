{{ config(severity='warn') }}
-- Ham EPİAŞ tablolarında epias_fuel_map seed'inde olmayan sayısal kolonları listeler.
-- Bu kolonlar staging'de nuclear (adı nucl/nukleer içeriyorsa) ya da other olarak sınıflanır; fark edelim diye uyarır.
with raw_columns as (
    {% for rel in [source('epias_raw', 'realtime_generation_source'), source('epias_raw', 'realtime_generation_plant')] %}
    {% for c in epias_fuel_columns(rel) %}
    select '{{ rel.identifier }}' as raw_table, '{{ c }}' as epias_column
    {{ "union all" if not loop.last }}
    {% endfor %}
    {{ "union all" if not loop.last }}
    {% endfor %}
)

select r.raw_table, r.epias_column
from raw_columns as r
left join {{ ref('epias_fuel_map') }} as m
    on r.epias_column = m.epias_column
where m.epias_column is null

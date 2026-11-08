{# EPİAŞ yakıt kolonlarını dinamik bulur: anahtar/meta kolonları ve importExport/total dışındaki sayısal kolonlar. #}
{% macro epias_fuel_columns(relation) -%}
    {%- set excluded = ['ts', 'pp_id', 'power_plant_name', 'date_local', 'ingested_at', 'total', 'importexport', 'snapshot_date'] -%}
    {%- set numeric_types = ['FLOAT64', 'FLOAT', 'INT64', 'INTEGER', 'NUMERIC', 'BIGNUMERIC'] -%}
    {%- set cols = [] -%}
    {%- for col in adapter.get_columns_in_relation(relation) -%}
        {%- if col.name | lower not in excluded and col.dtype | upper in numeric_types -%}
            {%- do cols.append(col.name) -%}
        {%- endif -%}
    {%- endfor -%}
    {{ return(cols) }}
{%- endmacro %}

{# Satır başına (epias_column, generation_mw) üreten UNNEST ifadesi. Yeni EPİAŞ kolonları otomatik girer. #}
{% macro epias_unpivot_array(relation) -%}
    {%- set cols = epias_fuel_columns(relation) -%}
    unnest([
        {%- for c in cols %}
        struct('{{ c }}' as epias_column, `{{ c }}` as generation_mw){{ "," if not loop.last }}
        {%- endfor %}
    ])
{%- endmacro %}

{# Eşlenmemiş kolon: adı nucl/nukleer içeriyorsa nuclear, değilse other. map_alias = epias_fuel_map join alias. #}
{% macro epias_source_type_expr(column_expr, mapped_expr) -%}
    coalesce(
        {{ mapped_expr }},
        case
            when regexp_contains(lower({{ column_expr }}), r'nucl|nukleer|nükleer') then 'nuclear'
            else 'other'
        end
    )
{%- endmacro %}

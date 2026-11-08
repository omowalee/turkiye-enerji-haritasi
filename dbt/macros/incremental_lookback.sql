{# Artımlı modellerde yeniden işlenecek ilk saat (UTC), sabit bir TIMESTAMP literal'i olarak:
   max(hour_start_at_utc) - var('lookback_hours'), içinde bulunduğu UTC GÜNÜNÜN başına yuvarlanır.
   Gün başına yuvarlama insert_overwrite için şart: yeniden işlenen her günlük bölüm baştan sona
   yeniden yazılır (eksik saatle bölüm ezilmez). Literal olduğu için kaynak view'larda bölüm budaması
   çalışır (alt sorgulu filtrede budama garanti değil). Yalnızca is_incremental() içinde çağrılır. #}
{% macro incremental_lookback_start() -%}
    {%- if execute -%}
        {%- set q -%}
            select format_timestamp('%Y-%m-%d %H:%M:%S',
                timestamp_trunc(
                    coalesce(timestamp_sub(max(hour_start_at_utc), interval {{ var('lookback_hours') }} hour),
                             timestamp '1970-01-01'),
                    day))
            from {{ this }}
        {%- endset -%}
        {%- set ts = run_query(q).columns[0].values()[0] -%}
    {%- else -%}
        {%- set ts = '1970-01-01 00:00:00' -%}
    {%- endif -%}
    timestamp '{{ ts }}'
{%- endmacro %}

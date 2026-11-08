{# Santral adının çekirdeği: Türkçe karakter katlama, büyük harf, rakam/noktalama/tek harf ve genel tür
   kelimeleri atılır. Aynı konumu paylaşan santrallerin adları "ünite ekleri dışında aynı mı" kontrolü için. #}
{% macro plant_name_core(expr) -%}
    trim(regexp_replace(regexp_replace(regexp_replace(regexp_replace(
        upper(translate({{ expr }}, 'çğıöşüâîûÇĞİÖŞÜÂÎÛ', 'cgiosuaiuCGIOSUAIU')),
        r'[^A-Z]+', ' '),
        r'\b(HES|RES|GES|JES|BES|TES|DGKC|DGKCS|DGK|ENH|SANTRALI|SANTRAL|TERMIK|BARAJI|REG|BIYOGAZ|BIYOKUTLE|KOJENERASYON|ELEKTRIK|URETIM|ENERJI|AS|VE|REGULATORU|TESISI|COP|GAZ)\b', ' '),
        r'\b[A-Z]\b', ' '),
        r'\s+', ' '))
{%- endmacro %}

-- Son 90 günde eksik saatler (İstanbul saati). BigQuery konsolunda veya bq query ile çalıştırın.
-- Veri saat bittikten ~40 dk sonra yayımlandığı için son 2 saat beklenen kümeye alınmaz.
-- Not: PROJECT_ID'yi kendi projenizle değiştirmeyin; konsol varsayılan projeyi kullanır.
WITH beklenen AS (
  SELECT h AS ts, DATE(h, 'Europe/Istanbul') AS date_local
  FROM UNNEST(GENERATE_TIMESTAMP_ARRAY(
    TIMESTAMP(DATE_SUB(CURRENT_DATE('Europe/Istanbul'), INTERVAL 90 DAY), 'Europe/Istanbul'),
    TIMESTAMP_SUB(TIMESTAMP_TRUNC(CURRENT_TIMESTAMP(), HOUR), INTERVAL 2 HOUR),
    INTERVAL 1 HOUR)) AS h
),
kaynak AS (
  SELECT DISTINCT ts FROM epias_raw.realtime_generation_source
  WHERE date_local >= DATE_SUB(CURRENT_DATE('Europe/Istanbul'), INTERVAL 91 DAY)
),
ptf AS (
  SELECT DISTINCT ts FROM epias_raw.market_clearing_price
  WHERE date_local >= DATE_SUB(CURRENT_DATE('Europe/Istanbul'), INTERVAL 91 DAY)
),
santral AS (
  SELECT ts, date_local, COUNT(DISTINCT pp_id) AS santral_sayisi
  FROM epias_raw.realtime_generation_plant
  WHERE date_local >= DATE_SUB(CURRENT_DATE('Europe/Istanbul'), INTERVAL 91 DAY)
  GROUP BY ts, date_local
),
santral_medyan AS (
  SELECT DISTINCT date_local,
         PERCENTILE_CONT(santral_sayisi, 0.5) OVER (PARTITION BY date_local) AS gun_medyani
  FROM santral
)
SELECT 'realtime_generation_source' AS tablo, b.ts, 'satir yok' AS sorun, NULL AS santral_sayisi, NULL AS gun_medyani
FROM beklenen b LEFT JOIN kaynak k USING (ts) WHERE k.ts IS NULL
UNION ALL
SELECT 'market_clearing_price', b.ts, 'satir yok', NULL, NULL
FROM beklenen b LEFT JOIN ptf p USING (ts) WHERE p.ts IS NULL
UNION ALL
SELECT 'realtime_generation_plant', b.ts, 'satir yok', NULL, NULL
FROM beklenen b LEFT JOIN santral s USING (ts)
WHERE s.ts IS NULL
  AND b.date_local < CURRENT_DATE('Europe/Istanbul')  -- santral verisi ertesi gün yayımlanır
UNION ALL
SELECT 'realtime_generation_plant', s.ts, 'santral sayisi medyanin %80 altinda',
       s.santral_sayisi, m.gun_medyani
FROM santral s JOIN santral_medyan m USING (date_local)
WHERE s.santral_sayisi < 0.8 * m.gun_medyani
ORDER BY tablo, ts

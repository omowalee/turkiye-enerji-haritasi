/**
 * BU DOSYA OTOMATİK ÜRETİLDİ — elle düzenleme. Kaynak: contracts/mix_24h.schema.json
 */

import type { SourceType, Timestamp, GeneratedAt, LocalDate, PerSourceSeries } from "./common";


/**
 * Kaynak bazlı saatlik üretim. live: son 24 mevcut saat. plants_day: santral gününün tarihine ait kaynak tablosu (santral toplamlarına eşittir). Tamamı sıfır olan kaynak yazılmaz.
 */
export interface Mix24H {
  /**
   * Sözleşme sürümü.
   */
  schema_version: "0.1.0";
  /**
   * Dosyanın üretildiği an (+03:00).
   */
  generated_at: GeneratedAt;
  /**
   * Veride bulunan kaynaklar, gösterim sırasıyla.
   */
  sources: SourceType[];
  live: MixLive;
  plants_day: MixPlantsDay;
}
export interface MixLive {
  /**
   * Son 24 mevcut saat.
   *
   * @minItems 24
   * @maxItems 24
   */
  hours: [
    Timestamp,
    Timestamp,
    Timestamp,
    Timestamp,
    Timestamp,
    Timestamp,
    Timestamp,
    Timestamp,
    Timestamp,
    Timestamp,
    Timestamp,
    Timestamp,
    Timestamp,
    Timestamp,
    Timestamp,
    Timestamp,
    Timestamp,
    Timestamp,
    Timestamp,
    Timestamp,
    Timestamp,
    Timestamp,
    Timestamp,
    Timestamp
  ];
  mw: PerSourceSeries;
  ptf_tl_mwh: (number | null)[];
}
export interface MixPlantsDay {
  /**
   * Yerel (Europe/Istanbul) tarih, YYYY-MM-DD.
   */
  date: LocalDate;
  /**
   * Günün 24 saat başı.
   *
   * @minItems 24
   * @maxItems 24
   */
  hours: [
    Timestamp,
    Timestamp,
    Timestamp,
    Timestamp,
    Timestamp,
    Timestamp,
    Timestamp,
    Timestamp,
    Timestamp,
    Timestamp,
    Timestamp,
    Timestamp,
    Timestamp,
    Timestamp,
    Timestamp,
    Timestamp,
    Timestamp,
    Timestamp,
    Timestamp,
    Timestamp,
    Timestamp,
    Timestamp,
    Timestamp,
    Timestamp
  ];
  mw: PerSourceSeries;
  ptf_tl_mwh: (number | null)[];
}

/**
 * BU DOSYA OTOMATİK ÜRETİLDİ — elle düzenleme. Kaynak: contracts/provinces_24h.schema.json
 */

import type { Timestamp, GeneratedAt, LocalDate, PerSource } from "./common";


/**
 * Son tam gün için il toplamları. Sadece üretimi sıfırdan büyük iller, sıraya göre.
 */
export interface Provinces24H {
  /**
   * Sözleşme sürümü.
   */
  schema_version: "0.1";
  /**
   * Dosyanın üretildiği an (+03:00).
   */
  generated_at: GeneratedAt;
  /**
   * Yerel (Europe/Istanbul) tarih, YYYY-MM-DD.
   */
  date: LocalDate;
  /**
   * Günün 24 saati; her değer saatin başlangıcı (hour start), İstanbul saati.
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
  provinces: ProvinceDay[];
  unlocated: Unlocated;
}
export interface ProvinceDay {
  plate: number;
  /**
   * İl adı (geojson shapeName).
   */
  name: string;
  /**
   * @minItems 24
   * @maxItems 24
   */
  mw: [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number
  ];
  mwh_by_source: PerSource;
  total_mwh: number;
  /**
   * 1 = en büyük total_mwh.
   */
  rank: number;
  /**
   * Ülke toplamı içindeki pay (konumsuz dahil), 1 ondalık.
   */
  share_pct: number;
  plant_count: number;
}
/**
 * İle atanamayan santraller.
 */
export interface Unlocated {
  /**
   * @minItems 24
   * @maxItems 24
   */
  mw: [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number
  ];
  total_mwh: number;
  plant_count: number;
}

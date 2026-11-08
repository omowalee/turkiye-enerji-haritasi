/**
 * BU DOSYA OTOMATİK ÜRETİLDİ — elle düzenleme. Kaynak: contracts/generation_24h.schema.json
 */

import type { Timestamp, GeneratedAt, LocalDate } from "./common";

/**
 * Oynatma verisi, son tam gün. mw[i], plant_ids[i] santralinin 24 saatlik üretimidir (MW, tamsayı). Sadece o gün üretimi sıfırdan büyük santraller.
 */
export interface Generation24H {
  /**
   * Sözleşme sürümü.
   */
  schema_version: "0.2";
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
  plant_ids: number[];
  /**
   * Satır i, plant_ids[i] santralinin 24 değeridir.
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
  ][];
}

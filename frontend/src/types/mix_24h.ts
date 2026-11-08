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
  schema_version: "0.2";
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
   * Son 24 kesinleşmiş saat; saatin başlangıcı (hour start), İstanbul saati. Son eleman live.ts ile aynıdır.
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
  /**
   * Saatlik tüketim. Tüketim, MW (EPİAŞ gerçek zamanlı tüketim, rt-cons). Üretimden yaklaşık 1 saat sonra yayımlanır; henüz yoksa null. Dizi `hours` ile hizalıdır.
   *
   * @minItems 24
   * @maxItems 24
   */
  consumption_mw?: [
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null
  ];
  /**
   * Saatlik net dış ticaret. Net dış ticaret, MW. + = net ithalat, - = net ihracat. Üretim toplamlarına girmez. Dizi `hours` ile hizalıdır.
   *
   * @minItems 24
   * @maxItems 24
   */
  net_import_mw?: [
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null
  ];
  /**
   * Saatlik denge. Denge = lisanslı üretim - tüketim, MW; tüketim yoksa null. Negatif değer gündüz çoğunlukla lisanssız (sayaç arkası) güneşten kaynaklanır (lisanslı üretimde yok, tüketimde var); dış ticaret değildir. Dizi `hours` ile hizalıdır.
   *
   * @minItems 24
   * @maxItems 24
   */
  balance_mw?: [
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null
  ];
}
export interface MixPlantsDay {
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
  mw: PerSourceSeries;
  ptf_tl_mwh: (number | null)[];
  /**
   * Saatlik tüketim. Tüketim, MW (EPİAŞ gerçek zamanlı tüketim, rt-cons). Üretimden yaklaşık 1 saat sonra yayımlanır; henüz yoksa null. Dizi `hours` ile hizalıdır.
   *
   * @minItems 24
   * @maxItems 24
   */
  consumption_mw?: [
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null
  ];
  /**
   * Saatlik net dış ticaret. Net dış ticaret, MW. + = net ithalat, - = net ihracat. Üretim toplamlarına girmez. Dizi `hours` ile hizalıdır.
   *
   * @minItems 24
   * @maxItems 24
   */
  net_import_mw?: [
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null
  ];
  /**
   * Saatlik denge. Denge = lisanslı üretim - tüketim, MW; tüketim yoksa null. Negatif değer gündüz çoğunlukla lisanssız (sayaç arkası) güneşten kaynaklanır (lisanslı üretimde yok, tüketimde var); dış ticaret değildir. Dizi `hours` ile hizalıdır.
   *
   * @minItems 24
   * @maxItems 24
   */
  balance_mw?: [
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null
  ];
}

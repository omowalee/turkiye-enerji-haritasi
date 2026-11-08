/**
 * BU DOSYA OTOMATİK ÜRETİLDİ — elle düzenleme. Kaynak: contracts/common.schema.json
 */

/**
 * Kaynak türü. Sıra, yığılma ve gösterim sırasıdır.
 *
 * This interface was referenced by `Common`'s JSON-Schema
 * via the `definition` "SourceType".
 */
export type SourceType =
  | "gunes"
  | "ruzgar"
  | "hidro_baraj"
  | "hidro_akarsu"
  | "jeotermal"
  | "biyokutle"
  | "dogalgaz"
  | "ithal_komur"
  | "yerli_komur"
  | "nukleer"
  | "diger";
/**
 * Saat başı zaman damgası, Europe/Istanbul sabit +03:00. Örnek: 2026-11-07T23:00:00+03:00.
 *
 * This interface was referenced by `Common`'s JSON-Schema
 * via the `definition` "Timestamp".
 */
export type Timestamp = string;
/**
 * Üretim anı, +03:00 ofsetli ISO 8601 (dakika/saniye serbest).
 *
 * This interface was referenced by `Common`'s JSON-Schema
 * via the `definition` "GeneratedAt".
 */
export type GeneratedAt = string;
/**
 * Yerel (Europe/Istanbul) tarih, YYYY-MM-DD.
 *
 * This interface was referenced by `Common`'s JSON-Schema
 * via the `definition` "LocalDate".
 */
export type LocalDate = string;
/**
 * Ay, YYYY-MM.
 *
 * This interface was referenced by `Common`'s JSON-Schema
 * via the `definition` "Month".
 */
export type Month = string;

/**
 * Kaynak türü başına bir sayı. Sadece verisi olan kaynaklar bulunur.
 *
 * This interface was referenced by `Common`'s JSON-Schema
 * via the `definition` "PerSource".
 */
export interface PerSource {
  gunes?: number;
  ruzgar?: number;
  hidro_baraj?: number;
  hidro_akarsu?: number;
  jeotermal?: number;
  biyokutle?: number;
  dogalgaz?: number;
  ithal_komur?: number;
  yerli_komur?: number;
  nukleer?: number;
  diger?: number;
}
/**
 * Kaynak türü başına sayı dizisi (saatlik seri). Tamamı sıfır olan kaynak yazılmaz.
 *
 * This interface was referenced by `Common`'s JSON-Schema
 * via the `definition` "PerSourceSeries".
 */
export interface PerSourceSeries {
  gunes?: number[];
  ruzgar?: number[];
  hidro_baraj?: number[];
  hidro_akarsu?: number[];
  jeotermal?: number[];
  biyokutle?: number[];
  dogalgaz?: number[];
  ithal_komur?: number[];
  yerli_komur?: number[];
  nukleer?: number[];
  diger?: number[];
}

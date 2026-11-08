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
  | "solar"
  | "wind"
  | "hydro_dam"
  | "hydro_river"
  | "geothermal"
  | "biomass"
  | "natural_gas"
  | "imported_coal"
  | "lignite"
  | "nuclear"
  | "other";
/**
 * ISO 8601 zaman damgası, +03:00 ofsetli: saatin başlangıcı (hour start), İstanbul saati. Örnek: 2026-11-07T23:00:00+03:00.
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
  solar?: number;
  wind?: number;
  hydro_dam?: number;
  hydro_river?: number;
  geothermal?: number;
  biomass?: number;
  natural_gas?: number;
  imported_coal?: number;
  lignite?: number;
  nuclear?: number;
  other?: number;
}
/**
 * Kaynak türü başına sayı dizisi (saatlik seri). Tamamı sıfır olan kaynak yazılmaz.
 *
 * This interface was referenced by `Common`'s JSON-Schema
 * via the `definition` "PerSourceSeries".
 */
export interface PerSourceSeries {
  solar?: number[];
  wind?: number[];
  hydro_dam?: number[];
  hydro_river?: number[];
  geothermal?: number[];
  biomass?: number[];
  natural_gas?: number[];
  imported_coal?: number[];
  lignite?: number[];
  nuclear?: number[];
  other?: number[];
}

/**
 * BU DOSYA OTOMATİK ÜRETİLDİ — elle düzenleme. Kaynak: contracts/plants.schema.json
 */

import type { SourceType, GeneratedAt } from "./common";

/**
 * Santral listesi: ad, baskın kaynak, konum, il ve kapasite. Konumu eşleşmeyen santrallerde lat/lon/province null olur.
 */
export interface Plants {
  /**
   * Sözleşme sürümü.
   */
  schema_version: "0.1";
  /**
   * Dosyanın üretildiği an (+03:00).
   */
  generated_at: GeneratedAt;
  plants: Plant[];
}
export interface Plant {
  /**
   * EPİAŞ pp_id.
   */
  id: number;
  /**
   * EIC eki atılmış ad.
   */
  name: string;
  /**
   * Son 30 gün MWh'ye göre baskın kaynak.
   */
  source: SourceType;
  /**
   * Enlem, 4 ondalık.
   */
  lat: number | null;
  /**
   * Boylam, 4 ondalık.
   */
  lon: number | null;
  /**
   * İl plaka kodu.
   */
  province: number | null;
  /**
   * Kapasite MW (GEM işletmedeki toplam, yoksa OSM, yoksa null).
   */
  capacity_mw: number | null;
  match: PlantMatch;
}
export interface PlantMatch {
  /**
   * Eşleşen konum kaynağı; eşleşme yoksa null.
   */
  source: "gem" | "osm" | null;
  /**
   * Ad benzerliği puanı.
   */
  score: number;
}

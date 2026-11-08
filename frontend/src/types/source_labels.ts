/**
 * BU DOSYA OTOMATİK ÜRETİLDİ — elle düzenleme. Kaynak: contracts/source_labels.schema.json
 */

import type { SourceType } from "./common";

/**
 * Kaynak anahtarı -> Türkçe etiket ve yenilenebilir bayrağı. order: gösterim ve yığılma sırası. Tek doğruluk kaynağı.
 */
export interface SourceLabels {
  /**
   * Sözleşme sürümü.
   */
  schema_version: "0.2";
  /**
   * Gösterim ve yığılma sırası.
   */
  order: SourceType[];
  sources: {
    solar: SourceLabel;
    wind: SourceLabel;
    hydro_dam: SourceLabel;
    hydro_river: SourceLabel;
    geothermal: SourceLabel;
    biomass: SourceLabel;
    natural_gas: SourceLabel;
    imported_coal: SourceLabel;
    lignite: SourceLabel;
    nuclear: SourceLabel;
    other: SourceLabel;
  };
}
export interface SourceLabel {
  /**
   * Türkçe etiket.
   */
  label: string;
  /**
   * Yenilenebilir mi.
   */
  renewable: boolean;
}

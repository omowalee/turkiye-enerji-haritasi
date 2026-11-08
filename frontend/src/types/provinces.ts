/**
 * BU DOSYA OTOMATİK ÜRETİLDİ — elle düzenleme. Kaynak: contracts/provinces.schema.json
 */

/**
 * 81 il için sadeleştirilmiş GeoJSON FeatureCollection (geoBoundaries). Özellikler: plate, name, iso.
 */
export interface Provinces {
  type: "FeatureCollection";
  features: ProvinceFeature[];
}
export interface ProvinceFeature {
  type: "Feature";
  properties: ProvinceProps;
  geometry: ProvincePolygon | ProvinceMultiPolygon;
}
export interface ProvinceProps {
  plate: number;
  name: string;
  iso: string;
}
export interface ProvincePolygon {
  type: "Polygon";
  coordinates: unknown[];
}
export interface ProvinceMultiPolygon {
  type: "MultiPolygon";
  coordinates: unknown[];
}

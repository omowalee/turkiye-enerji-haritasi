import { SOURCE_PALETTE } from "./constants";
import type { SourceType } from "@/types";

/**
 * Türkiye Enerji Haritası — Tüm görsel sabitler, renkler, kamera ve 3D katmanlı il blok ölçekleri.
 */

export type MapFilter = "all" | "renewable" | "fossil" | SourceType;

/** 1. Harita Zemini, Deniz, Komşu Ülkeler ve İl Sınır Sabitleri */
export const SEA_BACKGROUND_HEX = "#05080F";
export const SEA_BACKGROUND_RGB: readonly [number, number, number] = [5, 8, 15];

/** Komşu ülkeler (Natural Earth /geo/neighbors.geojson) çok sönük kara dolgusu ve sınırı */
export const NEIGHBOR_LAND_FILL_HEX = "#080D18";
export const NEIGHBOR_LAND_FILL_RGBA: [number, number, number, number] = [
  8, 13, 24, 255,
];
export const NEIGHBOR_BORDER_RGBA: [number, number, number, number] = [
  24, 36, 56, 75,
];

/** İllerin taban dolgusu (#101A2C) ve iç sınır çizgisi (#3A5070, 1 px, opaklık 0,8) */
export const PROVINCE_FILL_HEX = "#101A2C";
export const PROVINCE_FILL_RGBA: [number, number, number, number] = [
  16, 26, 44, 255,
];

/** 10 MW altındaki veya seçili kaynakta 0 MW olan illerin koyu taban dolgusu */
export const LOW_PROVINCE_THRESHOLD_MW = 10;
export const LOW_PROVINCE_FILL_RGBA: [number, number, number, number] = [
  13, 21, 36, 255,
];
export const ZERO_SOURCE_PROVINCE_FILL_RGBA: [number, number, number, number] = [
  11, 18, 31, 255,
];

export const PROVINCE_BORDER_HEX = "#3A5070";
export const PROVINCE_BORDER_WIDTH_PX = 1;
export const PROVINCE_BORDER_OPACITY = 0.8;
export const PROVINCE_BORDER_RGBA: [number, number, number, number] = [
  58,
  80,
  112,
  Math.round(PROVINCE_BORDER_OPACITY * 255),
];

/** Kıyı ve ülke sınırı (#4A6A90, 1,5 px) */
export const COAST_COUNTRY_BORDER_HEX = "#4A6A90";
export const COAST_COUNTRY_BORDER_WIDTH_PX = 1.5;
export const COAST_COUNTRY_BORDER_RGBA: [number, number, number, number] = [
  74, 106, 144, 255,
];

/** İl üzerine gelince (hover) sınır vurgusu */
export const PROVINCE_HOVER_BORDER_HEX = "#6B8DB5";
export const PROVINCE_HOVER_BORDER_WIDTH_PX = 2;
export const PROVINCE_HOVER_BORDER_RGBA: [number, number, number, number] = [
  107, 141, 181, 255,
];

/** 2. Kamera ve Görünüm Ayarları (Bölüm 1 & Bölüm 4) */
export const DEFAULT_3D_PITCH_DEG = 50;
export const DEFAULT_3D_BEARING_DEG = -15;
export const MOBILE_BREAKPOINT_PX = 768;

/** Türkiye coğrafi sınır kutusu: [[batıBoylam, güneyEnlem], [doğuBoylam, kuzeyEnlem]] */
export const TURKEY_BOUNDS: [[number, number], [number, number]] = [
  [25.66, 35.81],
  [44.82, 42.11],
];

/** 3. Katmanlı 3D İl Blokları Yükseklik ve Etkileşim Ayarları (Bölüm 2 & Bölüm 3 & Bölüm 4) */
/**
 * Seçili görünümde en çok üreten ilin ulaşacağı maksimum 3D blok yüksekliği (metre, doğrusal ölçek).
 * Türkiye genişliğinde (~1.600 km) 115.000 m (~115 km görsel yükseklik),
 * iller arasındaki farkı net gösterir ama haritayı gökdelen ormanına çevirmez.
 */
export const MAX_PROVINCE_BLOCK_ELEVATION_M = 115_000;

/** 10 MW altındaki iller için alçak taban yüksekliği (m) */
export const LOW_PROVINCE_BASE_ELEVATION_M = 900;

/**
 * Üzerine gelinen (hover) veya sabitlenen ilin:
 * - Taban yüksekliği (z-offset): kendi toplam yüksekliğinin %30'u kadar havaya kalkar (minimum 12 km ile küçük illerde de belirgin).
 * - Dilim yüksekliği çarpanı: yüksekliği 2 katına uzar.
 * - Diğer illerin opaklığı: %40'a (0.40) iner.
 */
export const HOVER_LIFT_RATIO = 0.3;
export const HOVER_MIN_LIFT_M = 12_000;
export const HOVER_HEIGHT_MULTIPLIER = 2.0;
export const HOVER_BRIGHTEN_FACTOR = 0.24;
export const OTHER_PROVINCES_DIM_OPACITY = 0.4;
export const ACTIVE_PROVINCE_OPACITY = 0.96;

/** Geçiş (transition) süreleri (ms) */
export const HOVER_TRANSITION_MS = 300;
export const PLAYBACK_TRANSITION_MS = 400;
export const FILTER_TRANSITION_MS = 500;

/** 4. İl Adı Etiketleri (Bölüm 2) */
export const PROVINCE_LABEL_ALL_MIN_ZOOM = 7;
export const PROVINCE_LABEL_TOP_COUNT = 15;
export const PROVINCE_LABEL_FONT_SIZE_PX = 11.5;
export const PROVINCE_LABEL_HOVER_FONT_SIZE_PX = 13;
export const PROVINCE_LABEL_ELEVATION_PADDING_M = 4_500;
export const PROVINCE_LABEL_COLOR_RGBA: [number, number, number, number] = [
  241, 245, 249, 235,
];
export const PROVINCE_LABEL_DIM_COLOR_RGBA: [number, number, number, number] = [
  148, 163, 184, 105,
];
export const PROVINCE_LABEL_OUTLINE_RGBA: [number, number, number, number] = [
  5, 8, 15, 235,
];

/**
 * Tek kaynak filtresi seçildiğinde, ilin o kaynaktaki MW değerinin
 * Türkiye'deki en yüksek ile oranına (0..1) göre koyudan açığa kaynak rengi tonu hesaplar.
 */
export function computeSingleSourceShadeRgb(
  source: SourceType,
  normalizedRatio: number,
  isHovered: boolean
): [number, number, number] {
  const [baseR, baseG, baseB] = SOURCE_PALETTE[source].rgb;
  const clamped = Math.max(0, Math.min(1, normalizedRatio));
  // 0'dan büyük en düşük ilde kaynak renginin %48 parlaklığı, en yüksek ilde %108 parlaklığı + hafif beyaz karışımı
  const intensity = 0.48 + clamped * 0.52;
  const highlightMix = clamped * 0.16 + (isHovered ? HOVER_BRIGHTEN_FACTOR : 0);

  const r = Math.min(
    255,
    Math.round(baseR * intensity * (1 - highlightMix) + 255 * highlightMix)
  );
  const g = Math.min(
    255,
    Math.round(baseG * intensity * (1 - highlightMix) + 255 * highlightMix)
  );
  const b = Math.min(
    255,
    Math.round(baseB * intensity * (1 - highlightMix) + 255 * highlightMix)
  );
  return [r, g, b];
}

/**
 * Katmanlı görünümde (Tümü / Yenilenebilir / Fosil) kaynak dilimi rengini döndürür.
 * Hover durumunda dilim rengini hafifçe aydınlatır.
 */
export function computeSliceSourceRgb(
  source: SourceType,
  isHovered: boolean
): [number, number, number] {
  const [r, g, b] = SOURCE_PALETTE[source].rgb;
  if (!isHovered) return [r, g, b];
  const mix = HOVER_BRIGHTEN_FACTOR;
  return [
    Math.min(255, Math.round(r + (255 - r) * mix)),
    Math.min(255, Math.round(g + (255 - g) * mix)),
    Math.min(255, Math.round(b + (255 - b) * mix)),
  ];
}

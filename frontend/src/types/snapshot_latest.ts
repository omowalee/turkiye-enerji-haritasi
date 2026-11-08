/**
 * BU DOSYA OTOMATİK ÜRETİLDİ — elle düzenleme. Kaynak: contracts/snapshot_latest.schema.json
 */

import type { Timestamp, GeneratedAt, LocalDate, Month } from "./common";

/**
 * Canlı sayaçlar için en son özet. live: ülke kaynak verisi (yaklaşık 1 saat gecikmeli, sadece lisanslı üretim). plants_day: santral verisinin son tam günü.
 */
export interface SnapshotLatest {
  /**
   * Sözleşme sürümü.
   */
  schema_version: "0.1";
  /**
   * Dosyanın üretildiği an (+03:00).
   */
  generated_at: GeneratedAt;
  live: SnapshotLive;
  plants_day: SnapshotPlantsDay;
  unlicensed_solar: SnapshotUnlicensedSolar;
  /**
   * Akkuyu bir ünitesinin MW değeri; eşdeğer = kaynak MW / 1200.
   */
  akkuyu_unit_mw: 1200;
}
/**
 * Ülke kaynak bazlı veri, son KESİNLEŞMİŞ saat (en yeni saatten bir önceki; en yeni saat ön veridir ve sonradan yukarı revize edilir). Sadece lisanslı yurt içi üretim.
 */
export interface SnapshotLive {
  /**
   * Son kesinleşmiş saatin başlangıcı (hour start), İstanbul saati. Tüm live değerleri bu saate aittir.
   */
  ts: Timestamp;
  /**
   * Lisanslı yurt içi üretim, dış ticaret hariç (MW).
   */
  total_mw: number;
  /**
   * Yenilenebilir pay, yüzde, 1 ondalık.
   */
  renewable_share_pct: number;
  /**
   * Sadece verisi bulunan kaynaklar.
   */
  by_source: {
    solar?: SourceMw;
    wind?: SourceMw;
    hydro_dam?: SourceMw;
    hydro_river?: SourceMw;
    geothermal?: SourceMw;
    biomass?: SourceMw;
    natural_gas?: SourceMw;
    imported_coal?: SourceMw;
    lignite?: SourceMw;
    nuclear?: SourceMw;
    other?: SourceMw;
  };
  /**
   * Aynı (kesinleşmiş) saat için PTF (TL/MWh); yoksa null.
   */
  ptf_tl_mwh: number | null;
  provisional?: SnapshotProvisional;
}
export interface SourceMw {
  /**
   * Ortalama MW (tamsayı).
   */
  mw: number;
  /**
   * Akkuyu eşdeğeri = mw / 1200, 2 ondalık.
   */
  akkuyu: number;
}
/**
 * Ön veri, panel şimdilik kullanmaz.
 */
export interface SnapshotProvisional {
  /**
   * En yeni (ön veri) saatin başlangıcı (hour start), İstanbul saati.
   */
  ts: Timestamp;
  /**
   * O saatin lisanslı yurt içi üretim toplamı, dış ticaret hariç (MW).
   */
  total_mw: number;
}
/**
 * Santral verisinin son tam günü (canlı modda harita bunu gösterir).
 */
export interface SnapshotPlantsDay {
  /**
   * Yerel (Europe/Istanbul) tarih, YYYY-MM-DD.
   */
  date: LocalDate;
  /**
   * Günün son saatinin başlangıcı (T23:00), İstanbul saati.
   */
  last_hour_ts: Timestamp;
  /**
   * Santral toplamı, son saat, MW (lisanslı yurt içi üretim, dış ticaret hariç).
   */
  total_mw_last_hour: number;
  /**
   * O gün üretimi sıfırdan büyük santral sayısı.
   */
  plant_count: number;
}
/**
 * Lisanssız güneş bilgi notu; aylık ve gecikmeli.
 */
export interface SnapshotUnlicensedSolar {
  /**
   * Ay, YYYY-MM.
   */
  month: Month;
  /**
   * Ay ortalaması, MW.
   */
  avg_mw: number;
  /**
   * Saat-günü bazında ay ortalamasının tepe değeri, MW.
   */
  peak_mw: number;
  source: "ren-ul-gen";
}

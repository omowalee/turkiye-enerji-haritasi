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
  schema_version: "0.1.0";
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
 * Ülke kaynak bazlı veri, en son saat.
 */
export interface SnapshotLive {
  /**
   * En son mevcut saatin başlangıcı.
   */
  ts: Timestamp;
  /**
   * Lisanslı toplam MW (ithalat/ihracat hariç).
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
    gunes?: SourceMw;
    ruzgar?: SourceMw;
    hidro_baraj?: SourceMw;
    hidro_akarsu?: SourceMw;
    jeotermal?: SourceMw;
    biyokutle?: SourceMw;
    dogalgaz?: SourceMw;
    ithal_komur?: SourceMw;
    yerli_komur?: SourceMw;
    nukleer?: SourceMw;
    diger?: SourceMw;
  };
  /**
   * Aynı saat için PTF (TL/MWh); yoksa null.
   */
  ptf_tl_mwh: number | null;
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
 * Santral verisinin son tam günü (canlı modda harita bunu gösterir).
 */
export interface SnapshotPlantsDay {
  /**
   * Yerel (Europe/Istanbul) tarih, YYYY-MM-DD.
   */
  date: LocalDate;
  /**
   * Günün son saati (T23:00).
   */
  last_hour_ts: Timestamp;
  /**
   * Santral toplamı, son saat, MW.
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

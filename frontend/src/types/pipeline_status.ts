/**
 * BU DOSYA OTOMATİK ÜRETİLDİ — elle düzenleme. Kaynak: contracts/pipeline_status.schema.json
 */

import type { GeneratedAt } from "./common";

/**
 * Adımın katmanı: epias = EPİAŞ'tan çekme, bigquery = BigQuery kontrolü, dbt = dbt modelleri ve testleri, export = JSON dışa aktarma/doğrulama, gcs = kovaya yayın.
 */
export type Stage = "epias" | "bigquery" | "dbt" | "export" | "gcs";
/**
 * pending = sırada/başlamadı, retrying = hata verdi, yeniden denenecek, skipped = yapılacak iş yoktu (normal), upstream_failed = önceki adım başarısız olduğu için çalışmadı.
 */
export type StepState = "pending" | "running" | "success" | "failed" | "retrying" | "skipped" | "upstream_failed";

/**
 * Airflow DAG'larının en son çalışması ve her adımın durumu. scripts/pipeline_status.py yaklaşık 20 saniyede bir üretir; değişiklik yoksa da en geç 2 dakikada bir yeniden yazar (generated_at canlılık sinyalidir).
 */
export interface PipelineStatus {
  /**
   * Sözleşme sürümü.
   */
  schema_version: "0.2";
  /**
   * Dosyanın üretildiği an (+03:00). 5 dakikadan eskiyse izleyici (Docker) çalışmıyor demektir.
   */
  generated_at: GeneratedAt;
  /**
   * Her DAG için bir kayıt. Sıra gösterim sırasıdır (önce saatlik, sonra günlük).
   */
  pipelines: Pipeline[];
}
export interface Pipeline {
  /**
   * Airflow dag_id (ör. enerji_saatlik).
   */
  id: string;
  /**
   * Türkçe ad.
   */
  label: string;
  /**
   * Zamanlama, Türkçe (ör. "Her saat :50'de").
   */
  schedule_label: string;
  /**
   * DAG duraklatılmış mı (true ise zamanlanmış çalışma olmaz).
   */
  is_paused: boolean;
  /**
   * En son başarılı çalışmanın bitiş anı. Hiç yoksa null.
   */
  last_success_at: GeneratedAt | null;
  /**
   * En son çalışma (sürüyor olabilir). Hiç çalışma yoksa null.
   */
  run: Run | null;
  /**
   * En son çalışmanın adımları, akış sırasıyla. depends_on ile ağaç kurulur.
   */
  steps: Step[];
}
export interface Run {
  /**
   * Airflow run_id.
   */
  id: string;
  /**
   * Zamanlanmış mı, elle mi tetiklendi.
   */
  trigger: "scheduled" | "manual" | "other";
  /**
   * Çalışmanın durumu.
   */
  state: "queued" | "running" | "success" | "failed";
  started_at: GeneratedAt | null;
  ended_at: GeneratedAt | null;
}
export interface Step {
  /**
   * Airflow task_id.
   */
  id: string;
  /**
   * Türkçe adım adı.
   */
  label: string;
  stage: Stage;
  /**
   * Verinin okunduğu yer, Türkçe (ör. "EPİAŞ Şeffaflık Platformu API").
   */
  from: string;
  /**
   * Verinin yazıldığı yer, Türkçe (ör. "BigQuery · epias_raw").
   */
  to: string;
  state: StepState;
  started_at: GeneratedAt | null;
  ended_at: GeneratedAt | null;
  /**
   * Kaçıncı deneme (0 = henüz başlamadı).
   */
  try_number: number;
  /**
   * Bu adımdan önce gelen adımların id'leri (ağacın kenarları).
   */
  depends_on: string[];
}

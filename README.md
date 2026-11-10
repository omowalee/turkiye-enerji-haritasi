# Türkiye Enerji Haritası

Türkiye'deki elektrik santrallerinin saatlik lisanslı üretimini koyu temalı bir harita panelinde gösteren veri ürünü.
Akış: EPİAŞ API → Python (`pipeline/`) → BigQuery `epias_raw` → dbt → `epias_marts` → JSON → React paneli (`frontend/`).
Kurallar ve kararlar: `AGENTS.md`. Güncel durum: `docs/ilerleme.md`. Veri sözleşmesi: `docs/data-contract.md`.

## Atıflar

- EPİAŞ Şeffaflık Platformu
- Global Energy Monitor
- © OpenStreetMap katkıcıları
- geoBoundaries
- Natural Earth

## Nasıl çalıştırılır

Veri hattı yerelde Docker (Airflow 3.1, LocalExecutor) ile çalışır; panel GitHub Pages'te, JSON'lar GCS kovasında durur.

1. **Anahtarlar.** `secrets/` klasörü git dışıdır.
   - `secrets/bq.json`: BigQuery servis hesabı anahtarı (zorunlu).
   - `secrets/publisher.json`: yalnızca kovaya yazma yetkili ayrı servis hesabı anahtarı (yayın için; yoksa yayın adımı "yayın atlandı" der ve geçer).
2. **`.env`** (`.env.example`'daki adlarla): `EPIAS_USERNAME`, `EPIAS_PASSWORD`, `GCP_PROJECT_ID`, `POSTGRES_PASSWORD`, `AIRFLOW_ADMIN_USER`, `AIRFLOW_ADMIN_PASSWORD`, `AIRFLOW_FERNET_KEY`, `AIRFLOW_SECRET_KEY`, `AIRFLOW_JWT_SECRET`, `GCS_BUCKET` (yayın için). Üretme komutları `.env.example` içinde.
3. **Başlat:**
   ```
   docker compose -f docker/docker-compose.yml up -d --build
   ```
   İlk kurulum birkaç dakika sürer (imaj ~4 GB).
4. **Arayüz:** http://localhost:8081 (kullanıcı ve şifre `.env`'deki `AIRFLOW_ADMIN_*`).
5. **DAG'ları aç:** `enerji_saatlik` (her saat :50) ve `enerji_gunluk` (06:50) kurulumda **duraklatılmıştır**. Arayüzden anahtarı aç ya da:
   ```
   docker compose -f docker/docker-compose.yml exec airflow-scheduler airflow dags unpause enerji_saatlik
   ```
6. **Günlükler:** arayüzde görev → Logs; ya da `docker compose -f docker/docker-compose.yml logs -f airflow-scheduler`.
6b. **Hat durumu:** `pipeline-status` servisi Airflow'u 20 sn'de bir okuyup `pipeline_status.json`'u kovaya yazar; panel bunu akış ağacı olarak gösterir. Günlük: `docker compose -f docker/docker-compose.yml logs -f pipeline-status`.
7. **Durdur:** `docker compose -f docker/docker-compose.yml stop` (veri korunur; tekrar `start`/`up -d`).
   **Uyarı:** `down -v` Airflow veritabanını (`enerji-pgdata`) siler; DAG geçmişi ve ayarlar gider. BigQuery verisi etkilenmez.

Bilgisayar uyurken kaçan saatler bir sonraki çalışmada kendiliğinden tamamlanır (son 3-7 gün `load_log`'a göre doldurulur, dbt `lookback_hours` son başarılı çalışmadan bu yana geçen süreye göre 48-168 saat olur).

Yerel doğrulama (Docker'sız): `.venv/Scripts/python -X utf8 -m scripts.check`.

## Kaynak tüketimi

- **RAM (ölçülen, boşta):** zamanlayıcı ~0,5 GB, API sunucusu ~0,2 GB, DAG işleyici ~0,2 GB, Postgres ~0,05 GB, toplam ≈ 1 GB. dbt/ingest çalışırken zamanlayıcı ~1 GB'a çıkar; tepe ≈ 1,5 GB. Docker Desktop/WSL2 sanal makinesinin kendi yükü eklenir (≈ +0,5 GB). Üst sınırlar: 2 + 1 + 0,5 + 0,5 = 4 GB.
- **BigQuery:** saatlik hat ve testler ayda yaklaşık 45 GB tarar; aylık 1 TB ücretsiz dilimin çok altında. Depolama 10 GB ücretsiz dilimin içindedir.

## Yayın (GitHub Pages)

`.github/workflows/pages.yml`, elle tetiklendiğinde (Actions → Pages → Run workflow; push tetikleyicisi şimdilik kapalı) `frontend/`'i derler (`VITE_DATA_BASE_URL` = repo değişkeni `DATA_BASE_URL`, GCS kovasının genel adresi) ve Pages'e yükler. Kovanın CORS ayarı: `docker/cors.json` (`gcloud storage buckets update gs://<kova> --cors-file=docker/cors.json`).

Site proje sayfası olarak yayınlanır (`https://omowalee.github.io/<repo>/`). İş akışı `VITE_BASE_PATH=/<repo>/` verir; `frontend/vite.config.ts` bunu `base` olarak kullanır, yerelde `/` kalır.

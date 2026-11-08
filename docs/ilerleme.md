# İlerleme

Her iki araç da oturum sonunda kendi bölümünü günceller. Kısa yaz: ne yapıldı, ne doğrulandı, açık sorular, sıradaki adım.

## Genel durum

- Sürüm: 1
- Tamamlanan: Aşama 0 (keşif), Aşama 1 (veri çekme, 90 gün geçmiş), sözleşme v0
- Devam eden: Aşama 2 ve 3 veri tarafı bitti (dbt marts, dışa aktarma mart'lardan); sırada Aşama 5 otomasyon — Claude Code · Frontend: tasarım önerisi prompt'u kullanıcıda (Antigravity)
- Alınmış kararlar: `AGENTS.md` → "Alınmış ürün kararları"

## Veri tarafı (Claude Code)

- Son güncelleme: 2026-11-08 (Aşama 2 bölüm 3: marts; Aşama 3: dışa aktarma mart'lardan)
- Yapılanlar:
  - `pipeline/epias`: 5 EPİAŞ servisi. `pipeline/bq` ve `jobs`: `epias_raw` tablolarına `date_local` bölümlü idempotent yükleme.
  - `geo_raw`: GEM 4.131, OSM 1.796, il sınırları 81 satır.
  - Komutlar: `python -m pipeline.jobs.ingest` (saatlik), `backfill --days 90`, `load_reference`.
- Doğrulama: 90 gün (10.08–07.11) için `sql/eksik_saatler.sql` 0 eksik saat döndürdü. Santral tablosu 3.676.102 satır, 0 kopya. Santral toplamı = ülke toplamı (dış ticaret hariç). pytest 25/25.
- Kararlar (ayrıntı: AGENTS.md, docs/kararlar.md):
  - Santral verisi en erken ertesi gün geliyor (SEF1149). Saatlik iş santral verisini yalnızca dün için çekiyor.
  - İki mod: canlı modda sayaçlar ve grafik bugünü gösterir, harita en son tam günde durur. Oynatma modunda hepsi en son tam güne geçer.
  - Tazelik eşikleri: santral verisi 36 saatte uyarı, 48 saatte hata. Kaynak bazlı veri 4 saatte uyarı, 6 saatte hata (2026-11-08'de 3 saatten 4 saate çıkarıldı).
  - Lisanssız üretim: yalnızca lisanslı üretim gösterilir, "lisanslı üretim" etiketi ve gecikme etiketli lisanssız güneş notu eklenir. Tahmin Sürüm 2'de.
- Sözleşme v0 (2026-11-08):
  - `contracts/`: 6 dosya şeması + `common.schema.json` (JSON Schema 2020-12, `schema_version` 0.1.0). Açıklama: `docs/data-contract.md`.
  - `frontend/src/types/`: şemalardan üretildi (`cd contracts && npm run gen:types`, json-schema-to-typescript 15.0.4).
  - `frontend/public/data/sample/`: gerçek veriden (live 08.11 10:00 kesinleşmiş saat, santral günü 07.11), `python -m scripts.export_sample` ile. Toplam 500 KB (gzip 102 KB).
  - Revizyon (8b0fbe1): İngilizce kaynak anahtarları + `contracts/source_labels.json` (Türkçe etiketler), `schema_version: "0.1"`, kesinleşmiş saat kuralı + `live.provisional`.
  - Tek doğrulama komutu: `.venv/Scripts/python -X utf8 -m scripts.check` (dışa aktar → şema → tip senkronu → frontend typecheck/build). Son sonuç: hepsi geçti (frontend yok, atlandı).
  - Worktree: `../a-frontend` (`frontend` branch, 8b0fbe1'den).
- Aşama 2 bölüm 1 (9ab0aab…eb0b1d3):
  - dbt-core 1.11.17 + dbt-bigquery 1.12.2 (1.12.x kurulumu GitHub 504 ile düştü), dbt_utils 1.3.3. Proje `dbt/`, profil `dbt/profiles.yml` (sırsız, `.env`'den okur). Çalıştırma: `./scripts/dbt.sh build`.
  - Dataset: `epias_staging` (staging, intermediate, seed), `epias_marts` (mart). Seed: `source_types` (contracts/source_labels.json ile birebir), `epias_fuel_map`, `unlicensed_fuel_map`. Unpivot dinamik; yeni EPİAŞ kolonu (ör. nükleer) uyarı testine düşer.
  - Staging (view): generation_by_source 21.720, generation_by_plant 2.533.647 (sıfırlar atıldı), power_plants 1.835, market_clearing_price 2.184, unlicensed_generation 7.320, plant_locations (gem 3.294 + osm 1.796), provinces 81.
  - Doğrulama: tam `dbt build` PASS=64, WARN=0, ERROR=0; santral toplamı = ülke toplamı testi 5 tam günde geçti. `dbt source freshness` geçti.
  - Notlar: `eic` tekil değil (TUTES-A/B), eşleştirmede anahtar olamaz. OSM'de 513 satır adsız, 1.104 satırda kapasite yok. Plant view'ı tarih filtresiz ~0,7 GB tarar, mart'lar `date_tr` filtrelemeli.
- Açık sorular:
  - ~~Son saat eksik geliyor~~ → **karar verildi (2026-11-08):** `live.ts` = ülke verisindeki en son saatten bir önceki saat; en son saat `live.provisional` alanında. Aşama 2'de dbt kuralı + test.
  - **Çalışma şekli değişti (2026-11-08):** worktree ve agy otomasyonu iptal edildi. İki araç da `a/` içinde ve `master`'da çalışıyor. Antigravity yalnızca `frontend/` klasörüne yazıyor, git kullanmıyor. Commit'leri Claude Code atıyor. Kurallar `AGENTS.md`'de. `antigravity-frontend` ajanı `.claude-yedek/` klasörüne taşındı.
  - v0 eşleştirmesi geçici: %82,4 konumlu üretim, yanlış pozitif örneği "KARAKAYA HES TRABZON" → Diyarbakır.
  - Örnek export yerel `data/raw/` (git dışı) dosyalarına bağlı. dbt sonrası export mart'lardan okuyacak.
  - eptr2 hata türlerini ayırmıyor, tekrar deneme kararı mesaj metnine bakıyor (kırılgan).
  - Ham kolonlar NULL olabiliyor, `not_null` kontrolü dbt testlerinde yapılacak.
- Aşama 2 bölüm 2: eşleştirme (8116205…cd05922, Opus). Rapor: `docs/eslestirme-raporu.md`.
  - `int_plant_profile` (santral, son 30 gün), `scripts/match_plants.py` → üretilmiş seed `plant_match_candidates.csv`, elle düzeltme seed'i `plant_match_overrides.csv` (46 satır: 34 match, 12 no_match), `int_plants_matched` (santral başına konum, il, `match_method`, `match_confidence`).
  - Konumlu üretim: %85,98 → **%91,74** (ilk 200: %98,44). Konumsuz pay %8,26. KARAKAYA HES TRABZON ve PİRİNÇLİ HES `no_match` oldu. BANDIRMA3 ve AFYON1 doğru kayda bağlandı.
  - Doğrulama: PASS=42, WARN=2 (kapasite tutarsızlığı 10, paylaşılan konum 5; hepsi bilinçli düzeltme), ERROR=0. Claude Code tekrar çalıştırdı: aynı.
  - Yenileme: `python -m scripts.match_plants` → `./scripts/dbt.sh build --select plant_match_candidates+` (henüz Airflow'a bağlı değil).
- Açık kararlar (kullanıcı):
  - ~~`max_unmatched_generation_share`~~ → karar: %10 uyarı, %15 hata (iki değişken, tek test). Gerçek değer 0,0826.
  - ~~Kurulu güç paylaşılan/vekil kayıtta~~ → karar: yalnızca kaydı tek santral kullanıyorsa ve vekil değilse; aksi halde NULL (`dim_plants`). Vekil bayrağı seed kolonu `is_location_proxy`.
  - Emin olunmayan düzeltmeler gözle kontrol edilmeli (raporun 5. bölümü: TÜPRAŞ vekil kayıtları, ERDEMİR, AFYON1, EFE JES'ler, MAREN/MEHMETHAN, ADA DGKÇS, MERSİN RES, İSTAÇ BES).
- ~~Teknik borç: tekilleştirme penceresi bölüm budamasını engelliyor~~ → düzeltildi (631b7d0): 7 gün 664 → 52 MiB, `int_plant_profile` 664 → 296 MiB.
- Aşama 2 bölüm 3 + Aşama 3 (631b7d0…0501c7a, Opus):
  - `int_generation_enriched` (view). Mart'lar (`epias_marts`): `dim_plants` (1.835), `fct_generation_hourly` (artımlı merge, 2,4 M satır, gün bölümü), `agg_generation_by_source_hourly` (21,7 bin, `is_finalized`), `agg_generation_by_province_hourly` (artımlı, 478 bin; konumsuz = `plate_code` NULL / `province_key` 0), `mart_live_snapshot` (tek satır).
  - Artımlı çalışma: son `lookback_hours` (48) saat, fct 25,9 MiB, il 22,9 MiB. Eşleştirme değişince `agg_generation_by_province_hourly` için `--full-refresh` gerekir (test yakalar).
  - Testler: kesinleşmiş saat (`assert_live_hour_is_one_before_latest`), tek satır, paylar %100, mart düzeyinde santral = ülke, il toplamı = santral toplamı, il tablosu güncel eşleştirmeyle tutarlı.
  - Dışa aktarma artık mart'lardan (~6,7 MiB tarama, `data/raw` bağımlılığı yok). Sözleşme şekli aynı, sürüm 0.1. Örnekler: santral gününde konumlu üretim %82,4 → %89,3; `capacity_mw` dolu 736 → 633.
  - Doğrulama: tam `dbt build` PASS=180 WARN=2 (bilinen) ERROR=0. `scripts.check`: 1-3 geçti, 4 (frontend typecheck) Antigravity'nin üzerinde çalıştığı `TurkeyMap.tsx` içindeki kullanılmayan değişkenler (TS6133) yüzünden düştü; veri tarafıyla ilgisiz.
- Sıradaki: Aşama 5 (Airflow: ingest → dbt build → export). Açık: frontend typecheck hatası Antigravity'de.

## Frontend (Antigravity)

- Son güncelleme: 2026-11-08 (commit'leri Claude Code attı)
- Yapılanlar:
  - `frontend/docs/tasarim-onerisi.md` (fda748b): koyu palet, 11 kaynak rengi, Space Grotesk / Inter / JetBrains Mono, masaüstü ve mobil yerleşim, mod ayrımı, durumlar.
  - Panel iskeleti (d90d602; kullanıcı Antigravity'ye ayrıca kodlama prompt'u vermişti): Vite + React 19 + TS strict, Tailwind v4, deck.gl (altlık haritasız, il poligonları üzerinde), canlı sayaçlar, santral noktaları, "Santral verisi" rozeti, lisanssız güneş notu, atıflar. Notlar: `frontend/docs/notlar.md`.
- Doğrulama (typecheck/build): `scripts.check --skip-export`: hepsi geçti (şema, tip senkronu, typecheck, build). Değişiklikler yalnızca `frontend/` içinde.
  - Tasarım onaylandı (2026-11-08). Linyit rengi `#A8A29E` (zeminde 7,9:1).
  - 3D sütunlar (b6f023f): ColumnLayer, karekök yükseklik ölçeği, masaüstünde 45° / mobilde 2D, 2D/3D düğmesi, tıklama kartı, seçili saat `App.tsx` içinde tek state'te.
  - Bağlam katmanı varlığı (f3e5704, Claude Code): `public/geo/neighbors.geojson` (Natural Earth 1:50m, 31 komşu, 28 KB). Antigravity tarafında bağlanması bekleniyor.
- Açık sorular:
  - Harici tile servisi yok (karar). Bağlam Natural Earth'ten.
  - Linyit (`#A8A29E`) ile diğer (`#D4A373`) arasında parlaklık farkı yok (1,12:1). Renk körlüğünde karışabilir.
  - İki modlu oynatma: Canlı / Oynatma seçici, zaman çubuğu (oynat/duraklat, hız, imleç), yuvarlanan sayaçlar. Commit'i aşağıdaki birleştirme günlüğünde.
  - **Geri dönüş noktası:** git tag `gorsel-v1-kontrol-odasi`. Görsel yön bundan sonra baştan değişecek.
- Sıradaki: yeni görsel yön (prompt'u kullanıcı veriyor) → kaynak grafiği → il paneli → mobil.

## Sözleşme istekleri

Frontend'in ihtiyaç duyduğu yeni alanlar buraya yazılır. Veri tarafı şemayı güncelleyince "yapıldı" olarak işaretler.

| Tarih | İsteyen | İstek | Durum |
|---|---|---|---|

## Birleştirme günlüğü

| Tarih | Yön | Doğrulama sonucu |
|---|---|---|
| 2026-11-08 | frontend: tasarım önerisi + iskelet (fda748b, d90d602) | scripts.check: hepsi geçti |
| 2026-11-08 | frontend: 3D sütunlar (b6f023f) | scripts.check: hepsi geçti |
| 2026-11-08 | frontend: iki modlu oynatma (tag gorsel-v1-kontrol-odasi) | scripts.check: hepsi geçti |

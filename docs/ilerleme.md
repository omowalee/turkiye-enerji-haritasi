# İlerleme

Her iki araç da oturum sonunda kendi bölümünü günceller. Kısa yaz: ne yapıldı, ne doğrulandı, açık sorular, sıradaki adım.

## Genel durum

- Sürüm: 1
- Tamamlanan: Aşama 0 (keşif), Aşama 1 (veri çekme, 90 gün geçmiş), sözleşme v0
- Devam eden: Aşama 2 (dbt; staging bitti, sırada eşleştirme) — Claude Code · Frontend: tasarım önerisi prompt'u kullanıcıda (Antigravity)
- Alınmış kararlar: `AGENTS.md` → "Alınmış ürün kararları"

## Veri tarafı (Claude Code)

- Son güncelleme: 2026-11-08 (Aşama 2 bölüm 1: dbt kurulumu + staging bitti)
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
- Sıradaki: Aşama 2 bölüm 2 — `int_plants_matched` (Opus, Claude limiti yenilenince): en büyük 200 santral + `seeds/plant_match_overrides.csv`. Sonra intermediate → marts → kesinleşmiş saat testi.

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
- Sıradaki: bağlam katmanı (Türkiye parlak, komşular sönük) → 24 saatlik oynatma (iki mod) → kaynak grafiği → il paneli → mobil.

## Sözleşme istekleri

Frontend'in ihtiyaç duyduğu yeni alanlar buraya yazılır. Veri tarafı şemayı güncelleyince "yapıldı" olarak işaretler.

| Tarih | İsteyen | İstek | Durum |
|---|---|---|---|

## Birleştirme günlüğü

| Tarih | Yön | Doğrulama sonucu |
|---|---|---|
| 2026-11-08 | frontend: tasarım önerisi + iskelet (fda748b, d90d602) | scripts.check: hepsi geçti |
| 2026-11-08 | frontend: 3D sütunlar (b6f023f) | scripts.check: hepsi geçti |

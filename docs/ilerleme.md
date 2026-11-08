# İlerleme

Her iki araç da oturum sonunda kendi bölümünü günceller. Kısa yaz: ne yapıldı, ne doğrulandı, açık sorular, sıradaki adım.

## Genel durum

- Sürüm: 1
- Tamamlanan: Aşama 0 (keşif), Aşama 1 (veri çekme, 90 gün geçmiş), sözleşme v0
- Devam eden: Aşama 2 (dbt; staging bitti, sırada eşleştirme) — Claude Code · Frontend: agy kurulu, preflight geçti; tasarım önerisi izin kuralı onayını bekliyor
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
  - Tazelik eşikleri: santral verisi 36 saatte uyarı, 48 saatte hata. Kaynak bazlı veri 3 saatte uyarı, 6 saatte hata.
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
  - Tazelik eşiği: kaynak verisinin normal yaşı 1,7–2,7 sa; 3 sa uyarı eşiği ~20 dk pay bırakıyor, küçük gecikmede uyarı verir. Eşik değişmedi (karar kullanıcıda).
  - ~~Son saat eksik geliyor~~ → **karar verildi (2026-11-08):** `live.ts` = ülke verisindeki en son saatten bir önceki saat; en son saat `live.provisional` alanında. Aşama 2'de dbt kuralı + test.
  - agy 1.5.3 kurulu (`/c/Users/numan/AppData/Local/agy/bin/agy.exe`), preflight geçti. Headless çalıştırmada `python .agents/skills/ui-ux-pro-max/scripts/search.py` komutu izin olmadığı için reddedildi; dar izin kuralı (`--settings .agy/settings.json`, oturuma özel) kullanıcı onayında. `--dangerously-skip-permissions` kullanılmayacak.
  - v0 eşleştirmesi geçici: %82,4 konumlu üretim, yanlış pozitif örneği "KARAKAYA HES TRABZON" → Diyarbakır.
  - Örnek export yerel `data/raw/` (git dışı) dosyalarına bağlı. dbt sonrası export mart'lardan okuyacak.
  - eptr2 hata türlerini ayırmıyor, tekrar deneme kararı mesaj metnine bakıyor (kırılgan).
  - Ham kolonlar NULL olabiliyor, `not_null` kontrolü dbt testlerinde yapılacak.
- Sıradaki: Aşama 2 bölüm 2 — `int_plants_matched` (Opus, Claude limiti yenilenince): en büyük 200 santral + `seeds/plant_match_overrides.csv`. Sonra intermediate → marts → kesinleşmiş saat testi.

## Frontend (Antigravity)

- Son güncelleme:
- Yapılanlar:
- Doğrulama (typecheck/build):
- Açık sorular:
- Sıradaki:

## Sözleşme istekleri

Frontend'in ihtiyaç duyduğu yeni alanlar buraya yazılır. Veri tarafı şemayı güncelleyince "yapıldı" olarak işaretler.

| Tarih | İsteyen | İstek | Durum |
|---|---|---|---|

## Birleştirme günlüğü

| Tarih | Yön | Doğrulama sonucu |
|---|---|---|

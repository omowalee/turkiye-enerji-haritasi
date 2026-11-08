# İlerleme

Her iki araç da oturum sonunda kendi bölümünü günceller. Kısa yaz: ne yapıldı, ne doğrulandı, açık sorular, sıradaki adım.

## Genel durum

- Sürüm: 1
- Tamamlanan: Aşama 0 (keşif), Aşama 1 (veri çekme, 90 gün geçmiş), sözleşme v0
- Devam eden: Aşama 2 (dbt) — Claude Code · Aşama 4 iskeleti (örnek veriyle) — Antigravity
- Alınmış kararlar: `AGENTS.md` → "Alınmış ürün kararları"

## Veri tarafı (Claude Code)

- Son güncelleme: 2026-11-08 (sözleşme v0 bitti)
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
  - `frontend/public/data/sample/`: gerçek veriden (live 08.11 11:00, santral günü 07.11), `python -m scripts.export_sample` ile. Toplam 501 KB (gzip 102 KB).
  - Doğrulama: 6/6 dosya şemaya uyuyor (`--validate-only`), `tsc --noEmit --strict` geçti.
- Açık sorular:
  - **Son saat eksik geliyor:** EPİAŞ kaynak bazlı verinin son saatini önce eksik yayımlıyor (08.11 11:00: 12.909 → 19.920 MW). `mart_live_snapshot` için "kesinleşmiş son saat" kuralı gerekli (ör. `ingested_at ≥ saat sonu + X dk`, değilse bir önceki saat). Aşama 2'de karar.
  - v0 eşleştirmesi geçici: %82,4 konumlu üretim, yanlış pozitif örneği "KARAKAYA HES TRABZON" → Diyarbakır.
  - Örnek export yerel `data/raw/` (git dışı) dosyalarına bağlı. dbt sonrası export mart'lardan okuyacak.
  - eptr2 hata türlerini ayırmıyor, tekrar deneme kararı mesaj metnine bakıyor (kırılgan).
  - Ham kolonlar NULL olabiliyor, `not_null` kontrolü dbt testlerinde yapılacak.
- Sıradaki: Kullanıcı frontend worktree'sini kurup Antigravity'yi başlatacak. Sonra "Aşama 2'ye geç" komutuyla dbt.

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

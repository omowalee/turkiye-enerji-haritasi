# İlerleme

Her iki araç da oturum sonunda kendi bölümünü günceller. Kısa yaz: ne yapıldı, ne doğrulandı, açık sorular, sıradaki adım.

## Genel durum

- Sürüm: 1
- Tamamlanan: Aşama 0 (keşif), Aşama 1 (veri çekme, 90 gün geçmiş)
- Devam eden: Aşama 2 (dbt) — Claude Code · Aşama 4 iskeleti (örnek veriyle) — Antigravity
- Alınmış kararlar: `AGENTS.md` → "Alınmış ürün kararları"

## Veri tarafı (Claude Code)

- Son güncelleme: 2026-11-08 (Aşama 1 bitti)
- Yapılanlar:
  - `pipeline/epias/extract.py`: 5 EPİAŞ servisi (santral listesi, santral bazlı üretim, kaynak bazlı üretim, PTF, lisanssız üretim).
  - `pipeline/bq` ve `pipeline/jobs`: `epias_raw` tablolarına idempotent yükleme. Tablolar İstanbul yerel tarihine göre (`date_local`) bölümlü, her gün tek seferde yeniden yazılıyor.
  - `geo_raw` dataset'i: GEM 4.131, OSM 1.796, il sınırları 81 satır.
  - Komutlar: saatlik iş `python -m pipeline.jobs.ingest`, geçmiş yükleme `python -m pipeline.jobs.backfill --days 90`, referans verisi `python -m pipeline.jobs.load_reference`.
- Doğrulama:
  - 90 gün (10.08–07.11): `sql/eksik_saatler.sql` 0 eksik saat döndürdü. Santral tablosu 3.676.102 satır, 0 kopya.
  - Santral toplamı = ülke toplamı (dış ticaret hariç).
  - pytest: 25/25 geçiyor.
- Kararlar:
  - Seçenek 1, iki mod: sayaçlar ve kaynak dağılımı canlı (~1 saat gecikme). Harita ve 24 saatlik oynatma en son tam günün santral verisini gösterir, tarih açıkça yazılır.
  - Santral verisi (`rt-gen-bulk`) en erken ertesi gün geliyor (EPİAŞ hata kodu SEF1149). Saatlik iş santral verisini sadece dün için çekiyor.
  - Tazelik testleri: santral verisi 36 saatte uyarı, 48 saatte hata. Kaynak bazlı veri 3 saatte uyarı, 6 saatte hata.
- Açık sorular:
  - Git commit henüz atılmadı.
  - eptr2 hata türlerini ayırmıyor, tekrar deneme kararı mesaj metnine bakıyor (kırılgan).
  - Ham tablolarda tüm kolonlar NULL olabiliyor, `not_null` kontrolü dbt testlerinde yapılmalı.
- Sıradaki: Aşama 2 (dbt). İlk adım `int_plants_matched` ve en büyük 200 santral için `seeds/plant_match_overrides.csv`. `mart_live_snapshot` iki parçaya ayrılacak: canlı ülke verisi ve son tam günün santral verisi.

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

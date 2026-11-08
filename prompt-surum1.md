# Türkiye Enerji Haritası — Sürüm 1 Prompt'u

> **Güncelleme (8 Kasım 2026):** Aşama 0 ve 1 tamamlandı. Bu dosyanın üzerine şu kararlar geçerli; çelişki varsa `AGENTS.md` ve `docs/kararlar.md` kazanır:
> - Frontend'i (Aşama 4) Antigravity (Gemini 4 Argon) yazar, `a-frontend` worktree'sinde. Claude Code veri tarafındadır.
> - Santral bazlı veri en erken ertesi gün gelir; kaynak bazlı ülke verisi ~1 saat gecikmelidir. Panel iki modludur (canlı / oynatma).
> - Sadece lisanslı üretim gösterilir; lisanssız güneş için gecikme etiketli not. Tahmin yok.
> - Tazelik: kaynak bazlı 3 sa uyarı / 6 sa hata; santral bazlı 36 sa uyarı / 48 sa hata.
> - Sözleşme: `contracts/*.schema.json` + üretilmiş TypeScript tipleri + gerçek veriden örnek JSON (`frontend/public/data/sample/`).

## Bağlam

Türkiye'deki elektrik santrallerinin saatlik üretimini harita üzerinde gösteren, saatte bir otomatik güncellenen bir veri ürünü geliştiriyoruz. Bu proje portfolyomda yer alacak ve Instagram'da video olarak paylaşacağım. Bu yüzden hem veri tarafı (pipeline, dbt, testler) hem de görsel taraf (panel) sağlam olmalı.

Bu repo yeni ve bağımsız bir proje. Daha önce Alaçatı hava durumu projesinde Airflow + BigQuery + dbt kullandım. Aynı yaklaşımı burada da kullanacağız. Her şey benim bilgisayarımda (Windows) çalışacak.

## Sürüm 1'in hedefi

**"Türkiye'nin elektriği şu an nerede, hangi kaynaktan üretiliyor?"** sorusunu cevaplayan, koyu temalı, etkileyici bir harita paneli.

## Kapsam

**Bu sürümde var:**
- EPİAŞ Şeffaflık Platformu'ndan santral bazlı saatlik üretim, santral listesi ve saatlik piyasa fiyatı (PTF)
- Santrallerin koordinatları ve bulundukları il
- dbt ile dönüşüm ve testler
- React paneli: harita, 3D sütunlar, 24 saatlik oynatma, sayaçlar, kaynak dağılımı grafiği, il paneli
- Saatlik çalışan bir Airflow DAG'ı

**Bu sürümde yok (sonraki sürümlere kalıyor, şimdi yapma):**
- Boşa giden enerji (kısıntı) tahmini
- Sanal türbin ve panel potansiyeli
- Fiyat tahmini, makine öğrenmesi
- Kafka ve Spark. Saatlik batch işi için gerekmiyorlar, kullanma.

## Mimari

```
EPİAŞ API ──(Python + eptr2, Airflow saatlik)──► BigQuery: epias_raw
                                                     │
                                            dbt Core (staging → intermediate → marts)
                                                     │
                                            BigQuery: epias_marts
                                                     │
                                  (Airflow) mart tabloları → küçük JSON dosyaları
                                                     │
                                  React statik sitesi JSON'ları okur
```

- BigQuery kimlik bilgileri asla tarayıcıya gitmeyecek. Site sadece dışa aktarılmış JSON'ları okuyacak.
- EPİAŞ kullanıcı adı, şifre ve GCP bilgileri `.env` dosyasında tutulacak. `.env` dosyası `.gitignore`'da olacak, repoda `.env.example` bulunacak.
- dbt Core kullanılacak, dbt Cloud değil. Airflow, veriyi çektikten sonra `dbt build` komutunu tetikleyecek.

## Çalışma şekli

- Aşamalar halinde ilerle. **Her aşamanın sonunda dur, ne yaptığını ve doğrulama sonucunu bana özetle, onayımı bekle.**
- Emin olmadığın bir konuda varsayım yapma, sor. Birden fazla makul yol varsa seçenekleri artı ve eksileriyle sun.
- Proje klasöründeki `.claude/agents` altındaki ajanları uygun işlerde kullan. Veri hattı için `data-engineer`, Python kodu için `python-pro`.
- Tasarım ve arayüz işlerinde `ui-ux-pro-max`, `ui-styling` ve `design-system` skill'lerini kullan.

---

## Aşama 0 — Keşif (kod altyapısı yok, sadece deneme scriptleri)

1. `eptr2` ile EPİAŞ'a bağlan ve şu servisleri dene: santral listesi (`pp-list`), santral bazlı gerçek zamanlı üretim (`rt-gen-bulk` veya uygun eşdeğeri), kaynak bazlı toplam üretim (`rt-gen`), PTF (`mcp`).
   - Her servis için alanları, satır sayısını ve örnek veriyi çıkar.
   - **Verinin kaç saat gecikmeyle yayınlandığını ölç.** Panelin ne kadar "canlı" olabileceğini bu belirleyecek.
   - Santral bazlı üretimin kaç santrali kapsadığını, bunların toplamının ülke toplamının yüzde kaçını oluşturduğunu hesapla.
2. **Santral koordinatları için kaynak araştır.** EPİAŞ koordinat vermiyor. Adaylar: Global Energy Monitor santral veri tabanı, OpenStreetMap santral kayıtları ve bulursan başka açık kaynaklar. Her kaynak için Türkiye kapsamını, lisansını ve EPİAŞ santral adlarıyla eşleştirilebilirliğini değerlendir.
3. İl sınırları için açık lisanslı bir GeoJSON kaynağı bul.
4. Sonuçları `docs/kesif.md` dosyasına yaz: servisler, gecikme, kapsam, koordinat kaynağı önerisi ve **riskler**.

**Doğrulama:** `docs/kesif.md` dosyası var ve yukarıdaki her soruya sayılarla cevap veriyor. **Burada dur ve onayımı bekle.**

## Aşama 1 — Veri çekme ve ham katman

- Python modülleri: santral listesi, saatlik santral üretimi, kaynak bazlı toplam üretim, PTF.
- BigQuery `epias_raw` dataset'ine yazma. İşlemler idempotent olmalı: aynı saati iki kez çekmek tabloda tekrar eden kayıt üretmemeli.
- **Geçmiş veri yükleme:** Son 90 gün. Gün gün çek, API limitlerine dikkat et, hata olursa kaldığı yerden devam edebilsin.
- Santral koordinatları için Aşama 0'da seçilen kaynak `seeds/` altına ya da ayrı bir ham tabloya yüklensin.

**Doğrulama:** 90 günün her saati için veri var. Eksik saatleri listeleyen bir kontrol sorgusu çalıştır ve sonucunu göster.

## Aşama 2 — dbt modelleri

Önerilen yapı (gerekirse gerekçesiyle değiştirebilirsin):

- **staging:** `stg_epias__realtime_generation`, `stg_epias__power_plants`, `stg_epias__market_clearing_price`, `stg_plant_locations`
- **intermediate:**
  - `int_plants_matched`: EPİAŞ santralleri ile koordinatların eşleşmesi. İsimler birebir tutmayacak. Normalizasyon (büyük harf, "RES/GES/HES/DGKÇS" gibi ekler, Türkçe karakterler) + bulanık eşleştirme + elle düzeltme için bir seed dosyası (`seeds/plant_match_overrides.csv`) kullan. Her eşleşmenin bir güven skoru olsun.
  - `int_generation_enriched`: üretim + santral bilgisi + koordinat + il + kaynak türü
- **marts:**
  - `fct_generation_hourly`: saat × santral
  - `agg_generation_by_source_hourly`: kaynak bazında saatlik toplam ve yüzde
  - `agg_generation_by_province_hourly`: il bazında saatlik üretim ve kaynak dağılımı
  - `mart_live_snapshot`: en son saat için panelin "şu an" verisi

**Kaynak türleri ve renkleri** (bütün projede aynı kalacak): güneş, rüzgâr, hidro (barajlı ve akarsu ayrı ama aynı renk ailesinde), doğalgaz, ithal kömür, linyit/yerli kömür, jeotermal, biyokütle, nükleer, diğer.

**Akkuyu eşdeğeri:** `kaynak_üretimi_MW / 1200`. Bir Akkuyu ünitesinin kurulu gücü 1.200 MW. Akkuyu henüz üretime başlamamış olabilir, nükleer kategorisi veride görünmüyorsa panel hata vermemeli.

**Testler:**
- Anahtar alanlarda `unique` ve `not_null`
- Eşleşmeyen santrallerin üretim payı yüzde X'in altında olmalı (eşiği Aşama 0 sonuçlarına göre birlikte belirleyelim)
- Her saat için kaynak paylarının toplamı yüzde 100 (± tolerans)
- Santral bazlı toplamın ülke toplamıyla tutarlılığı (± tolerans)
- Tazelik testleri: kaynak bazlı veri 3 saatte uyarı / 6 saatte hata; santral bazlı veri 36 saatte uyarı / 48 saatte hata

**Doğrulama:** `dbt build` hatasız ve bütün testler geçiyor. Eşleşme oranını ve eşleşmeyen en büyük 20 santrali raporla.

## Aşama 3 — JSON dışa aktarma

Mart tablolarından sitenin okuyacağı küçük dosyalar üret. Sözleşme:

- `snapshot_latest.json`: iki ayrı blok, her birinin kendi zaman damgasıyla:
  - `live`: kaynak bazlı ülke verisinin en son saati — toplam MW (lisanslı), yenilenebilir yüzdesi, kaynak bazında MW ve Akkuyu eşdeğeri, PTF
  - `plants_day`: santral verisinin en son tam günü (tarih) — haritanın canlı modda gösterdiği gün ve son saat
  - lisanssız güneş bilgi notu: son yayımlanan ayın değeri ve hangi aya ait olduğu
- `plants.json`: santral id, ad, kaynak türü, koordinat, il, kurulu güç (statik, günde bir güncellenir)
- `generation_24h.json`: santral verisinin en son tam günü (24 saat), saat × santral üretimi (kompakt formatta). Oynatma modu bunu kullanır.
- `mix_24h.json`: iki seri — `live` (son 24 saat, canlı grafik için) ve `plants_day` (oynatma günü için, haritayla aynı gün)
- `provinces_24h.json`: santral verisinin en son tam günü, il bazında saatlik toplamlar, kaynak dağılımı ve Türkiye içindeki sıra
- `provinces.geojson`: sadeleştirilmiş il sınırları

Dosya boyutlarını küçük tut. Telefonda hızlı açılmalı. Toplam boyutu raporla.

Her dosya için `contracts/` altında JSON Schema olmalı; dışa aktarma yazmadan önce şemayla doğrular. Şemalardan `frontend/src/types/` altına TypeScript tipleri üretilir.

**Doğrulama:** Dosyalar üretiliyor, şemaları belgelenmiş (`docs/data-contract.md`) ve toplam boyut makul.

## Aşama 4 — React paneli (Antigravity yazar)

**Teknoloji:** Vite + React + TypeScript, deck.gl + MapLibre GL (ücretsiz, koyu bir altlık harita), Tailwind + shadcn/ui, grafik için Recharts ya da ECharts. Gerekçesini belirterek farklı bir seçim önerebilirsin.

**Önce sahte veriyle başla.** Aşama 3'teki sözleşmeye uyan mock JSON'larla arayüzü kur, sonra gerçek veriye bağla.

**Tasarım: "Kontrol odası" teması**
- Koyu arka plan, Türkiye haritası ortada.
- Santraller kaynak rengine göre parlayan noktalar: güneş sarı, rüzgâr camgöbeği, hidro mavi, gaz turuncu, kömür gri, nükleer mor. Diğer kaynaklar için uyumlu renkler seç. Renk paletini `ui-ux-pro-max` ile doğrula. Koyu zeminde okunurluk ve renk körlüğü dostu olmasına dikkat et.

**Bileşenler**
1. **Harita + 3D sütunlar:** Her santralin üzerinde o saatteki üretimine göre yükselen bir sütun. Harita eğilip döndürülebilmeli. Santrale tıklayınca ad, kaynak, kurulu güç ve şu anki üretim görünmeli.
2. **24 saatlik oynatma:** Altta bir zaman çubuğu. Oynat'a basınca son 24 saat akıcı şekilde akar, sütunlar ve renkler saat saat değişir. Hız ayarı ve duraklatma olsun. Bu sahneyi Instagram videosu için ekran kaydıyla çekeceğim, akıcı ve sinematik görünmeli.
3. **Büyük canlı sayaçlar (üstte):** "Şu an: 42.300 MW · yüzde 58 yenilenebilir · 2,3 Akkuyu rüzgâr · 1,8 Akkuyu güneş" gibi. Değerler değişirken sayılar yuvarlanarak güncellenmeli. Verinin hangi saate ait olduğu açıkça yazmalı.
4. **Kaynak dağılımı şeridi:** Son 24 saatin üst üste yığılmış alan grafiği. Oynatma sırasında grafikte o anki saat işaretli olmalı.
5. **İl paneli:** Bir ile tıklayınca yandan bir panel açılır: o ilin santralleri, kaynak dağılımı, Türkiye içindeki üretim sırası.
6. **Mobil uyum:** Telefonda düzgün çalışmalı. Mobilde 3D eğim varsayılan olarak kapalı olabilir, il paneli alttan açılan bir sayfa olsun, sayaçlar alt alta dizilsin. 60 fps hedefle, düşük donanımlı telefonlarda da akıcı olsun.

**Genel:** Arayüz Türkçe. Sayılar Türkçe formatta (binlik ayracı nokta, ondalık virgül). Yükleniyor ve veri yok durumları tasarlanmış olmalı.

**Doğrulama:** Masaüstü ve mobil görünümün ekran görüntüleri. Lighthouse performans puanı. Oynatmanın akıcılığı.

## Aşama 5 — Otomasyon

- Saatlik Airflow DAG'ı: veri çek → `dbt build` → JSON üret → siteye yayınla.
- Yayınlama hedefi olarak seçenekleri sun (GitHub Pages, Vercel vb.), birlikte seçelim.
- Hata durumunda son başarılı veri sitede kalmalı ve panel verinin ne kadar eski olduğunu göstermeli.
- Bilgisayarım kapalıyken kaçırılan saatler, bilgisayar açıldığında otomatik olarak tamamlanmalı.

**Doğrulama:** DAG üst üste 3 saat başarıyla çalışmış, site güncellenmiş.

## Aşama 6 — README

- Proje amacı, mimari şema, veri kaynakları ve lisansları, dbt model yapısı (lineage), kurulum adımları, ekran görüntüleri ve GIF.
- Bilinen sınırlamalar: veri gecikmesi, eşleşmeyen santraller, santral bazlı verinin kapsamı.

---

## Başarı kriterleri (Sürüm 1 bitti sayılır, eğer)

- [ ] Panel herkese açık bir adreste yayında ve saatte bir kendiliğinden güncelleniyor
- [ ] Ülke üretiminin büyük kısmı haritada konumlu santrallerle gösteriliyor (oranı keşif sonrası birlikte belirleyelim)
- [ ] `dbt build` bütün testleriyle geçiyor
- [ ] 24 saatlik oynatma masaüstünde ve telefonda akıcı çalışıyor
- [ ] README, projeyi bilmeyen birinin kurup çalıştırabileceği kadar net

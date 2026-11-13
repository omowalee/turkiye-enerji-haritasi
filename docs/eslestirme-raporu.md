# Santral ↔ konum eşleştirme raporu

Tarih: 2026-11-08 · Pencere: son 30 tam gün (09.10.2026–07.11.2026 İstanbul günleri, 24 saati tam), lisanslı üretim.
Modeller: `int_plant_profile` → `scripts/match_plants.py` → `plant_match_candidates` (üretilmiş seed) + `plant_match_overrides` (elle) → `int_plants_matched`.

## 1. Yöntem

1. **Profil (`int_plant_profile`)**: santral başına 30 günlük MWh, en yüksek saatlik MW, baskın `source_type` ve yakıt ailesi (`seeds/source_type_families.csv`). EPİAŞ listesindeki 1.835 santralin hepsi var; 287'sinin pencerede üretimi yok.
2. **Bulanık aday (`scripts/match_plants.py`)**, aynı aile içinde, GEM ve OSM için ayrı ayrı en iyi aday:
   - Normalizasyon: büyük harf, Türkçe karakter katlama, noktalama atma, bitişik rakam ayırma (`ZETES2` → `ZETES 2`), Roma rakamı (`II` → `2`), tür/şirket eki kelimeleri atma (HES, RES, DGKÇ, SANTRALİ, A.Ş., power station …), küçük kısaltma listesi (TUTES → TUNÇBİLEK, İSDEMİR, ERDEMİR).
   - Puan = max(`token_set_ratio`, boşluksuz `ratio`). İkincisi `KAVŞAKBENDİ` ↔ `Kavşak Bendi` gibi bitişik yazımları yakalar.
   - Cezalar: ortak kelimeler yalnızca il adı, numara ya da tek harfse en çok 70 puan. Ünite numarası çelişirse -5. EPİAŞ adında il adı geçiyor ve aday o ilin 25 km dışındaysa -30. Aday kapasitesi biliniyorsa ve en yüksek saatlik üretim kapasitenin 1,3 katını aşıyorsa -15.
   - Eşitlik bozma sırası: ad tam aynı → ünite numarası uyumlu → il ipucu uyumlu → kapasite yakın → GEM.
   - Konum paylaşımı: bir konumu birden çok santral alırsa yalnızca adı ünite ekleri dışında neredeyse aynı olanlar (`fuzz.ratio` ≥ 90) kalır. Diğerleri öbür kaynaktaki adaylarına düşer. Elle düzeltmelerin konumları önceliklidir.
   - Ailesi NULL olan (30 günde üretimi olmayan) santraller eşleştirilmez. Aile kanıtı olmadan alt küme adlar yanlış pozitif üretiyordu (SARAY BİSKÜVİ → Saray RES).
   - Çıktı deterministiktir: aynı girdiyle iki çalıştırma bayt bayt aynı dosyayı üretti.
3. **Eşik**: `int_plants_matched`, `var('match_min_score')` = 90 ile uygular.
4. **Elle düzeltme (`seeds/plant_match_overrides.csv`)** her zaman kazanır. Koordinatlar yalnızca var olan GEM/OSM kayıtlarından gelir. Doğru kayıt yoksa `no_match` kullanılır.
5. **İl**: koordinat il poligonundaysa o il, değilse (kıyı) 10 km içindeki en yakın il. Konumlu 758 santralin hepsine il atandı.

## 2. Kapsam

Ülke toplamı = 30 günlük lisanslı santral üretimi (25,5 TWh). "Konumlu" = `is_located`.

| | Düzeltme öncesi (yalnız bulanık, eşik 90) | Düzeltme sonrası |
|---|---|---|
| Konumlu santral (üretimi olan 1.548 santralden) | 730 | 758 |
| Konumlu üretim payı | %85,98 | **%91,74** |
| Konumsuz üretim payı (test eşiği %15, hedef %10) | %14,02 | **%8,26** |
| İlk 200 santral: konumlu sayı | 165 / 200 | 190 / 200 |
| İlk 200 santral: konumlu üretim payı (ilk 200 = ülkenin %80,1'i) | %91,38 | **%98,44** |

Konumsuz pay %10 hedefinin altında. `max_unmatched_generation_share` hâlâ 0,15. Eşiği değiştirmek kullanıcının kararı.

Son durumda eşleşme yöntemine göre dağılım (üretim payı): bulanık 724 santral (%85,31), elle 34 santral (%6,43), konumsuz 1.077 santral (%8,26; 287'si üretimsiz).

### Aile bazında (üretimi olan santraller)

| Aile | Ülke üretimindeki payı | Santral | Önce: konumlu santral / üretim | Sonra: konumlu santral / üretim |
|---|---|---|---|---|
| Kömür | %36,6 | 46 | 35 / %97,9 | 36 / %98,8 |
| Hidro | %29,3 | 678 | 256 / %90,4 | 257 / %91,2 |
| Doğalgaz | %13,8 | 116 | 25 / %70,2 | 30 / %92,1 |
| Rüzgâr | %11,8 | 311 | 228 / %71,1 | 237 / %79,2 |
| Jeotermal | %3,5 | 65 | 56 / %80,4 | 62 / %97,4 |
| Biyo | %2,6 | 221 | 54 / %45,9 | 57 / %56,1 |
| Güneş | %1,7 | 89 | 69 / %79,2 | 70 / %86,1 |
| Diğer (fueloil, nafta, atık ısı) | %0,5 | 22 | 7 / %28,2 | 9 / %67,2 |

En zayıf aile rüzgâr ve biyo. Birçok RES ve çöp gazı tesisinin GEM/OSM'de kaydı yok ya da kaydın adı EPİAŞ adından tamamen farklı.

### Kesinlik kontrolü

İlk 200 dışında kabul edilen 560 bulanık eşleşmeden rastgele 40 tanesi gözle incelendi. 37'si açıkça doğru. 3'ü aynı tesis grubunun ya da aynı nehrin kardeş ünitesine düşüyor: GREENECO JES 6 → Sarayköy 7, KARASU2 HES → Karasu 5, SEFERİHİSAR ÜÇGEN RES → Seferihisar RES. Bu örnekte açık bir yanlış pozitif görülmedi.

## 3. Elle düzeltmeler (46 satır)

| Tür | Sayı | Santraller |
|---|---|---|
| `match`: eşleşmesiz santrale konum ekler | 28 | RWE DENİZLİ, KIRIKKALE DGKÇ, İZMİR DGKÇ, ADA DGKÇS, ENTEK KÖSEKÖY, O.ANADOLU RAFİNERİ, TÜPRAŞ İZMİT, TÜPRAŞ İZMİR, ERDEMİR, UYGAR, EVRENCİK, SOĞANLI, AİRRES-4, SİLİVRİ, KURTKAYASI, HASANOBA, MERSİN RES, EFE / EFE6 / EFE7 / EFE8 JES, NEZİHE BEREN JES, KEN KİPAŞ JES, ITC ANTALYA BİYOKÜTLE, İSTAÇ BES, KARAPINAR YEKA-1 GES, AFYON1 BİYOGAZ, ARDAHAN AKINCI HES |
| `match`: kabul edilmiş yanlış eşleşmeyi düzeltir | 1 | MAREN JES (Nezihe Beren → "Maren maraş" adını taşıyan Mehmet kaydı) |
| `match`: doğru eşleşmeyi sabitler / aynı sahayı tutarlı yapar | 5 | BANDIRMA3 RES, KARAPINAR YEKA-1 MEKE GES, G24-KARAPINAR GES, KEN-3 JES, MEHMETHAN JES |
| `no_match`: doğru kayıt yok | 11 | İSDEMİR, LODOS, GÜLPINAR, KESTANEDERESİ, ELMACIK, ERCİYES, R3-MALATYA-1, PELİT, HAYAT KİMYA, ETİ BAKIR MAZIDAĞI, KARAKAYA HES TRABZON |
| `no_match`: kabul edilmiş yanlış eşleşmeyi kaldırır | 1 | PİRİNÇLİ HES |

Kapasite uyarısı alan wind farm düzeltmelerinin (UYGAR, EVRENCİK, SOĞANLI, AİRRES-4, SİLİVRİ, KURTKAYASI, HASANOBA) adları kayıtla tam aynı. Uyarının nedeni GEM/OSM kapasitesinin eski olması (genişlemeler kayda girmemiş).

### Bilinen yanlış pozitiflerin durumu

| Santral | Prototip | Şimdi |
|---|---|---|
| KARAKAYA HES TRABZON | GEM Karakaya (Diyarbakır) | `no_match`. Büyük Karakaya barajını gerçek KARAKAYA HES DİYARBAKIR tutuyor. Trabzon santrali için kayıt yok. |
| BANDIRMA3 RES | Kandıra | `match` → GEM "Bandirma-3 (Bursa) wind farm" (Balıkesir). Bulanık eşleşme de artık bunu buluyor. |
| PİRİNÇLİ HES | Hirfanlı | `no_match`. Bulanık aday "Pirinçlik HES" ayrı bir EPİAŞ santraline (PİRİNÇLİK HES) ait. |
| AFYON1 BİYOGAZ | Eber | `match` → GEM "Afyon-1 Biyogaz Santrali solar project" (aşağıda, emin olunmayanlar listesinde) |

## 4. Hâlâ konumsuz en büyük 20 santral

| # (MWh sırası) | Santral | Aile | 30 gün MWh | Ülke payı | Neden |
|---|---|---|---|---|---|
| 65 | İSDEMİR | kömür | 72.101 | %0,28 | GEM/OSM'de İskenderun Demir Çelik kaydı yok (`no_match`) |
| 84 | LODOS RES | rüzgâr | 49.300 | %0,19 | Kayıt yok (`no_match`) |
| 99 | GÜLPINAR RES | rüzgâr | 38.470 | %0,15 | Kayıt yok. "Gülpir" (34 MW) kapasiteyle uyumsuz (`no_match`) |
| 131 | KESTANEDERESİ RES | rüzgâr | 26.701 | %0,10 | Kayıt yok (`no_match`) |
| 140 | ETİ BAKIR MAZIDAĞI TES | gaz | 25.535 | %0,10 | Tesis kaydı yok. "Eti Bakır 2 GES" yaklaşık 14 km uzakta, vekil olarak kullanılmadı (`no_match`) |
| 148 | ELMACIK RES | rüzgâr | 23.913 | %0,09 | Kayıt yok (`no_match`) |
| 157 | ERCİYES RES | rüzgâr | 22.244 | %0,09 | Kayıt yok (`no_match`) |
| 167 | R3-MALATYA-1 RES | rüzgâr | 21.060 | %0,08 | Kayıt yok (`no_match`) |
| 170 | HAYAT KİMYA | gaz | 20.531 | %0,08 | Kayıt yok (`no_match`) |
| 189 | PELİT RES | rüzgâr | 18.256 | %0,07 | Kayıt yok. Aday "Cerit" yanlış (`no_match`) |
| 201 | R3-KARAMAN-1 RES | rüzgâr | 17.747 | %0,07 | Aday "Karaman wind farm" 85 puan (kapasite 46,8 MW < 68 MW). Kimlik belirsiz. |
| 210 | ARTURNA RES | rüzgâr | 16.960 | %0,07 | Kayıt bulunamadı (en iyi aday 62,5) |
| 212 | ZONGULDAK RES | rüzgâr | 16.785 | %0,07 | GEM "Zonguldak wind farm" Sakarya'da (il cezası). Doğrulanamadı. |
| 222 | IHLAMUR RES | rüzgâr | 15.653 | %0,06 | Kayıt bulunamadı |
| 225 | MURAT HES ADIYAMAN | hidro | 15.523 | %0,06 | Kayıt bulunamadı |
| 234 | ŞULE RES | rüzgâr | 14.879 | %0,06 | Aday "Sile wind farm" (Şile ≠ Şule), 75 puan |
| 236 | ARMUTÇUK RES | rüzgâr | 14.840 | %0,06 | Kayıt bulunamadı |
| 242 | HACIHIDIRLAR RES | rüzgâr | 14.196 | %0,06 | Kayıt bulunamadı |
| 246 | MASLAKTEPE RES | rüzgâr | 13.772 | %0,05 | Ad tam aynı ama GEM kapasitesi 23 MW, üretim 79 MW. Kapasite cezası. Kontrol edilmeli. |
| 257 | OVACIK RES ÇANAKKALE | rüzgâr | 13.392 | %0,05 | Muhtemel kayıt: GEM "Ovacik wind farm (Enerjisa Üretim)" (Çanakkale, 55 MW). Ad farkı yüzünden 58 puan. Sonraki düzeltme adayı. |

## 5. Emin olunmayan düzeltmeler (kontrol önerilir)

| Santral | Düzeltme | Neden emin değilim |
|---|---|---|
| TÜPRAŞ İZMİT | GEM L100001077552 "Izmit Rafinerisi Santrali solar project" | Rafinerinin santral kaydı yok. Aynı sahadaki hibrit güneş kaydı konum vekili olarak kullanıldı. Konum doğru saha, ama kayıt kapasitesi (5,7 MW) santrali temsil etmiyor. |
| TÜPRAŞ İZMİR | GEM L100001077551 "Aliaga Rafinerisi Santrali solar project" | Aynı durum (kapasite 1,2 MW). |
| ERDEMİR | GEM L100000407676 "Karadeniz Ereğli Zonguldak power station" (gaz, 191 MW) | Koordinat Ereğli çelik fabrikasının yerinde. Kayıt adı Erdemir'i anmıyor. |
| AFYON1 BİYOGAZ | GEM L100000831205 "Afyon-1 Biyogaz Santrali solar project" | GEM bu kaydı güneş olarak sınıflıyor. Ad biyogaz tesisinin adı. Konum tesis olmalı, ama kesin değil. |
| MAREN JES + MEHMETHAN JES | GEM L100001045039 "Mehmet" (diğer adları "Maren maraş, Mehmet Han") | İki santral aynı kayıtta. Kayıt kapasitesi (24,8 MW) ikisinin toplamından küçük. |
| EFE JES, EFE6, EFE7, EFE8 JES | GEM L100000700046 "Efeler geothermal power plant" | Gürmat'ın Germencik kompleksi. Ünitelerin ayrı konumu bilinmiyor, hepsi tek noktada. |
| ADA DGKÇS | GEM L100000405907 "Enka Adapazarı power station" | "ADA = Adapazarı" çıkarımı. Kapasite tutarlı (820 MW ve EPİAŞ max 813 MW). |
| MERSİN RES | GEM L100000921633 "Mersin Mut wind farm" (Mut Ağaoğlu) | EPİAŞ'ta ayrı bir MUT RES de var (OSM'deki 50 MW'lık kayda eşleşti). Ad çıkarımı. |
| İSTAÇ BES | OSM relation/20385825 "Odayeri Atık Bertaraf Tesisi" | İSTAÇ'ın Kemerburgaz yakma tesisi de 1-2 km yakında. EPİAŞ'ta ayrıca üretimsiz ODAYERİ BES var. |
| GEBZE DGKÇ (bulanık, düzeltme yok) | GEM "Enka Gebze power station" | Hem GEM hem OSM bu santrali Adapazarı sahasında (Sakarya) gösteriyor. Veri kaynaklarına uyuldu. |
| REŞADİYE HES (bulanık) | OSM "Reşadiye-2 HES" | EPİAŞ'ta numarasız tek santral var. Aynı kademenin başka ünitesine düşmüş olabilir. |

## 6. Testler (`dbt build --select int_plant_profile+ …`)

PASS=42, WARN=2, ERROR=0.

- `assert_unmatched_generation_share`: geçti. Pay %8,26, eşik 0,15.
- `assert_override_locations_exist`: geçti. 34 `match` satırının hepsinin kaydı var. `no_match` satırlarının konum alanları boş.
- `warn_capacity_implausible`: 10 satır, hepsi bilinçli düzeltme. 7 wind farm'da GEM/OSM kapasitesi eski. Diğerleri TÜPRAŞ İZMİT/İZMİR (vekil kayıt) ve MAREN JES.
- `warn_shared_location_dissimilar_names`: 5 satır, hepsi bilinçli düzeltme. Karapınar YEKA üçlüsü, KEN KİPAŞ / KEN-3, MAREN / MEHMETHAN.

## 7. Açık konular

- `installed_capacity_mw` konum kaydının kapasitesidir. Paylaşılan konumlarda (ZETES 1-3: 2.790 MW, Karapınar: 1.350 MW) tesis toplamını, vekil kayıtlarda (TÜPRAŞ) alakasız bir değeri gösterir. Mart'ta santral kapasitesi olarak gösterilmeden önce karar gerekir.
- Bulanık eşleştirme `int_plant_profile` değiştikçe (yeni santral, aile değişimi) yeniden çalıştırılmalı: `python -m scripts.match_plants` → `dbt build --select plant_match_candidates+`. Bu adım henüz Airflow'a bağlı değil.

## 8. Uyarı listesi (2026-11-13)

`dbt build --select plant_match_candidates+ int_plant_profile+` (lookback 192 sa): PASS=90, WARN=2, ERROR=0. İki uyarı testinin satırları aşağıda. Hepsi elle düzeltme (`override`). Düzeltme yapılmadı, yalnızca listelendi.

### `warn_capacity_implausible` (10 satır)

30 günün en yüksek saatlik üretimi, konum kaydının kurulu gücünün 1,3 katını aşıyor.

| plant_id | Santral | Kaynak · konum | Kurulu güç (MW) | En yüksek saatlik (MW) | Oran |
|---|---|---|---|---|---|
| 867 | TÜPRAŞ İZMİT | gem · L100001077552 | 5,7 | 147,5 | 25,9 |
| 2421 | TÜPRAŞ İZMİR | gem · L100001077551 | 1,2 | 55,5 | 46,3 |
| 2159 | AİRRES-4 | gem · L100000921428 | 61,0 | 132,1 | 2,2 |
| 1760 | SİLİVRİ RES | osm · relation/14577635 | 63,0 | 113,0 | 1,8 |
| 1473 | MAREN JES | gem · L100001045039 | 24,8 | 40,0 | 1,6 |
| 2711 | SOĞANLI RES | osm · relation/17564704 | 61,5 | 99,1 | 1,6 |
| 3132 | UYGAR RES | gem · L100000921721 | 163,0 | 247,7 | 1,5 |
| 2448 | HASANOBA RES | gem · L100000921566 | 51,0 | 75,1 | 1,5 |
| 2030 | KURTKAYASI RES | gem · L100000921621 | 46,0 | 68,3 | 1,5 |
| 2588 | EVRENCİK RES | gem · L100000921528 | 120,0 | 170,1 | 1,4 |

### `warn_shared_location_dissimilar_names` (5 satır)

Aynı konumu kullanan ve adları ünite ekleri dışında benzemeyen santral çiftleri.

| Kaynak · konum | Santral A | Santral B |
|---|---|---|
| gem · L100001045001 | 1927 KEN KİPAŞ JES | 2126 KEN-3 JES |
| gem · L100001045039 | 1473 MAREN JES | 2127 MEHMETHAN JES |
| gem · L100000831378 | 2579 KARAPINAR YEKA-1 GES | 3214 G24-KARAPINAR GES |
| gem · L100000831378 | 2579 KARAPINAR YEKA-1 GES | 2798 KARAPINAR YEKA-1 MEKE GES |
| gem · L100000831378 | 2798 KARAPINAR YEKA-1 MEKE GES | 3214 G24-KARAPINAR GES |

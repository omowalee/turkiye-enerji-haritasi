# Aşama 0 — Keşif Raporu

Tarih: 2026-11-08 · Ölçüm günü (santral bazlı): 2026-11-06 · eptr2 1.4.0

Scriptler: `scratch/kesif_epias.py`, `scratch/kesif_kapsam.py`, `scratch/kesif_eslesme.py`. Ham çıktılar `scratch/output/` altında (git dışı).

## Özet

| Soru | Cevap |
|---|---|
| Veri ne kadar canlı? | Gerçek zamanlı üretim (`rt-gen`), saat bittikten **yaklaşık 40 dakika sonra** yayınlanıyor. Saat 10:41'de son veri 09:00–10:00 saatine aitti. Panel en iyi ihtimalle **1–2 saat geriden** gelir. **Düzeltme (Aşama 1):** Bu gecikme yalnızca kaynak bazlı ülke toplamı için geçerli. **Santral bazlı veri (`rt-gen-bulk`) en erken ertesi gün** sorgulanabiliyor (EPİAŞ hata kodu SEF1149: "En son bir gün öncesine ait santral üretim verileri görüntülenebilir"). |
| Santral bazlı veri ülke toplamının yüzde kaçı? | **%100,00.** Dış ticaret hariç `rt-gen` toplamı, santral bazlı toplamla her kaynakta birebir aynı: 946.135 MWh. |
| Kaç santral? | Listede 1.835 santral var. 1.688'i veri döndü, 1.433'ünün üretimi sıfırdan büyük. |
| En büyük riskler | (1) **Lisanssız üretim**, özellikle çatı ve küçük güneş santralleri, gerçek zamanlı veride yok ve yaklaşık 5–6 hafta gecikmeli geliyor. (2) Koordinat eşleşmesi için deterministik anahtar yok. |
| Koordinat kaynağı önerisi | **GEM** (ana kaynak, CC BY 4.0) + **OSM** (yedek, ODbL) + elle düzeltme seed'i. |
| İl sınırları | **geoBoundaries TUR ADM1** (81 il, ISO kodlu, CC BY-SA 2.0, OSM kökenli). |

## 1. EPİAŞ servisleri

| Servis (eptr2) | Uç nokta | Parametre | Satır (örnek) | Süre |
|---|---|---|---|---|
| `pp-list` | `generation/data/powerplant-list` | yok | 1.835 santral | <1 sn |
| `rt-gen` | `generation/data/realtime-generation` | start_date, end_date, (pp_id) | 24 / gün | <1 sn |
| `rt-gen-bulk` | `generation/data/realtime-generation-bulk` | date, pp_ids (50'lik gruplar) | 40.359 / gün (1.688 santral × 24) | **29 sn / gün** (37 istek, hata yok) |
| `mcp` (PTF) | `markets/dam/data/mcp` | start_date, end_date | 24 / gün | <1 sn |
| `ren-ul-gen` (lisanssız) | `renewables/data/unlicensed-generation-amount` | start_date, end_date | 24 / gün | <1 sn |

**Alanlar**

- `pp-list`: `id`, `name` (ör. "3S KALE JES-40W000000012366M"), `eic`, `shortName`. **Koordinat, il, kurulu güç ve lisans numarası yok.**
- `rt-gen` ve `rt-gen-bulk`: `date` (ISO, +03:00), `hour`, `total` ve 16 yakıt kolonu: `naturalGas`, `dammedHydro`, `lignite`, `river`, `importCoal`, `wind`, `sun`, `fueloil`, `geothermal`, `asphaltiteCoal`, `blackCoal`, `biomass`, `naphta`, `lng`, `importExport`, `wasteheat`. `rt-gen-bulk` ayrıca `powerPlantName` alanı içerir ("AD-EIC-ID"). Santral id'si bu alanın son parçasından ayrıştırılıyor.
- `mcp`: `date`, `hour`, `price` (TL/MWh), `priceUsd`, `priceEur`. Gün öncesi piyasa olduğu için ertesi günün fiyatı da önceden hazır.
- **Nükleer kolonu yok.** Akkuyu üretime geçerse EPİAŞ yeni bir kolon ekleyecek. Ham katman bilinmeyen kolonları kaybetmemeli, panel de nükleer olmadan çalışmalı.

**Ayrıntılar**

- `rt-gen` içindeki `total`, `importExport` alanını da içeriyor (günlük ortalama −338 MW). Ülke üretimini hesaplarken `importExport` dışarıda bırakılmalı.
- 124 santralin birden fazla yakıt kolonu dolu (ör. HES'lerde barajlı ve akarsu birlikte, termiklerde yakıt karışımı). Santrale tek bir "kaynak türü" atamak için **baskın yakıt** kullanılabilir. Haritadaki sütun ise yakıt bazında bölünebilir.
- Üretim yoğunlaşması: en büyük 50 santral üretimin %57,9'unu, 100 santral %70,1'ini, 200 santral %80,5'ini, 400 santral %90,4'ünü oluşturuyor.
- 90 günlük geçmiş yükleme tahmini: 90 × 29 sn ≈ **45 dakika** (yalnızca `rt-gen-bulk`).

## 2. Gecikme

| Veri | Gecikme |
|---|---|
| `rt-gen` (kaynak bazlı ülke toplamı) | Saat bittikten yaklaşık 0,7 saat sonra. Ölçümde 10:41'de son saat 09:00'du. |
| `rt-gen-bulk` (santral bazlı) | **Ertesi gün.** Bugünün verisi istenirse SEF1149 hatası dönüyor. Dünün 24 saati sorgulanabiliyor. Bir saatin gecikmesi 1 ile 24+ saat arasında değişiyor. (Aşama 1'de bulundu.) |
| `mcp` (PTF) | Negatif: ertesi günün fiyatı önceki gün belli. |
| `ren-ul-gen` (lisanssız) | **Aylık.** 8 Kasım itibarıyla son veri 30 Eylül'e ait (5–6 hafta). |

## 3. Kapsam ve lisanssız üretim (en önemli risk)

- Lisanslı (gerçek zamanlı) güneş üretimi 6 Kasım öğlen **1.427 MW**.
- Lisanssız güneş üretimi 1 Eylül öğlen **16.523 MW**.
- Eylül ortalamasıyla lisanssız üretim günde ≈ 112 GWh. Bu, lisanslı üretimin (≈ 946 GWh) yaklaşık **%12'si**. Gündüz saatlerinde güneş nedeniyle bu oran çok daha yüksek.
- Sonuç: Panel yalnızca `rt-gen` kullanırsa "yenilenebilir yüzdesi" ve "Akkuyu güneş" sayaçları **olduğundan belirgin şekilde düşük** görünür. Bu bir tasarım kararı gerektiriyor (bkz. Kararlar 1).
- Lisanssız veri **santral bazlı değil, kaynak bazlı ülke toplamı**. Haritada nokta olarak gösterilemez.

## 4. Koordinat kaynakları

| Kaynak | TR kapsamı (çalışan) | Konum kalitesi | Lisans | EPİAŞ ile eşleşebilirlik |
|---|---|---|---|---|
| **GEM Global Integrated Power Tracker** (Eylül 2026) | 3.294 tesis / 107 GW: güneş 2.657, rüzgâr 276, hidro 159, gaz/petrol 67, kömür 34, jeotermal 44, biyo 58 | %100 koordinat, %97 "exact" | CC BY 4.0 | İngilizce ad + yerel ad + diğer adlar. EİÇ yok. 560 kayıtta EPDK lisans no var ama EPİAŞ'ta karşılığı yok. |
| **OpenStreetMap** (`power=plant`, Overpass) | 1.796 öğe: güneş 801, hidro 538, rüzgâr 188, gaz 64, jeotermal 48, kömür 35 | Poligon merkezi | ODbL (atıf + aynı lisansla paylaş) | 1.283'ünde Türkçe ad var. `ref:EPIAS` etiketi yok. |
| WRI Global Power Plant Database | 163 tesis / 51 GW | iyi | CC BY 4.0 | Veri dondurulmuş (v1.3.0), güncel değil. **Önerilmiyor.** |

**Eşleştirme prototipi** (normalizasyon + `token_set_ratio`, aynı yakıt ailesi içinde, üretim ağırlıklı):

| Eşik | GEM | OSM | GEM ∪ OSM |
|---|---|---|---|
| 95 | 565 santral / %75,7 | 472 / %70,4 | 719 / **%80,3** |
| 90 | 584 / %78,3 | 490 / %72,3 | 734 / **%82,2** |
| 80 | 657 / %82,4 | 566 / %76,0 | 813 / %85,5 |

Aile bazında, eşik 90'da (GEM ∪ OSM) eşleşen üretim payı:

| Aile | Eşleşen üretim | Ülke üretimindeki payı |
|---|---|---|
| Kömür | %84,7 | %33,8 |
| Hidro | %83,6 | %30,2 |
| Rüzgâr | %87,1 | %16,2 |
| Gaz | %73,2 | %13,6 |
| Jeotermal | %73,9 | %3,3 |
| Biyo | %60,9 | %2,4 |
| Güneş | %71,9 | %0,6 |

Gözlemler:

- **Yanlış pozitifler var:** "BANDIRMA3 RES" → "Kandira", "PİRİNÇLİ HES" → "Hirfanli", "AFYON1 BİYOGAZ" → "Eber". `token_set_ratio` tek başına fazla gevşek.
- **Kaçan büyük santraller** çoğunlukla kolay düzeltilebilir: bitişik numaralar (ZETES2, ALPASLAN2, GÖKTAŞ1), kısaltmalar (TUTES, İSDEMİR, ERDEMİR) ve şirket adları (RWE DENİZLİ, CENGİZ 610).
- Üretim çok yoğunlaştığı için en büyük ~200 santrali elle doğrulamak (`seeds/plant_match_overrides.csv`) üretimin yaklaşık %80'ini kesinleştirir. Bulanık eşleşmeyle birlikte **≈ %90 konumlu üretim gerçekçi bir hedef**.
- İl ataması GEM'in il alanından yapılmamalı: alan %79,5 dolu ve "Denizli" / "Denizli Province" gibi 122 tutarsız değer içeriyor. Bunun yerine **koordinat → il poligonu (point-in-polygon)** kullanılmalı.

**Lisans notu:** GEM CC BY 4.0, atıf yeterli. OSM'den türeyen koordinatlar yayınlanan `plants.json` içine girerse, o dosya ODbL kapsamına girer: atıf verilmeli ve dosya aynı lisansla açık kalmalı. Açık bir portfolyo projesi için sorun değil, README'de belirtilecek.

## 5. İl sınırları

| Kaynak | Lisans | Not |
|---|---|---|
| **geoBoundaries TUR ADM1** (önerilen) | CC BY-SA 2.0 (OSM kökenli) | 81 il, `shapeISO` = TR-01…TR-81. Sadeleştirilmiş hâli 1,56 MB. Aşama 3'te mapshaper ile yaklaşık 100–200 KB'a indirilecek. |
| cihadturhan/tr-geojson | ODbL | Alternatif, OSM kökenli |
| HDX Türkiye alt bölgeler | ODbL | Alternatif |

## 6. Riskler

1. **Lisanssız üretim görünmez** (gündüz güneşin büyük kısmı). Kullanıcıya yanlış izlenim verebilir.
2. **Eşleştirme kalitesi:** yanlış pozitif riski, elle düzeltme emeği (yaklaşık 200 satır).
3. **Hidro kapsamı:** GEM'de yalnızca 159 HES var. Küçük HES'ler için OSM'ye bağımlıyız.
4. **Şema değişikliği:** Akkuyu ile nükleer kolon eklenebilir. EPİAŞ alan adlarını değiştirebilir.
5. **API limitleri:** belgelenmemiş. 37 ardışık istekte (0,3 sn arayla) hata görülmedi.
6. **Gerçek zamanlı veri kesinleşmemiş veridir.** Sonradan UEVM (uzlaştırma) değerleriyle değişebilir. Panel için kabul edilebilir.

## 7. Kararlar (2026-11-08 onaylandı, ayrıntı: docs/kararlar.md)

1. **Lisanssız üretim nasıl ele alınsın?**
   - (a) Panel yalnızca lisanslı gerçek zamanlı üretimi gösterir ve bunu açıkça yazar ("lisanslı santraller"). Basit ve dürüst, ama yenilenebilir oranı düşük görünür.
   - (b) Lisanslı üretim haritada gösterilir. Sayaçlarda ayrıca "son yayımlanan ayda lisanssız güneş ≈ X MW" bilgisi gecikme etiketiyle verilir.
   - (c) Lisanssız üretim geçmiş profilden tahmin edilir. Bu bir tahmin işi ve Sürüm 1 kapsamı dışında.
   - Öneri: **(a) + (b)'deki bilgi notu.**
2. **Koordinat kaynağı:** GEM ana kaynak + OSM yedek + elle düzeltme seed'i. Onaylıyor musun?
3. **Eşleşmeyen üretim payı test eşiği:** başlangıç için **< %15**, elle düzeltmelerden sonra **< %10**.
4. **Tazelik testi:** son veri **3 saatten eskiyse uyarı, 6 saatten eskiyse hata**.
5. **İl sınırları:** geoBoundaries (CC BY-SA 2.0). Onaylıyor musun?

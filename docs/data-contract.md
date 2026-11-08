# Veri sözleşmesi — v0 taslağı

> **Durum: v0 (`schema_version: "0.1.0"`), 2026-11-08.** Bu bir taslak. dbt modelleri (Aşama 2) bitince alanlar netleşebilir, eklenebilir veya yeniden adlandırılabilir. Her değişiklik `contracts/` altında kendi commit'iyle yapılır, `schema_version` artırılır ve bu dosyaya not düşülür.

Sitenin okuduğu JSON dosyalarının şekli `contracts/*.schema.json` (JSON Schema 2020-12) dosyalarında tanımlıdır. Bu doküman, şemaların ne anlama geldiğini açıklar. Bir çelişki olursa **şema kazanır**.

## Dosyalar ve üretim

| Dosya | Şema | Ne zaman değişir | Örnek boyut (ham / gzip) |
|---|---|---|---|
| `snapshot_latest.json` | `snapshot_latest.schema.json` | saatlik | 0,8 KB / 0,4 KB |
| `plants.json` | `plants.schema.json` | günlük | 229,6 KB / 28,4 KB |
| `generation_24h.json` | `generation_24h.schema.json` | günlük (santral verisi ertesi gün gelir) | 88,9 KB / 20,4 KB |
| `mix_24h.json` | `mix_24h.schema.json` | saatlik | 4,4 KB / 1,4 KB |
| `provinces_24h.json` | `provinces_24h.schema.json` | günlük | 20,2 KB / 5,9 KB |
| `provinces.geojson` | `provinces.schema.json` | statik | 157,2 KB / 45,8 KB |
| **Toplam** | | | **501 KB / 102 KB** |

- Ortak tanımlar `contracts/common.schema.json` içindedir.
- **TypeScript tipleri:** `cd contracts && npm install && npm run gen:types` komutu `frontend/src/types/*.ts` dosyalarını üretir. Bu dosyalar elle düzenlenmez.
- **Örnek veri:** `.venv/Scripts/python -X utf8 -m scripts.export_sample` komutu BigQuery ham katmanından `frontend/public/data/sample/` klasörünü üretir ve her dosyayı yazmadan önce şemayla doğrular.
- **Yalnızca doğrulama:** `... -m scripts.export_sample --validate-only [--out KLASÖR]`
- v0 örnekleri **dbt'siz** üretildi. Santral eşleştirmesi keşif prototipinden alındı. Bu yüzden konum kapsamı ve kurulu güç geçicidir. Ayrıntı için aşağıdaki "Bilinen sınırlar" bölümüne bakın.

## Ortak kurallar

- **Zaman:** Bütün zaman damgaları ISO 8601 biçiminde ve İstanbul saatiyle (`+03:00`) yazılır. Saatlik değerler **saatin başlangıcını** gösterir: `2026-11-07T23:00:00+03:00`, 23:00–24:00 aralığıdır. Tarihler `YYYY-MM-DD` biçimindedir (yerel gün). Aylar `YYYY-MM` biçimindedir.
- **Birim:** MW, o saatteki ortalama güçtür (= o saatin MWh değeri). Sayılar çoğunlukla tamsayıya yuvarlanır. Yüzdeler bir ondalık hanelidir.
- **Lisanslı üretim:** Bütün üretim değerleri yalnızca lisanslı gerçek zamanlı üretimdir. Dış ticaret (`importExport`) toplamlara dahil değildir.
- Her dosyada (geojson hariç) `schema_version` ve `generated_at` alanları vardır.

### Kaynak türleri (`SourceType`)

Sıra, grafiklerdeki yığılma ve gösterim sırasıdır.

| Anahtar | Türkçe etiket | EPİAŞ kolonları | Yenilenebilir |
|---|---|---|---|
| `gunes` | Güneş | sun | ✓ |
| `ruzgar` | Rüzgâr | wind | ✓ |
| `hidro_baraj` | Hidro (barajlı) | dammedHydro | ✓ |
| `hidro_akarsu` | Hidro (akarsu) | river | ✓ |
| `jeotermal` | Jeotermal | geothermal | ✓ |
| `biyokutle` | Biyokütle | biomass | ✓ |
| `dogalgaz` | Doğalgaz | naturalGas, lng | |
| `ithal_komur` | İthal kömür | importCoal | |
| `yerli_komur` | Linyit / yerli kömür | lignite, blackCoal, asphaltiteCoal | |
| `nukleer` | Nükleer | (henüz yok) | |
| `diger` | Diğer | fueloil, naphta, wasteheat | |

- Kaynak bazlı nesnelerde (`PerSource`, `PerSourceSeries`) **her anahtar opsiyoneldir**. Verisi olmayan ya da tamamen sıfır olan kaynak yazılmaz. Bugün `nukleer` hiç gelmiyor.
- Panel, eksik bir anahtarı 0 kabul etmeli ve hata vermemelidir.
- Renkler AGENTS.md'de tanımlıdır. Hidro baraj ve akarsu aynı renk ailesindendir.

## İki mod ve iki zaman damgası

AGENTS.md'deki karar gereği, ülke verisi ile santral verisi farklı gecikmelerle gelir. Bu yüzden ayrı bloklarda ve kendi zaman damgalarıyla taşınır:

| Blok | Kaynak | Gecikme | Zaman damgası |
|---|---|---|---|
| `live` | kaynak bazlı ülke verisi (`rt-gen`) | ≈ 1 saat | `live.ts` (son saatin başlangıcı) |
| `plants_day` | santral bazlı veri (`rt-gen-bulk`) | en erken ertesi gün | `plants_day.date` (en son **tam** gün) |

- **Canlı mod:** Sayaçlar `snapshot_latest.live` alanından, grafik `mix_24h.live` alanından beslenir. Harita `generation_24h` dosyasının son saatinde durur ve "Santral verisi: [plants_day.date]" etiketini taşır.
- **Oynatma modu:** Sayaçlar ve grafik `mix_24h.plants_day` alanından, harita `generation_24h` dosyasından, il paneli `provinces_24h` dosyasından beslenir. Hepsi aynı gündedir.

Tazelik eşikleri, panelin "veri eski" uyarısı için kullanılır. Hesap `ts` ya da `date` ile o anki saat arasındaki farka göre yapılır:

- Kaynak bazlı veri: 3 saatte uyarı, 6 saatte hata
- Santral bazlı veri: 36 saatte uyarı, 48 saatte hata

## Dosyalar

### `snapshot_latest.json`

Canlı sayaçlar için en son özet.

| Alan | Tip | Açıklama |
|---|---|---|
| `live.ts` | Timestamp | Ülke verisinin en son saati (başlangıç) |
| `live.total_mw` | int | Lisanslı toplam üretim |
| `live.renewable_share_pct` | number | Yenilenebilir payı (%) |
| `live.by_source.<kaynak>.mw` | int | Kaynak üretimi |
| `live.by_source.<kaynak>.akkuyu` | number | `mw / 1200`, 2 ondalık |
| `live.ptf_tl_mwh` | number \| null | Aynı saatin PTF'si (TL/MWh) |
| `plants_day.date` | Date | Santral verisinin en son tam günü |
| `plants_day.last_hour_ts` | Timestamp | O günün son saati (`date`T23:00) |
| `plants_day.total_mw_last_hour` | int | O saatteki toplam üretim |
| `plants_day.plant_count` | int | O gün üretimi > 0 olan santral sayısı |
| `unlicensed_solar.month` | Month | Lisanssız verinin son yayımlanan ayı |
| `unlicensed_solar.avg_mw` | int | O ayın ortalama lisanssız güneş üretimi |
| `unlicensed_solar.peak_mw` | int | Saat başına aylık ortalamaların en büyüğü ("öğlen tepe") |
| `unlicensed_solar.source` | `"ren-ul-gen"` | |
| `akkuyu_unit_mw` | `1200` | Akkuyu eşdeğeri için bölen |

`unlicensed_solar` bloğu, "lisanssız güneş" bilgi notu içindir. Bu değer sayaçlara eklenmez. Notta hangi aya ait olduğu yazılmalıdır.

### `plants.json`

Santral boyutu, günde bir güncellenir. `plants[]` dizisindeki her eleman:

| Alan | Tip | Açıklama |
|---|---|---|
| `id` | int | EPİAŞ santral id'si (`generation_24h.plant_ids` ile eşleşir) |
| `name` | string | EPİAŞ adı (EİÇ eki kırpılmış) |
| `source` | SourceType | Son 30 günün baskın yakıtı |
| `lat`, `lon` | number \| null | 4 ondalık. Eşleşmeyen santralde `null` olur |
| `province` | int \| null | İl plaka kodu (1–81). Koordinattan nokta-poligon yöntemiyle bulunur |
| `capacity_mw` | number \| null | Kurulu güç (GEM, yoksa OSM). Bilinmiyorsa `null` |
| `match.source` | `"gem"` \| `"osm"` \| null | Koordinatın kaynağı |
| `match.score` | int | Eşleşme güveni (0–100) |

- Listede son 30 günde üretimi olan santraller yer alır.
- Koordinatı `null` olan santraller haritada gösterilmez. Üretimleri il panelinde `unlocated` olarak görünür.
- OSM kökenli koordinatlar bu dosyayı ODbL kapsamına sokar. Atıf zorunludur.

### `generation_24h.json`

Oynatma modu için, santral verisinin en son tam günü. Kompakt kolon biçimindedir:

```json
{ "date": "2026-11-07", "hours": ["…T00:00:00+03:00", "… 24 adet"],
  "plant_ids": [638, 1021, …],
  "mw": [[24 tamsayı], [24 tamsayı], …] }
```

- `mw[i]`, `plant_ids[i]` santralinin 24 saatlik üretimidir.
- `mw[i][h]` ise `hours[h]` saatindeki üretimdir.
- Yalnızca o gün üretimi > 0 olan santraller listede yer alır.
- Santral ayrıntısı (ad, kaynak, koordinat) `plants.json` dosyasından `id` ile birleştirilir.

### `mix_24h.json`

Kaynak dağılımı grafiği ve oynatma modundaki sayaçlar için.

| Alan | Açıklama |
|---|---|
| `sources` | Verisi olan kaynaklar, gösterim sırasıyla |
| `live.hours` | Ülke verisinin mevcut son 24 saati |
| `live.mw.<kaynak>` | `hours` ile aynı uzunlukta tamsayı dizisi |
| `live.ptf_tl_mwh` | Saatlik PTF (number \| null) |
| `plants_day.date`, `.hours`, `.mw`, `.ptf_tl_mwh` | Aynı yapı, santral gününün 24 saati |

- `plants_day` serisi kaynak tablosundan gelir.
- Santral toplamıyla birebir aynıdır. 2026-11-07 için iki taraf da 886.037 MWh.
- Oynatmada toplam MW, yenilenebilir payı ve Akkuyu eşdeğeri bu seriden hesaplanır.

### `provinces_24h.json`

İl paneli, santral verisinin en son tam günü.

| Alan | Açıklama |
|---|---|
| `date`, `hours` | Gün ve 24 saat |
| `provinces[].plate` | Plaka kodu (`provinces.geojson` içindeki `plate` ile eşleşir) |
| `provinces[].name` | İl adı |
| `provinces[].mw` | 24 saatlik toplam (int) |
| `provinces[].mwh_by_source` | Günlük kaynak dağılımı (PerSource, int) |
| `provinces[].total_mwh` | Günlük toplam |
| `provinces[].rank` | Türkiye içindeki sıra (1 = en çok üreten) |
| `provinces[].share_pct` | Ülke toplamı içindeki pay (konumsuz üretim dahil paydada) |
| `provinces[].plant_count` | İldeki üreten santral sayısı |
| `unlocated` | Konumu bilinmeyen santrallerin toplamı: `mw`, `total_mwh`, `plant_count` |

Yalnızca üretimi olan iller listededir ve `rank` sırasına dizilidir. Listede olmayan bir ilin o gün lisanslı üretimi yoktur. Panel bu ili "veri yok / üretim yok" olarak gösterir.

### `provinces.geojson`

- 81 ilin sadeleştirilmiş sınırları: FeatureCollection, Polygon ya da MultiPolygon.
- `properties` alanları: `plate` (int), `name`, `iso` (`TR-01`…).
- Kaynak geoBoundaries TUR ADM1 (CC BY-SA 2.0). Atıf zorunludur.
- v0'da shapely ile sadeleştirildi ve 3 ondalığa yuvarlandı. Komşu il sınırlarında küçük boşluklar olabilir.

## Bilinen sınırlar (v0)

1. **Konum kapsamı geçici.**
   - 1.548 santralden 778'i eşleşti: 606 GEM, 172 OSM.
   - Bunlar 2026-11-07 üretiminin %82,4'ü. Kalan %17,6 `unlocated` olarak görünür.
   - Aşama 2'de dbt eşleştirmesi ve elle düzeltme seed'i ile artacak.
2. **Yanlış pozitif eşleşmeler var.** Örneğin "KARAKAYA HES TRABZON", Diyarbakır'daki Karakaya'ya bağlandı. dbt'de düzeltilecek.
3. **Kurulu güç eksik.** Eşleşen 42 santralde `capacity_mw` null.
4. **Son saat eksik gelebilir.** EPİAŞ kaynak bazlı verinin en son saatini önce eksik yayımlıyor, sonra tamamlıyor.
   - Örnek: 08.11 11:00 saati 12:27'deki çekimde 12.909 MW idi, 13:15'te 19.920 MW oldu.
   - v0 örneğinde `live.ts` bu eksik saattir. Bu yüzden `live.total_mw` olduğundan düşük görünür.
   - Saatlik iş değeri bir sonraki çalışmada günceller. Yine de `live` için "kesinleşmiş son saat" kuralı Aşama 2'de belirlenecek (açık soru).
5. **Gelecekte değişebilecek alanlar:**
   - santral için `province` adı (şimdilik yalnızca plaka kodu var)
   - yakıt bazında bölünmüş santral üretimi
   - `match` alanının bir güven sınıfına dönüşmesi

## Değişiklik günlüğü

| Sürüm | Tarih | Değişiklik |
|---|---|---|
| 0.1.0 | 2026-11-08 | İlk taslak (v0), dbt'siz örnek veri |

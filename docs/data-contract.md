# Veri sözleşmesi — v0 taslağı

> **Durum: `schema_version: "0.2"`, 2026-11-08.** Bu bir taslak. dbt modelleri (Aşama 2) bitince alanlar netleşebilir, eklenebilir veya yeniden adlandırılabilir. Her değişiklik `contracts/` altında kendi commit'iyle yapılır, `schema_version` artırılır ve bu dosyaya not düşülür.

Sitenin okuduğu JSON dosyalarının şekli `contracts/*.schema.json` (JSON Schema 2020-12) dosyalarında tanımlıdır. Bu doküman, şemaların ne anlama geldiğini açıklar. Bir çelişki olursa **şema kazanır**.

## Dosyalar ve üretim

| Dosya | Şema | Ne zaman değişir | Örnek boyut (ham / gzip) |
|---|---|---|---|
| `snapshot_latest.json` | `snapshot_latest.schema.json` | saatlik | 1,0 KB / 0,5 KB |
| `plants.json` | `plants.schema.json` | günlük | 227,1 KB / 27,3 KB |
| `generation_24h.json` | `generation_24h.schema.json` | günlük (santral verisi ertesi gün gelir) | 88,9 KB / 20,4 KB |
| `mix_24h.json` | `mix_24h.schema.json` | saatlik | 5,2 KB / 1,8 KB |
| `provinces_24h.json` | `provinces_24h.schema.json` | günlük | 20,3 KB / 6,1 KB |
| `provinces.geojson` | `provinces.schema.json` | statik | 144,0 KB / 43,1 KB |
| `source_labels.json` | `source_labels.schema.json` | sözleşmeyle birlikte | 0,7 KB / 0,3 KB |
| `pipeline_status.json` | `pipeline_status.schema.json` | ~20 sn (Docker açıkken) | ~4 KB / ~1 KB |
| **Toplam** | | | **487 KB / 100 KB** |

- Ortak tanımlar `contracts/common.schema.json` içindedir.
- **Tek doğrulama komutu:** `.venv/Scripts/python -X utf8 -m scripts.check` (Git Bash'te `./scripts/check.sh`). Dört adımı sırayla çalıştırır:
  1. örnek JSON'ları üretir
  2. şemayla doğrular
  3. TS tiplerinin şemalarla senkron olduğunu kontrol eder
  4. `frontend/` varsa `npm run typecheck` ve `npm run build` çalıştırır

  Bayraklar:
  - `--skip-export`: yalnızca doğrulama yapar.
  - `--root ../a-frontend`: kontrolü worktree'de çalıştırır.
  - `.env` (BigQuery kimliği) yoksa dışa aktarma adımı kendiliğinden atlanır.
- **TypeScript tipleri:** `cd contracts && npm install && npm run gen:types` komutu `frontend/src/types/*.ts` dosyalarını üretir. Bu dosyalar elle düzenlenmez.
- **Örnek veri:** `.venv/Scripts/python -X utf8 -m scripts.export_sample` komutu dbt mart'larından (BigQuery `epias_marts`: `mart_live_snapshot`, `dim_plants`, `fct_generation_hourly`, `agg_generation_by_source_hourly`, `agg_generation_by_province_hourly`; il sınırları `epias_staging.stg_provinces`) `frontend/public/data/sample/` klasörünü üretir ve her dosyayı yazmadan önce şemayla doğrular.
- **Yalnızca doğrulama:** `... -m scripts.export_sample --validate-only [--out KLASÖR]`
- Eşleştirme, il ataması, kurulu güç kuralı ve kesinleşmiş saat kuralı dbt'dedir. Dışa aktarma yalnızca biçimlendirir (yerel dosya ya da bulanık eşleştirme kullanmaz). Bir dışa aktarma yaklaşık 7 MiB tarar.

## Ortak kurallar

- **Zaman:** Bütün zaman damgaları ISO 8601 biçiminde ve İstanbul saatiyle (`+03:00`) yazılır. Saatlik değerler **saatin başlangıcını** gösterir: `2026-11-07T23:00:00+03:00`, 23:00–24:00 aralığıdır. Tarihler `YYYY-MM-DD` biçimindedir (yerel gün). Aylar `YYYY-MM` biçimindedir.
- **Birim:** MW, o saatteki ortalama güçtür (= o saatin MWh değeri). Sayılar çoğunlukla tamsayıya yuvarlanır. Yüzdeler bir ondalık hanelidir.
- **Toplamlar lisanslı yurt içi üretimdir. Dış ticaret hariçtir.** Bütün üretim değerleri yalnızca lisanslı gerçek zamanlı üretimden gelir (EPİAŞ `rt-gen` / `rt-gen-bulk`). Lisanssız üretim (çatı ve küçük güneş) içinde yoktur. Dış ticaret (`importExport`) hiçbir toplama girmez. EPİAŞ'ın kendi `total` alanı dış ticareti içerdiği için kullanılmaz. Toplam, kaynak kolonlarından yeniden hesaplanır.
- Her dosyada `schema_version: "0.2"` alanı vardır. `provinces.geojson` dosyasında bu alan, FeatureCollection'ın üst düzey alanı olarak durur. `source_labels.json` ve geojson dışındaki her dosyada ayrıca `generated_at` alanı vardır.

### Kaynak türleri (`SourceType`)

- Anahtarlar İngilizcedir ve dbt'deki kontrollü sözlükle birebir aynıdır. Türkçe yalnızca ekran etiketlerinde kullanılır.
- Anahtar → etiket, yenilenebilir bilgisi ve gösterim sırası `contracts/source_labels.json` dosyasındadır. Bu dosyanın bir kopyası örnek klasöründedir. Panel etiketleri buradan okur, kodda sabitlemez.
- Tablodaki sıra, grafiklerdeki yığılma ve gösterim sırasıdır.

| Anahtar | Türkçe etiket | EPİAŞ kolonları | Yenilenebilir |
|---|---|---|---|
| `solar` | Güneş | sun | ✓ |
| `wind` | Rüzgâr | wind | ✓ |
| `hydro_dam` | Hidro (barajlı) | dammedHydro | ✓ |
| `hydro_river` | Hidro (akarsu) | river | ✓ |
| `geothermal` | Jeotermal | geothermal | ✓ |
| `biomass` | Biyokütle | biomass | ✓ |
| `natural_gas` | Doğalgaz | naturalGas, lng | |
| `imported_coal` | İthal kömür | importCoal | |
| `lignite` | Linyit ve yerli kömür | lignite, blackCoal, asphaltiteCoal | |
| `nuclear` | Nükleer | (henüz yok) | |
| `other` | Diğer | fueloil, naphta, wasteheat | |

- Kaynak bazlı nesnelerde (`PerSource`, `PerSourceSeries`) **her anahtar opsiyoneldir**. Verisi olmayan ya da tamamen sıfır olan kaynak yazılmaz. Bugün `nuclear` hiç gelmiyor.
- Panel, eksik bir anahtarı 0 kabul etmeli ve hata vermemelidir.
- Renkler AGENTS.md'de tanımlıdır. Hidro baraj ve akarsu aynı renk ailesindendir.

### Kaynak türü kuralı (karar: 2026-11-08)

Bir santral birden çok yakıtla üretebilir (ör. doğalgaz + fueloil). Kaynak türü üç yerde, üç ayrı anlamda kullanılır:

- **Santral rengi ve santral filtresi** (`plants.json` `source`): santralin son 30 tam gündeki baskın yakıtı (`dim_plants.source_type`). Gün içinde değişmez.
- **Kaynak dağılımları** (`mix_24h`, `snapshot_latest.live.by_source`, `provinces_24h` `mwh_by_source`): her MWh, EPİAŞ'ın raporladığı yakıt kolonuna yazılır. Çok yakıtlı santralin üretimi kaynaklara bölünür. Bu sayede il dağılımlarının toplamı, ülke verisinin kaynak toplamlarıyla tutar.
- **Saatlik santral filtresi** (dbt `fct_generation_hourly.source_type`): santralin o saatteki baskın yakıtı. Şimdilik hiçbir JSON'a girmez.

Fark küçüktür: 2026-11-07'de üretimin %0,41'i (3.589 MWh, 119 santral) saatlik baskın yakıttan farklı bir kolondan geldi. Bu yüzden bir santralin rengi, bulunduğu ilin kaynak dağılımındaki dilimle her zaman birebir örtüşmeyebilir.

### Tüketim, dış ticaret ve denge (0.2)

`snapshot_latest` ve `mix_24h` dosyalarında üç ek alan vardır (dbt `agg_country_balance_hourly`):

- **`consumption_mw`:** EPİAŞ gerçek zamanlı tüketimi (`rt-cons`). Üretimden yaklaşık 1 saat sonra yayımlanır. Henüz gelmemiş saatte `null` olur.
- **`net_import_mw`:** EPİAŞ `importExport` kolonu, aynı işaretle. **+ = net ithalat, - = net ihracat.** Hiçbir üretim toplamına girmez. 2026-08..11 arasında her saat negatifti (net ihracat).
- **`balance_mw`:** **lisanslı üretim - tüketim.** Tüketim yoksa `null`. **Negatif değer gündüz çoğunlukla lisanssız (sayaç arkası) güneşten kaynaklanır, dış ticaretten değil.** Bu üretim lisanslı veride yoktur, tüketimde vardır. Örneğin 2026-11-07'de denge -10.189 MW ile +429 MW arasındaydı. Panel negatif dengeyi "ithalat" diye etiketlememelidir.
- **Gece tutarlılığı (dbt uyarı testi):** Gece lisanssız güneş olmadığı için lisanslı üretim + net ithalat ≈ tüketim olmalıdır. Son 30 tam günün yerel 00:00-05:00 saatlerinde (180 saat) |fark| / tüketim en az %0,05, medyan %0,26, p95 %0,53, en çok %0,75 çıktı. Uyarı eşiği %3'tür. Fark hep aynı yöndedir: üretim + ithalat tüketimden 17-233 MW (medyan 86 MW) azdır. Bu, gece de çalışan küçük lisanssız üretimle uyumludur.

## İki mod ve iki zaman damgası

AGENTS.md'deki karar gereği, ülke verisi ile santral verisi farklı gecikmelerle gelir. Bu yüzden ayrı bloklarda ve kendi zaman damgalarıyla taşınır:

| Blok | Kaynak | Gecikme | Zaman damgası |
|---|---|---|---|
| `live` | kaynak bazlı ülke verisi (`rt-gen`) | ≈ 2 saat | `live.ts` (en son **kesinleşmiş** saatin başlangıcı) |
| `plants_day` | santral bazlı veri (`rt-gen-bulk`) | en erken ertesi gün | `plants_day.date` (en son **tam** gün) |

- **Canlı mod:** Sayaçlar `snapshot_latest.live` alanından, grafik `mix_24h.live` alanından beslenir. Harita `generation_24h` dosyasının son saatinde durur ve "Santral verisi: [plants_day.date]" etiketini taşır.
- **Oynatma modu:** Sayaçlar ve grafik `mix_24h.plants_day` alanından, harita `generation_24h` dosyasından, il paneli `provinces_24h` dosyasından beslenir. Hepsi aynı gündedir.

### Kesinleşmiş saat kuralı (karar: 2026-11-08)

EPİAŞ, ülke verisinin en son saatini önce eksik yayımlar ve sonra tamamlar. Örneğin 08.11 11:00 saati 12:27'de 12.909 MW görünüyordu, 13:15'te 19.920 MW oldu. Bu yüzden:

- **`live.ts`, ülke verisindeki en son saatten bir önceki saattir.** Sayaçlar bu kesinleşmiş saati gösterir. Bunun karşılığında yaklaşık 1 saatlik ek gecikmeyi kabul ediyoruz.
- `mix_24h.live` serisi de kesinleşmiş saatte biter.
- En son (ön veri) saat isteğe bağlı `live.provisional` alanında durur: `{ ts, total_mw }`. Panel bu alanı şimdilik kullanmaz. İleride "ön veri" etiketiyle gösterilebilir.
- Kural dbt'de `mart_live_snapshot` içinde uygulanır ve `assert_live_hour_is_one_before_latest` testiyle korunur.

Tazelik eşikleri, panelin "veri eski" uyarısı için kullanılır. Hesap `ts` ya da `date` ile o anki saat arasındaki farka göre yapılır:

- Kaynak bazlı veri: 4 saatte uyarı, 6 saatte hata
- Santral bazlı veri: 36 saatte uyarı, 48 saatte hata
- Tüketim verisi (`rt-cons`): 5 saatte uyarı, 7 saatte hata. Kaynak bazlı veriden yaklaşık 1 saat sonra yayımlanır.

## Dosyalar

### `snapshot_latest.json`

Canlı sayaçlar için en son özet.

| Alan | Tip | Açıklama |
|---|---|---|
| `live.ts` | Timestamp | En son kesinleşmiş saat (saatin başlangıcı) |
| `live.total_mw` | int | Lisanslı yurt içi üretim, dış ticaret hariç |
| `live.renewable_share_pct` | number | Yenilenebilir payı (%) |
| `live.by_source.<kaynak>.mw` | int | Kaynak üretimi |
| `live.by_source.<kaynak>.akkuyu` | number | `mw / 1200`, 2 ondalık |
| `live.ptf_tl_mwh` | number \| null | Aynı saatin PTF'si (TL/MWh) |
| `live.provisional` | object, opsiyonel | Ön veri: `ts` (en son yayımlanan saat) ve `total_mw`. Panel şimdilik kullanmaz |
| `live.consumption_mw` | int \| null | Aynı saatin tüketimi (rt-cons). Henüz yayımlanmadıysa `null` (0.2) |
| `live.net_import_mw` | int \| null | Aynı saatin net dış ticareti. + = net ithalat, - = net ihracat (0.2) |
| `live.balance_mw` | int \| null | Denge = lisanslı üretim - tüketim. Tüketim yoksa `null` (0.2) |
| `plants_day.date` | Date | Santral verisinin en son tam günü |
| `plants_day.last_hour_ts` | Timestamp | O günün son saati (`date`T23:00) |
| `plants_day.total_mw_last_hour` | int | O saatteki toplam üretim |
| `plants_day.plant_count` | int | O gün üretimi > 0 olan santral sayısı |
| `plants_day.consumption_mw`, `.net_import_mw`, `.balance_mw` | int \| null | Aynı üç değer, santral gününün son saati (`last_hour_ts`) için. Denge ülke lisanslı üretiminden hesaplanır (0.2) |
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
| `source` | SourceType | Son 30 tam günün baskın yakıtı. Santral rengi buradan gelir (bkz. "Kaynak türü kuralı") |
| `lat`, `lon` | number \| null | 4 ondalık. Eşleşmeyen santralde `null` olur |
| `province` | int \| null | İl plaka kodu (1–81). Koordinattan nokta-poligon yöntemiyle bulunur |
| `capacity_mw` | number \| null | Kurulu güç, konum kaydından (GEM, yoksa OSM). Kayıt paylaşılıyorsa, vekil kayıtsa ya da güç bilinmiyorsa `null` (aşağıya bakın) |
| `match.source` | `"gem"` \| `"osm"` \| null | Koordinatın kaynağı |
| `match.score` | int | Eşleşme güveni (0–100): elle düzeltme 100, bulanık eşleşme ad benzerliği (en az 90), eşleşme yoksa 0 |

- Listede son 30 günde üretimi olan santraller yer alır.
- **Kurulu güç kuralı (kullanıcı kararı, 2026-11-08):** `capacity_mw` yalnızca konum kaydını tek bir santral kullanıyorsa ve kayıt vekil değilse doludur. Birden çok santralin paylaştığı sahalarda (ZETES 1-3, Karapınar YEKA, TUTES-A/B vb.) kaydın gücü tesis toplamıdır ve santrale ait değildir. Vekil kayıtlarda (TÜPRAŞ İZMİT/İZMİR: aynı sahadaki başka bir tesis) güç alakasızdır. Bu durumlarda değer `null` olur ve panelde "bilinmiyor" yazılır.
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
| `live.hours` | Kesinleşmiş saatte biten son 24 saat |
| `live.mw.<kaynak>` | `hours` ile aynı uzunlukta tamsayı dizisi |
| `live.ptf_tl_mwh` | Saatlik PTF (number \| null) |
| `live.consumption_mw`, `live.net_import_mw`, `live.balance_mw` | `hours` ile hizalı (int \| null) diziler: tüketim, net dış ticaret, denge (0.2) |
| `plants_day.date`, `.hours`, `.mw`, `.ptf_tl_mwh` | Aynı yapı, santral gününün 24 saati |
| `plants_day.consumption_mw`, `.net_import_mw`, `.balance_mw` | Aynı diziler, santral gününün 24 saati (0.2) |

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
| `provinces[].mwh_by_source` | Günlük kaynak dağılımı (PerSource, int). Her MWh EPİAŞ'ın yakıt kolonuna yazılır, santralin baskın yakıtına değil (bkz. "Kaynak türü kuralı") |
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
- `stg_provinces`'tan BigQuery `ST_SIMPLIFY` (1.000 m) ile sadeleştirilir ve 3 ondalığa yuvarlanır. Sadeleştirmede noktaya inen küçük adalar düşer. İller ayrı ayrı sadeleştirildiği için komşu sınırlarda küçük boşluklar olabilir.

### `pipeline_status.json`

Veri hattının o anki durumu: hangi adım çalışıyor, hangisi bitti, hangisi hata verdi. `scripts/pipeline_status.py` Docker'daki `pipeline-status` servisinde çalışır, Airflow API'sini 20 saniyede bir okur. İçerik değişince ya da en geç 2 dakikada bir dosyayı yeniden yazar. Kovada `Cache-Control: no-cache` ile durur. Diğer dosyalardan bağımsızdır, `snapshot_latest` ile birlikte yayımlanmaz.

- `generated_at` canlılık sinyalidir. **5 dakikadan eskiyse** izleyici çalışmıyordur (Docker kapalı). Bu durumda panel adımları "son bilinen durum" olarak göstermeli.
- `pipelines[]`: önce `enerji_saatlik`, sonra `enerji_gunluk`. Her birinde `is_paused`, `last_success_at`, `run` (en son çalışma; yoksa `null`) ve `steps[]` alanları var.
- `steps[]` akış sırasıyla gelir. `depends_on` önceki adımların `id`'leridir, ağaç bu kenarlarla kurulur. Saatlik hat bir karar dalı içerir: `plant_day_check` yeni santral günü yoksa `skipped` olur, santral dalı atlanır. Bu normaldir, hata değildir.
- `stage`: `epias` (EPİAŞ'tan çekme), `bigquery` (BigQuery'de kontrol/eşleştirme), `dbt` (modeller ve testler), `export` (JSON dışa aktarma, şema doğrulama), `gcs` (kovaya yayın).
- `from` / `to`: verinin okunduğu ve yazıldığı yer, Türkçe.
- `state`: `pending` (sırada), `running`, `success`, `failed`, `retrying` (hata verdi, yeniden denenecek), `skipped` (yapılacak iş yoktu), `upstream_failed` (önceki adım düştüğü için çalışmadı).
- Panel sürelerini `started_at` / `ended_at` alanlarından hesaplar. `try_number` 1'den büyükse kaçıncı deneme olduğunu gösterir.

## Bilinen sınırlar

Sayılar 2026-11-08 örneğinden (santral günü 2026-11-07). Eşleştirme ayrıntısı: `docs/eslestirme-raporu.md`.

1. **Konum kapsamı.**
   - `plants.json` içindeki 1.548 santralden 758'i konumlu: 488 GEM, 270 OSM.
   - Son 30 tam günün üretiminde konumlu pay %91,74. 2026-11-07 gününde %89,3, kalan %10,7 `unlocated` olarak görünür.
   - dbt testi: konumsuz pay %10'u aşarsa uyarı, %15'i aşarsa hata.
2. **Yanlış pozitifler azaltıldı.** v0'daki "KARAKAYA HES TRABZON" → Diyarbakır gibi eşleşmeler elle düzeltme seed'iyle kaldırıldı. Kalan şüpheli eşleşmeler dbt uyarı testlerinde listelenir.
3. **Kurulu güç kısmi.** Konumlu 758 santralin 632'sinde `capacity_mw` dolu. 126'sında `null`: paylaşılan sahalar, vekil kayıtlar (TÜPRAŞ İZMİT, İZMİR, BATMAN) ve kaydında güç olmayanlar (bkz. "Kurulu güç kuralı").
4. **Son saat eksik geliyordu: karar verildi.** Bkz. "Kesinleşmiş saat kuralı". `live` bir önceki saati kullanır, eksik saat `live.provisional` alanına gider.
5. **Gelecekte değişebilecek alanlar:**
   - santral için `province` adı (şimdilik yalnızca plaka kodu var)
   - yakıt bazında bölünmüş santral üretimi
   - `match` alanının bir güven sınıfına dönüşmesi

## Değişiklik günlüğü

| Sürüm | Tarih | Değişiklik |
|---|---|---|
| 0.2 | 2026-11-10 | Yalnızca ekleme: yeni dosya `pipeline_status.json` (`pipeline_status.schema.json`), veri hattı durumu. Mevcut dosyalar değişmedi, sürüm aynı |
| 0.2 | 2026-11-08 | Yalnızca ekleme: `snapshot_latest.live` ve `.plants_day` içinde `consumption_mw`, `net_import_mw`, `balance_mw` (int \| null, opsiyonel ama dışa aktarma hep yazar); `mix_24h.live` ve `.plants_day` içinde aynı adlı, `hours` ile hizalı diziler. Bütün şemalarda ve `source_labels.json` içinde `schema_version` "0.2". Hiçbir alan yeniden adlandırılmadı ya da kaldırılmadı |
| 0.1 | 2026-11-08 | Örnek veri dbt mart'larından üretiliyor (şekil değişmedi, sürüm aynı). Değer anlamı: `capacity_mw` kurulu güç kuralı, `match.score` güven puanı (eşleşmeyende 0), dbt eşleştirmesi. `plants.schema.json` içinde bu iki alanın açıklaması güncellendi (yalnızca açıklama). `provinces.geojson` BigQuery'de sadeleştiriliyor |
| 0.1 | 2026-11-08 | İlk taslak (v0), dbt'siz örnek veri. Aynı gün revize edildi: İngilizce kaynak anahtarları ve `source_labels.json`, `schema_version` "0.1", kesinleşmiş saat kuralı ve `live.provisional`, tek doğrulama komutu `scripts.check` |

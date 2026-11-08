# Türkiye Enerji Haritası — Tasarım Önerisi (Sürüm 1)

Bu doküman, `AGENTS.md`, `docs/data-contract.md` (v0.1) ve `public/data/sample/` altındaki gerçek veri örnekleri (`2026-11-07` tam santral günü ve `2026-11-08T10:00:00+03:00` kesinleşmiş ülke verisi) temel alınarak hazırlanmıştır.

---

## 1. Renk Paleti (Koyu "Kontrol Odası" Teması)

Kontrol odası (SCADA / şebeke izleme merkezi) atmosferi için göz yormayan derin lacivert-siyah zeminler, yüksek kontrastlı tipografi ve parlayan (glow) veri katmanları kullanılır. Saf siyah (`#000000`) yerine OLED smearing etkisini önleyen ve harita altlığıyla bütünleşen derin arduvaz/gece mavisi tonları seçilmiştir.

| Rol | CSS Değişkeni | Hex | Kullanım Alanı ve Açıklama | `#060A12` Kontrastı |
|---|---|---|---|---|
| **Ana Zemin (Canvas)** | `--bg-canvas` | `#060A12` | Sayfa arka planı ve MapLibre harita tabanı (su/boşluk rengi) | 1.0:1 |
| **Harita Kara Yüzeyi** | `--bg-map-land` | `#0B111E` | Türkiye il poligonlarının varsayılan dolgu rengi | 1.1:1 |
| **Yüzey (Kart / Panel)** | `--bg-surface` | `#0D1422` | Üst sayaç kartları, alt oynatma çubuğu, il paneli ana zemini | 1.1:1 |
| **Yükseltilmiş Yüzey** | `--bg-elevated` | `#151F32` | Kart hover durumu, açılır menüler, aktif sekme ve tooltip zemini | 1.3:1 |
| **Cam Yüzey (Overlay)** | `--bg-glass` | `#0D1422D9` | Harita üzerindeki yüzen paneller (`%85` opaklık + `backdrop-blur-md`) | — |
| **İnce Kenarlık** | `--border-subtle` | `#1E293B` | Kart sınırları, tablo satır ayraçları, harita il sınırları (normal) | 1.5:1 |
| **Vurgulu Kenarlık** | `--border-strong` | `#334155` | Seçili kart, odak halkası dışı, harita il sınırı (hover) | 2.1:1 |
| **Birincil Metin** | `--text-primary` | `#F8FAFC` | Sayaç değerleri, ana başlıklar, santral ve il adları | **18.2:1** (AAA) |
| **İkincil Metin** | `--text-secondary` | `#94A3B8` | Birim etiketleri (`MW`, `MWh`), "lisanslı üretim" ibaresi, eksen yazıları | **7.4:1** (AAA) |
| **Soluk Metin (Yardımcı)** | `--text-muted` | `#64748B` | Devre dışı kontroller, ikincil zaman damgaları, atıf alt metinleri | **4.0:1** (Büyük/UI AA) |
| **Vurgu — Canlı Mod** | `--accent-live` | `#10B981` | Canlı mod rozeti, aktif nabız (pulse) noktası, yenilenebilir vurgusu | **7.4:1** (AAA) |
| **Vurgu — Oynatma Modu** | `--accent-playback` | `#38BDF8` | Oynatma modu rozeti, zaman çubuğu imleci, seçili il dış sınırı | **9.2:1** (AAA) |
| **Uyarı (Veri Gecikmesi)** | `--status-warning` | `#F59E0B` | Tazelik uyarısı (ülke ≥ 4 sa, santral ≥ 36 sa), ön veri / gecikme notu | **7.9:1** (AAA) |
| **Uyarı Zemini** | `--status-warning-bg` | `#451A03` | Uyarı bandı arka planı (`#F59E0B` kenarlıkla birlikte) | — |
| **Hata (Veri Eski / Yok)** | `--status-error` | `#F87171` | Tazelik hatası (ülke ≥ 6 sa, santral ≥ 48 sa), bağlantı/yükleme hatası | **6.8:1** (AA+) |
| **Hata Zemini** | `--status-error-bg` | `#450A0A` | Hata bandı arka planı (`#F87171` kenarlıkla birlikte) | — |

---

## 2. Enerji Kaynakları Renk Paleti (11 Kaynak)

Gösterim ve yığılma sırası `contracts/source_labels.json` dosyasındaki `order` dizisiyle birebir aynıdır. İlk 6 kaynak yenilenebilir (`renewable: true`), son 5 kaynak yenilenemez (`renewable: false`) grubundadır.

| Sıra | Kaynak Anahtarı (`SourceType`) | Türkçe Etiket | Yenilenebilir | Hex | Renk Ailesi ve Gerekçe | `#060A12` Kontrastı | `#0D1422` Kontrastı |
|---|---|---|---|---|---|---|---|
| 1 | `solar` | Güneş | Evet | `#FACC15` | **Sarı** — Yüksek parlaklıkta güneş sarısı | **12.5:1** | 11.3:1 |
| 2 | `wind` | Rüzgâr | Evet | `#22D3EE` | **Camgöbeği (Cyan)** — Elektrik mavisi/yeşili, maviden net ayrılır | **10.6:1** | 9.6:1 |
| 3 | `hydro_dam` | Hidro (barajlı) | Evet | `#3B82F6` | **Mavi (Derin/Kraliyet)** — Baraj rezervuarını temsil eden doygun mavi | **5.1:1** | 4.6:1 |
| 4 | `hydro_river` | Hidro (akarsu) | Evet | `#93C5FD` | **Mavi (Açık Buzul)** — `hydro_dam` ile aynı mavi ailesinden, yüksek parlaklık farkıyla ayrılır | **10.8:1** | 9.8:1 |
| 5 | `geothermal` | Jeotermal | Evet | `#F43F5E` | **Mercan / Kırmızı-Gül** — Yerküre ısısı; turuncu (`natural_gas`) ve sarıdan (`solar`) ayrışır | **5.4:1** | 4.9:1 |
| 6 | `biomass` | Biyokütle | Evet | `#4ADE80` | **Canlı Yeşil** — Organik kaynak; camgöbeğinden (`wind`) sıcak yeşil tonuyla ayrılır | **10.3:1** | 9.3:1 |
| 7 | `natural_gas` | Doğalgaz | Hayır | `#F97316` | **Turuncu** — Alev turuncusu; sarı (`#FACC15`) ve mercandan (`#F43F5E`) net ayrılır | **7.5:1** | 6.8:1 |
| 8 | `imported_coal` | İthal kömür | Hayır | `#CBD5E1` | **Gri (Açık Çelik/Gümüş)** — Kömür ailesinin açık tonu; koyu zeminde yüksek görünürlük | **11.4:1** | 10.3:1 |
| 9 | `lignite` | Linyit ve yerli kömür | Hayır | `#A8A29E` | **Gri (Sıcak Taş/Kül — Stone 400)** — `imported_coal` (`#CBD5E1`) ile aynı gri ailesinden, sıcak taş tonu ve parlaklık farkıyla ayrılır | **7.9:1** | 7.3:1 |
| 10 | `nuclear` | Nükleer | Hayır | `#A855F7` | **Mor (Ametist)** — Radyasyon/füzyon çağrışımlı doygun mor (henüz veri yoksa 0/gizli) | **5.4:1** | 4.9:1 |
| 11 | `other` | Diğer | Hayır | `#D4A373` | **Sıcak Bronz / Kum Taşı** — Fuel-oil/atık ısı için soğuk grilerden ayrışan nötr toprak tonu | **8.6:1** | 7.8:1 |

### Mavi ve Gri Ailesi Ayrım Doğrulaması
- **Hidro (`hydro_dam` `#3B82F6` vs `hydro_river` `#93C5FD`):** İkisi de saf mavi tonundadır (Hue ≈ `217°`), ancak bağıl parlaklıkları (`L=0.23` vs `L=0.55`) arasında **2.1:1** oranında ton farkı vardır. Yığılmış alan grafiğinde (stacked area) alt alta geldiklerinde ince bir `#060A12` (`1px`) kontur çizgisiyle desteklenir.
- **Kömür (`imported_coal` `#CBD5E1` vs `lignite` `#A8A29E`):** İkisi de gri ailesindendir; `imported_coal` soğuk çelik grisi (Slate 300), `lignite` ise sıcak taş/kül grisi (Stone 400, `#A8A29E`) olarak seçilmiştir. Hem koyu zeminde yüksek kontrast (**7.9:1**; `#0D1422` kart zemininde 7.3:1) sağlar hem de harita sütunlarında ve grafikte birbirinden net ayrılır.

### Koyu Zeminde Kontrast ve Renk Körlüğü (Protanopi / Deuteranopi) Değerlendirmesi
1. **WCAG 2.2 Kontrast Uyumu:**
   - Metin ve sayısal rozetlerde kullanılan tüm kaynak renkleri `#060A12` zemin üzerinde en az **5.1:1** (WCAG AA `4.5:1` metin ve `3.0:1` grafik sınırının üzerinde) kontrast sağlar.
   - `lignite` (`#A8A29E`, `7.9:1`) solunda renkli kare/daire ikon ve yanında `#F8FAFC` birincil metin ile gösterilir.
2. **Protanopi ve Deuteranopi (Kırmızı-Yeşil Renk Körlüğü) Analizi:**
   - Kırmızı-yeşil renk körlüğünde en kritik çakışma riski **Yeşil (`biomass`) — Turuncu (`natural_gas`) — Kırmızı (`geothermal`) — Sarı (`solar`)** eksenindedir.
   - Bu çakışmayı önlemek için dört kaynağa **farklı parlaklık (luminance) seviyeleri** atanmıştır:
     - `solar` (`#FACC15`): Çok parlak (`L = 0.64`)
     - `biomass` (`#4ADE80`): Orta-üst parlak (`L = 0.52`)
     - `natural_gas` (`#F97316`): Orta parlak (`L = 0.36`)
     - `geothermal` (`#F43F5E`): Koyu-orta parlak (`L = 0.25`)
   - **Yalnızca renge güvenmeme kuralı (`color-not-only`):**
     - Kaynak dağılımı grafiğinde ve il panelinde her dilim/seri üzerine gelindiğinde (veya klavye ile odaklanıldığında) Türkçe kaynak etiketi (`Güneş`, `Rüzgâr`, vb.), MW değeri ve yüzdesi metin olarak gösterilir.
     - Yenilenebilir kaynaklar grafikte üst/sol grupta, fosil kaynaklar alt/sağ grupta (`source_labels.json` sırasıyla) sabitlenir.

---

## 3. Tipografi

Kontrol odası estetiğini güçlendiren, yüksek okunabilirlikli ve açık kaynaklı (Google Fonts / Fontsource üzerinden ücretsiz) üçlü bir font sistemi önerilmektedir:

| Rol | Font Ailesi | Yedekler (Fallback) | Kullanım Alanı |
|---|---|---|---|
| **Başlık ve Sayaçlar (`--font-display`)** | **Space Grotesk** (`600`, `700`) | `system-ui, -apple-system, sans-serif` | Panel başlığı, büyük MW sayaçları, il adı başlıkları |
| **Arayüz ve Etiketler (`--font-sans`)** | **Inter** (`400`, `500`, `600`) | `system-ui, -apple-system, sans-serif` | Kaynak etiketleri, açıklamalar, butonlar, bilgi notları, atıflar |
| **Teknik Veri ve Saatler (`--font-mono`)** | **JetBrains Mono** (`400`, `500`, `600`) | `ui-monospace, monospace` | Saat damgaları (`10:00`), tarih rozetleri (`2026-11-07`), PTF, plaka kodları, tablo içi MW sütunları |

### Tabular Rakamlar (Sayısal Hizalama)
Oynatma çubuğu ilerlerken veya canlı sayaçlar dönerken (rolling numbers) rakam genişliklerinin değişip arayüzü titretmemesi (CLS = 0) için tüm sayısal alanlarda şu CSS kuralı zorunludur:
```css
.tabular-nums {
  font-variant-numeric: tabular-nums slashed-zero;
  font-feature-settings: "tnum" 1, "zero" 1;
}
```

### Tipografik Ölçek (Boyutlar ve Satır Yükseklikleri)

| Seviye | Sınıf / Token | Masaüstü Boyutu | Mobil Boyutu | Ağırlık | Satır Yüksekliği | Kullanım Örneği |
|---|---|---|---|---|---|---|
| **Ana Sayaç (Hero KPI)** | `text-kpi-hero` | `32px` (`2rem`) | `24px` (`1.5rem`) | `700` (Bold) | `1.1` | `22.674 MW`, `%59,6` |
| **İkincil Sayaç** | `text-kpi-sub` | `20px` (`1.25rem`) | `18px` (`1.125rem`) | `600` (SemiBold) | `1.2` | `4.425 MW`, `171,0 TL/MWh` |
| **Panel / İl Başlığı (H1/H2)** | `text-panel-title` | `18px` (`1.125rem`) | `16px` (`1rem`) | `600` (SemiBold) | `1.3` | `Çanakkale`, `Türkiye Enerji Haritası` |
| **Bölüm Başlığı (H3)** | `text-section` | `14px` (`0.875rem`) | `14px` (`0.875rem`) | `600` (SemiBold) | `1.4` | `KAYNAK DAĞILIMI (24 SAAT)` |
| **Gövde / Normal Etiket** | `text-body` | `14px` (`0.875rem`) | `14px` (`0.875rem`) | `400` / `500` | `1.5` | `Hidro (barajlı)`, `Santral listesi` |
| **Küçük Etiket / Rozet** | `text-caption` | `12px` (`0.75rem`) | `12px` (`0.75rem`) | `500` (Medium) | `1.4` | `lisanslı üretim`, `3,69 Akkuyu`, `Santral verisi: 07.11.2026` |
| **Mikro Metin (Atıf / Eksen)** | `text-micro` | `11px` (`0.6875rem`) | `11px` (`0.6875rem`) | `400` (Regular) | `1.4` | Grafik saat ekseni (`00:00`), alt bilgi atıfları |

### Türkçe Karakter Desteğinin Doğrulaması
`Space Grotesk`, `Inter` ve `JetBrains Mono` Google Fonts `latin-ext` alt kümesini eksiksiz içerir. Örnek verideki gerçek metinlerle doğrulama:
- **Büyük harfler:** `Ç, Ğ, İ, Ö, Ş, Ü, Â` → Örn: `ÇANAKKALE`, `ŞANLIURFA`, `İSTANBUL`, `IĞDIR`, `AFŞİN ELBİSTAN A TES`, `HAKKÂRİ`, `RÜZGÂR`.
- **Küçük harfler:** `ç, ğ, ı, i, ö, ş, ü, â` → Örn: `Rüzgâr`, `Doğalgaz`, `İthal kömür`, `lisanslı üretim`, `Ağrı`, `Gümüşhane`.
- **CSS `text-transform: uppercase` kuralı:** HTML kök etiketinde `<html lang="tr">` tanımlanarak tarayıcının `i → İ` ve `ı → I` dönüşümünü Türkçe kurallarına göre yapması garanti altına alınır.

---

## 4. Yerleşim (Masaüstü ve Mobil ASCII Taslakları)

### Masaüstü Yerleşimi (`≥ 1024px`, `100dvh` Tam Ekran Kontrol Odası)
Harita ekranın tamamını kaplar; üst bar, sol alt grafik ve sağ il paneli haritanın üzerinde yarı saydam cam (`--bg-glass`) katmanlar olarak konumlanır. Klavye odağı (`focus-not-obscured`) hiçbir zaman yüzen panellerin altında kalmaz.

```text
+------------------------------------------------------------------------------------------------------+
| [⚡ TÜRKİYE ENERJİ HARİTASI]   [Mod: (●) CANLI  ( ) OYNATMA]   [Ülke verisi: 08.11.2026 10:00 (+03)] |
+------------------------------------------------------------------------------------------------------+
| +-----------------------+ +--------------------+ +-----------------------+ +-----------------------+ |
| | TOPLAM ÜRETİM         | | YENİLENEBİLİR PAYI | | EN BÜYÜK KAYNAK       | | PTF (KESİNLEŞMİŞ)     | |
| | 22.674 MW             | | %59,6              | | Hidro (barajlı)       | | 171,0 TL/MWh          | |
| | lisanslı üretim       | | lisanslı üretim    | | 5.183 MW (4,32 Akkuyu)| | 08.11 10:00–11:00     | |
| +-----------------------+ +--------------------+ +-----------------------+ +-----------------------+ |
|                                                                                                      |
|   [📌 Santral verisi: 07.11.2026 (23:00) · 1.404 aktif santral]              +---------------------+ |
|   [☀️ Bilgi: Lisanssız güneş (2026-09): ort. 4.583 MW · öğlen tepe 14.782 MW]| İL PANELİ: Çanakkale| |
|                                                                              | Plaka: 17 · Sıra #1 | |
|                                                                              |---------------------| |
|                        [ HARİTA: MapLibre + deck.gl ]                        | Günlük: 71.199 MWh  | |
|                     81 İl Poligonu + 3B Santral Sütunları                    | Türkiye payı: %8,0  | |
|                      (Masaüstünde 40° eğim / döndürme)                       | Aktif santral: 34   | |
|                                                                              | Anlık (23:00):      | |
|                              ▲ 1.912 MW (Atatürk HES)                        | 2.678 MW            | |
|                         ●    █                                               |---------------------| |
|                    ●  █ █    █     ●                                         | Kaynak Dağılımı:    | |
|                                                                              | ▓ İthal kömür 44.613| |
| +--------------------------------------------------+                         | ▓ Rüzgâr      14.974| |
| | KAYNAK DAĞILIMI (SON 24 SAAT - CANLI)     [Gizle]|                         | ▓ Linyit      10.146| |
| | MW ^                                             |                         | ▓ Güneş          539| |
| |40k |      ...,,,,----~~~~                        |                         |---------------------| |
| |20k |  ---~~~         ~~~~----....                |                         | Konumsuz (Türkiye): | |
| | 0k +-------------------------------------------> |                         | 156.249 MWh (683)   | |
| |    11:00     17:00     23:00     05:00     10:00 |                         +---------------------+ |
| +--------------------------------------------------+                                                 |
+------------------------------------------------------------------------------------------------------+
| [▶ Oynat] [1x] | 07.11.2026 | 00:00 ========●========================= 23:00 | Seçili: 23:00 (38.804)|
+------------------------------------------------------------------------------------------------------+
| Veriler: EPİAŞ Şeffaflık Platformu · Konum: Global Energy Monitor, © OpenStreetMap · Sınırlar: geoBoundaries |
+------------------------------------------------------------------------------------------------------+
```

### Mobil Yerleşimi (`< 768px`, Dikey Akış + Alttan Açılan Sayfa / Bottom Sheet)
Mobilde 60 fps performans için 3B harita eğimi (tilt) varsayılan olarak **kapalıdır (0° kuşbakışı)**. Sayaçlar 2x2 kompakt ızgarada yığılır, il paneli ve kaynak grafiği alttan çekilebilir sayfa (bottom sheet) olarak çalışır. Tüm dokunma hedefleri en az `44×44px` boyutundadır.

```text
+--------------------------------------------+
| ⚡ Türkiye Enerji Haritası  [● CANLI | ▶]  |
| Ülke: 08.11 10:00 · Santral: 07.11 23:00   |
+--------------------------------------------+
| +-------------------+ +------------------+ |
| | TOPLAM (lisanslı) | | YENİLENEBİLİR    | |
| | 22.674 MW         | | %59,6            | |
| +-------------------+ +------------------+ |
| +-------------------+ +------------------+ |
| | PTF (10:00)       | | EN BÜYÜK KAYNAK  | |
| | 171,0 TL/MWh      | | Hidro · 5.183 MW | |
| +-------------------+ +------------------+ |
+--------------------------------------------+
| 📌 Santral verisi: 07.11.2026 (23:00) [☀️i]|
|                                            |
|         [ HARİTA (2B Kuşbakışı) ]          |
|         Parlayan Santral Noktaları         |
|              ve İl Sınırları               |
|                                            |
|            (İle dokununca açılır)          |
|                                            |
+--------------------------------------------+
| [▶] 07.11 | 00:00 =======●=== 23:00 | 23:00|
+--------------------------------------------+
| =================== == =================== | <-- Tutamaç (Yukarı çek: İl Paneli / Grafik)
| [Sekme: 📊 Kaynak Grafiği | 📍 İl: Çanakkale]|
| Çanakkale (#1) · 71.199 MWh · Pay %8,0     |
| ☀️ Lisanssız güneş (2026-09): ort 4.583 MW |
| Atıf: EPİAŞ · GEM · © OSM · geoBoundaries  |
+--------------------------------------------+
```

### Bileşenlerin Veri Eşleşmesi ve Davranışı
1. **Harita (Ortada):**
   - `provinces.geojson` ile 81 il sınırı çizilir. İle tıklandığında il paneli açılır.
   - `plants.json` içindeki `lat !== null && lon !== null` olan santraller (`1.548` santralden `778` tanesi) konumlandırılır. Yüksekliği `generation_24h.json` içindeki seçili saatin `mw[i][h]` değerine göre ölçeklenen 3B sütun (`ColumnLayer`) ve tabanında parlayan nokta (`ScatterplotLayer`) olarak çizilir.
2. **Üstte Canlı Sayaçlar:**
   - Toplam Üretim (`MW` + `lisanslı üretim` etiketi), Yenilenebilir Payı (`%` + `lisanslı üretim`), Kaynak kırılımı (`MW` ve `Akkuyu` eşdeğeri) ve PTF (`TL/MWh`).
3. **Altta 24 Saatlik Oynatma Çubuğu:**
   - Oynat/Duraklat (`▶`/`⏸`), hız seçici (`1x`, `2x`), 24 saatlik kaydırıcı (`00:00` – `23:00`) ve her saatin toplam MW mini önizleme çubuğu.
4. **Kaynak Dağılımı Grafiği:**
   - `mix_24h.json` verisiyle 24 saatlik yığılmış alan/çubuk (stacked area) grafiği. Kaynak sırası `source_labels.json` içindeki `order` dizisinden okunur.
5. **İl Paneli (Masaüstünde Sağda, Mobilde Alttan Açılan Sayfa):**
   - `provinces_24h.json` verisinden: ilin adı, plaka kodu, Türkiye sıralaması (`rank`), günlük toplam üretimi (`total_mwh`), ülke payı (`share_pct`), aktif santral sayısı (`plant_count`), 24 saatlik mini eğrisi (`mw[]`) ve kaynak bazlı günlük MWh dağılımı (`mwh_by_source`).
   - Listede olmayan iller (ör. 81 ilden `provinces_24h.json` içinde yer almayan 2 il) tıklandığında `"Bu ilde 07.11.2026 tarihinde kaydedilmiş lisanslı üretim yok"` mesajı gösterilir.
   - Ayrıca panelin altında Türkiye genelindeki konumsuz santral üretimi (`unlocated`: `156.249 MWh`, `683 santral`) şeffaflık notu olarak yer alır.
6. **"Santral verisi: [tarih]" Etiketi:**
   - Haritanın sol üst köşesinde sabit rozet: `Santral verisi: 07.11.2026 (23:00)`.
7. **Lisanssız Güneş Bilgi Notu:**
   - `snapshot_latest.unlicensed_solar` bloğundan beslenen bilgi kutusu/rozeti: `"Lisanssız güneş (Eylül 2026, gecikmeli): aylık ort. 4.583 MW · öğlen tepe 14.782 MW. Gerçek zamanlı sayaçlara dahil değildir."`
8. **Atıflar:**
   - Panelin en alt şeridinde her zaman görünür: `EPİAŞ Şeffaflık Platformu · Global Energy Monitor · © OpenStreetMap katkıcıları (ODbL) · geoBoundaries (CC BY-SA 2.0)`.

---

## 5. İki Modun Görsel Ayrımı (Canlı Mod vs Oynatma Modu)

Ülke verisi (`live.ts`: `2026-11-08T10:00:00+03:00`) ile santral verisi (`plants_day.date`: `2026-11-07`) farklı gecikmelerle geldiği için kullanıcının hangi modda olduğunu ve hangi saate baktığını tek bakışta anlaması şarttır.

| Özellik | 🟢 CANLI MOD (Varsayılan) | 🔵 OYNATMA MODU (24 Saatlik Geçmiş) |
|---|---|---|
| **Üst Mod Rozeti** | Yeşil parlayan nokta (`#10B981`) + **`CANLI MOD`** | Mavi oynatma ikonu (`#38BDF8`) + **`OYNATMA MODU: 07.11.2026`** |
| **Üst Sayaçların Kaynağı** | `snapshot_latest.live` (`08.11.2026 10:00` kesinleşmiş saat) | `mix_24h.plants_day` içinden seçili saat `h` (`07.11.2026 T[h]:00`) |
| **Kaynak Grafiğinin Kaynağı** | `mix_24h.live` (Son 24 kesinleşmiş saat: `07.11 11:00` → `08.11 10:00`) | `mix_24h.plants_day` (`07.11.2026` gününün `00:00` → `23:00` serisi) |
| **Harita ve İl Paneli** | `generation_24h` son saatinde (`07.11.2026 23:00`) sabit durur | Seçili saat `h` değiştikçe 3B sütunlar ve il MW değeri anlık güncellenir |
| **Zaman Farkı Rozeti** | Harita üstünde belirgin rozet: **`📌 Harita: Santral verisi 07.11.2026 23:00 (Sayaçlar: 08.11 10:00)`** | Tüm bileşenler senkron: **`⏱ Tüm panel: 07.11.2026 [Seçili Saat: 14:00]`** |
| **Mod Geçiş Tetikleyicileri** | Üstteki `"Canlıya Dön"` butonuna basıldığında | Kullanıcı alt çubukta `▶ Oynat` butonuna bastığında veya saat kaydırıcısını sürüklediğinde otomatik geçer |

---

## 6. Durumlar (Yükleniyor, Veri Yok, Veri Eski ve Tazelik Eşikleri)

Tazelik hesabı, kullanıcının mevcut zamanı (`now`) ile verinin zaman damgası (`live.ts` veya `plants_day.last_hour_ts`) arasındaki saat farkına (`Δt`) göre yapılır.

### Tazelik Eşikleri Tablosu

| Veri Katmanı | Referans Alan | Normal (`Δt`) | ⚠️ Uyarı Eşiği (`#F59E0B`) | 🚨 Hata / Çok Eski Eşiği (`#F87171`) |
|---|---|---|---|---|
| **Ülke Verisi (Canlı)** | `snapshot_latest.live.ts` | `< 4 saat` | **`4 – 6 saat`** (`"Ülke verisi 5 saat öncesine ait"`) | **`≥ 6 saat`** (`"Ülke verisi güncel değil (8 saat eski)"`) |
| **Santral Verisi (Harita)** | `snapshot_latest.plants_day.last_hour_ts` | `< 36 saat` | **`36 – 48 saat`** (`"Santral verisi gecikmeli (40 saat eski)"`) | **`≥ 48 saat`** (`"Santral verisi eski (2+ gün)"`) |

### Ekran Durumları
1. **Yükleniyor (Loading State):**
   - Tam ekran bloke edici spinner kullanılmaz (`progressive-loading`).
   - Harita tabanı anında açılır; üst sayaç kartlarında ve grafik alanında `#151F32` → `#1E293B` yumuşak ışıltılı iskelet (skeleton shimmer) kutular gösterilir (`prefers-reduced-motion` aktifse sabit opaklık).
2. **Veri Eski (Stale Data State):**
   - Veri gizlenmez; mevcut son veri ekranda kalır, ancak üst barın hemen altında ilgili eşik renginde (`#F59E0B` sarı-kehribar uyarı veya `#F87171` kırmızı hata) ince bir durum şeridi açılır:
     - Örnek Uyarı: `[⚠️ Ülke verisi 4 saat 49분 öncesine aittir (Son kesinleşmiş saat: 08.11.2026 09:00).]`
3. **Veri Yok / Eksik Alan Durumları (Empty / Partial State):**
   - **Eksik Kaynak (`nuclear` vb.):** `by_source` veya `mix_24h.mw` içinde yer almayan kaynaklar `0 MW` kabul edilir; panel hata vermez. Nükleer kaynak kartı/satırı `"0 MW (Henüz devrede değil)"` olarak soluk gösterilir veya grafikte yer kaplamaz.
   - **PTF `null` Olursa:** Sayaçta `"— TL/MWh (Veri bekleniyor)"` yazar.
   - **Üretimi Olmayan İl:** `provinces_24h.json` listesinde bulunmayan bir ile tıklandığında il panelinde `"0 MWh · Bu ilde seçili günde lisanslı santral üretimi kaydedilmedi"` mesajı gösterilir.
   - **Kurulu Gücü Bilinmeyen Santral (`capacity_mw: null`):** Santral bilgi kartında (tooltip) `"Kurulu güç: Bilinmiyor"` yazar.

---

## 7. Türkçe Sayı Biçimi Örnekleri (`tr-TR`) ve Etiket Kuralları

Tüm sayılar `Intl.NumberFormat('tr-TR')` ile biçimlendirilir: **binlik ayracı nokta (`.`), ondalık ayracı virgül (`,`)**. Yüzde işareti Türkçe yazım kuralına uygun olarak sayının **önüne** (`%59,6`) gelir.

| Veri Alanı | Ham Değer (`sample/`) | `tr-TR` Ekran Gösterimi | Biçimlendirme Kuralı ve Zorunlu Etiket |
|---|---|---|---|
| **Toplam Üretim** | `live.total_mw = 22674` | **`22.674 MW`** | Tam sayı, binlik nokta + altında **`lisanslı üretim`** etiketi |
| **Yenilenebilir Payı** | `live.renewable_share_pct = 59.6` | **`%59,6`** | Ön yüzde işareti, 1 ondalık hane + altında **`lisanslı üretim`** etiketi |
| **Kaynak Üretimi (Rüzgâr)** | `by_source.wind.mw = 4425` | **`4.425 MW`** | Tam sayı, binlik nokta |
| **Akkuyu Eşdeğeri (Rüzgâr)** | `by_source.wind.akkuyu = 3.69` | **`3,69 Akkuyu`** | `mw / 1200`, 2 ondalık hane (`1.33` → `1,33 Akkuyu`; `1.6` → `1,60 Akkuyu` veya `1,6 Akkuyu`) |
| **PTF** | `live.ptf_tl_mwh = 171.0` | **`171,0 TL/MWh`** | 1 (veya kuruş varsa 2) ondalık hane (ör. `3.905,38 TL/MWh`) |
| **Santral Günü Son Saat** | `plants_day.total_mw_last_hour = 38804` | **`38.804 MW`** | Tam sayı + `Santral verisi: 07.11.2026` |
| **İl Günlük Toplam (Çanakkale)** | `total_mwh = 71199`, `share_pct = 8.0` | **`71.199 MWh (%8,0)`** | Tam sayı MWh + 1 ondalık yüzde |
| **Lisanssız Güneş Notu** | `month="2026-09"`, `avg_mw=4583`, `peak_mw=14782` | **`Ort. 4.583 MW · Öğlen tepe 14.782 MW`** | `"Eylül 2026 (aylık gecikmeli veri, sayaçlara dahil değildir)"` |

---

## 8. Önerilen Kütüphaneler ve Gerekçeleri

Kurulum bu aşamada yapılmayacaktır; uygulama aşaması için önerilen teknoloji yığını:

1. **Vite + React 18/19 + TypeScript:**
   - **Gerekçe:** Statik JSON sözleşmeleriyle (`src/types/*.ts`) sıfır çalışma zamanı maliyetiyle tam tip güvenliği sağlar. Sunucu tarafı hesaplama gerekmediği için Vite en hızlı geliştirme ve en küçük statik üretim (bundle) çıktısını verir.
2. **Tailwind CSS + shadcn/ui (Radix UI tabanlı):**
   - **Gerekçe:** Üç katmanlı CSS değişkeni token mimarisini (`--bg-surface`, `--source-solar` vb.) doğrudan sınıflara bağlar. `shadcn/ui` (Dialog/Sheet, Tooltip, Tabs, Slider) bileşenleri WAI-ARIA klavye erişilebilirliğini (`focus-states`, `escape-routes`) hazır getirir ve mobildeki "alttan açılan il paneli" (Bottom Sheet / Drawer) ihtiyacını ek ağırlık olmadan çözer.
3. **deck.gl (`@deck.gl/react`, `@deck.gl/layers`, `@deck.gl/geo-layers`) + MapLibre GL JS (`maplibre-gl`, `react-map-gl/maplibre`):**
   - **Gerekçe:** API anahtarı veya ücret gerektirmeyen açık kaynaklı vektör/raster koyu altlıklarla (ör. Carto Dark Matter No Labels veya kendi koyu stil JSON'umuz + `provinces.geojson`) çalışır. `deck.gl`, 778+ santralin 3B sütunlarını (`ColumnLayer`) ve parlayan noktalarını (`ScatterplotLayer`) WebGL/WebGPU üzerinde 60 fps hızında, saat değişimlerinde GPU tabanlı `transitions` ile pürüzsüzce canlandırır.
4. **Grafik Kütüphanesi Önerisi — Apache ECharts (veya hafif alternatif olarak Recharts):**
   - **Öneri: Recharts (Tercih edilen birincil öneri) vs ECharts karşılaştırması:**
     - **Recharts (Önerilen):** 24 saat × 10 kaynak (`240` veri noktası) SVG için çok küçük bir hacimdir (`charts.csv` eşiği: `< 1.000 nokta → SVG`). React bileşen ağacıyla doğal bütünleşir, paket boyutu ECharts'a göre çok daha küçüktür, özel Türkçe `Tooltip` ve oynatma saati referans çizgisi (`<ReferenceLine x={selectedHour} />`) yazmak son derece basittir.
     - **ECharts (Alternatif):** Canvas tabanlıdır; ileride 365 günlük saatlik (8.760 nokta) yakınlaştırmalı grafik istenirse avantaj sağlar, ancak Sürüm 1'deki 24 saatlik kaynak grafiği ve il mini grafiği için Recharts hem daha hafif hem de shadcn/Tailwind temasıyla daha uyumludur.
5. **İkon Seti — `lucide-react`:**
   - **Gerekçe:** Emoji yerine tutarlı çizgi kalınlığına (`1.75px`) sahip, erişilebilir (`aria-hidden="true"`) SVG ikonlar sağlar.

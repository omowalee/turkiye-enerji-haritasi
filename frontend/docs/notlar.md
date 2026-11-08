# Sürüm 1 (İlk Adım) — Geliştirme ve Paket Notları

## 1. Yapılanlar Özeti

1. **Mevcut Dosyaların Korunması:** `src/types/`, `public/data/sample/` ve `docs/tasarim-onerisi.md` dosyalarına hiç dokunulmadan Vite + React + TypeScript (`strict: true`) + Tailwind CSS v4 iskeleti doğrudan kuruldu.
2. **Tek Veri Yükleme Modülü (`src/lib/data.ts`):** Tüm örnek JSON/GeoJSON dosyaları (`snapshot_latest.json`, `source_labels.json`, `provinces.geojson`, `plants.json`, `generation_24h.json`) tek bir `DATA_BASE_URL = "/data/sample"` sabiti üzerinden okunacak şekilde merkezileştirildi.
3. **Canlı Sayaçlar (`src/components/LiveCounters.tsx`):** `snapshot_latest.live` bloğundan toplam üretim (`22.674 MW`), yenilenebilir payı (`%59,6`), PTF (`171,0 TL/MWh`) ve `source_labels.json` sırasıyla 11 kaynağın her biri için `MW`, `%` pay ve `Akkuyu` eşdeğeri (`3,69 Akkuyu`) `tr-TR` sayı biçimi ve `tabular-nums` ile gösterildi. Eksik `nuclear` kaynağı `0 MW` / `0,00 Akkuyu` olarak hatasız ele alındı.
4. **Harici Tile Servisi Olmadan Harita (`src/components/TurkeyMap.tsx`):** `deck.gl` `GeoJsonLayer` ile `provinces.geojson` kullanılarak Türkiye'nin 81 ili koyu kontrol odası dolgusu (`#0B111E`) ve ince il sınırlarıyla (`#1E293B`) çizildi. Koordinatı olan `778` santral `ScatterplotLayer` ile kaynak renginde ve `generation_24h.json` son saat (`23:00`) üretimine göre ölçeklenen noktalar olarak eklendi; üzerine gelindiğinde santral adı, kaynak, son saat MW, günlük MWh ve kurulu güç gösterildi.
5. **Zorunlu Etiketler, Bilgi Notu ve Atıflar:** Harita sol üst köşesinde `"Santral verisi: 2026-11-07"` rozeti ve `"Lisanssız güneş bilgi notu (Eylül 2026 / 2026-09): Aylık ort. 4.583 MW · Öğlen tepe 14.782 MW"` kutusu; en altta ise `EPİAŞ Şeffaflık Platformu`, `Global Energy Monitor`, `© OpenStreetMap katkıcıları` ve `geoBoundaries` atıfları sabitlendi.

---

## 2. Kurulan Paketler ve Gerekçeleri

### Çalışma Zamanı Bağımlılıkları (`dependencies`)

| Paket | Sürüm | Kurulma Gerekçesi |
|---|---|---|
| `react`, `react-dom` | `^19.0.0` | Panel arayüzü ve bileşen ağacı için temel React kütüphaneleri. |
| `@deck.gl/core` | `^9.1.4` | Harici tile servisi olmadan `MapView` görünümü, koordinat projeksiyonu ve yakınlaştırma/kaydırma kontrolcüsü (`controller`). |
| `@deck.gl/layers` | `^9.1.4` | Türkiye il sınırlarını çizen `GeoJsonLayer` ve santral noktalarını/ışımasını çizen `ScatterplotLayer`. |
| `@deck.gl/react` | `^9.1.4` | `DeckGL` bileşenini React durum yönetimiyle (`viewState`, `onHover`) bütünleştirmek için. |
| `@fontsource/space-grotesk` | `^5.1.1` | Tasarım önerisinde onaylanan başlık ve ana sayaç (`--font-display`) fontunun harici CDN olmadan yerel yüklenmesi (`600`, `700`). |
| `@fontsource/inter` | `^5.1.1` | Arayüz ve etiket (`--font-sans`) fontunun Türkçe (`latin-ext`) destekli yerel paketi (`400`, `500`, `600`). |
| `@fontsource/jetbrains-mono` | `^5.1.1` | Zaman damgaları, PTF ve tablo içi teknik sayılar (`--font-mono`) için yerel monospace font paketi (`400`, `500`, `600`). |
| `lucide-react` | `^0.475.0` | Emoji kullanmadan kontrol odası ikonlarını (`Zap`, `Radio`, `Sun`, `Calendar`, `Plus`, `Minus`, `RotateCcw`) erişilebilir SVG olarak çizmek için. |
| `clsx`, `tailwind-merge`, `class-variance-authority`, `@radix-ui/react-slot` | — | `shadcn/ui` bileşenlerinin (`Card`, `Badge`, `Skeleton`) sınıf birleştirme (`cn`) ve varyant yönetimi altyapısı. |

### Geliştirme Bağımlılıkları (`devDependencies`)

| Paket | Sürüm | Kurulma Gerekçesi |
|---|---|---|
| `vite`, `@vitejs/plugin-react` | `^6.1.0`, `^4.3.4` | Hızlı geliştirme sunucusu (`npm run dev`) ve optimize statik üretim paketi (`npm run build`). |
| `typescript` | `~5.7.2` | `src/types/` altındaki sözleşme tipleriyle `strict: true` modunda tam tip kontrolü (`npm run typecheck`). |
| `tailwindcss`, `@tailwindcss/vite` | `^4.0.6` | Koyu kontrol odası tasarım tokenlarını ve masaüstü/mobil (`390px`) duyarlı yerleşimi sıfır çalışma zamanı maliyetiyle derlemek için. |
| `@types/react`, `@types/react-dom`, `@types/node` | — | React 19 ve Vite yapılandırması için TypeScript tip tanımları. |

---

## 3. Doğrulama ve Test Notları

- **Tip Kontrolü:** `npm run typecheck` (`tsc --noEmit`) 0 hata ile geçti.
- **Üretim Derlemesi:** `npm run build` (`tsc --noEmit && vite build`) hatasız tamamlandı.
- **Masaüstü ve Mobil (`390px`) Kontrolü:**
  - Masaüstünde (`≥ 1024px`) 4 ana KPI kartı tek satırda, altında 11 kaynak kartı tek şeritte, ortada Türkiye haritası (`zoom: 5.45`) ve sol üstte yüzen veri/lisanssız güneş rozetleri yer alır.
  - Mobil genişlikte (`390px`) ana KPI kartları 2×2 ızgaraya, kaynak kartları 2 sütunlu kompakt ızgaraya dönüşür; harita `zoom: 4.05` ile tüm Türkiye'yi yatay taşma olmadan sığdırır ve lisanssız güneş notu `"Detay / Gizle"` düğmesiyle harita alanını kapatmaz.
- **Sözleşme İsteği:** Mevcut `v0.1` veri sözleşmesinde bu aşama için eksik bir alan bulunmamaktadır.

---

## 4. İkinci Adım — 3D Sütunlar (`ColumnLayer`) ve Kamera Kontrolleri

1. **3D Üretim Sütunları (`ColumnLayer`):** Yeni paket kurmadan mevcut `@deck.gl/layers` içindeki `ColumnLayer` kullanılarak koordinatı olan santrallerin üzerine seçili saatteki üretime (`generation_24h.mw[i][selectedHourIndex]`) göre yükselen ve kaynak rengiyle boyanan 3D sütunlar eklendi.
2. **Karekök Yükseklik Ölçeği (`computeColumnElevationMeters`):** `1 MW` ile `~1.912 MW` arasındaki ~1:1900 dinamik aralığı Türkiye ölçeğinde okunabilir kılmak için `4500 + sqrt(MW) * 3200` metre karekök ölçek uygulandı (`0 MW` santraller `0 m` kalır, `5 MW` ~11,6 km ile görünür olur, `1.500 MW` ~128,4 km ile ekrandan taşmadan yükselir).
3. **Eğim, Döndürme ve 2D/3D Geçişi:** Masaüstünde (`>= 768px`) varsayılan `45°` eğim (3D), mobilde (`< 768px`) varsayılan `0°` düz görünüm (2D) ayarlandı; sağ tık veya `Ctrl + sürükle` ile döndürme/eğme (`dragRotate: true`) ve sağ altta `"2D / 3D"` geçiş düğmesi eklendi.
4. **Tek Saat State'i ve Tıklamayla Açılan Santral Kartı:** Seçili saat indeksi (`selectedHourIndex`, şimdilik `23` / `23:00`) `App.tsx` içinde tek bir state'te tutuldu; santrale tıklandığında (`onClick`) ad, kaynak (Türkçe etiket), o saatteki `MW` ve kurulu güç (`null` ise `"bilinmiyor"`) bilgilerini `tr-TR` biçiminde gösteren kart açılacak şekilde güncellendi.

---

## 5. Üçüncü Adım — 24 Saatlik Oynatma ve İki Mod (Canlı / Oynatma)

1. **Mod Seçici ve Görsel Ayrım (`src/components/HeaderBar.tsx`):** Üst barda `"Canlı"` (`#10B981`, yeşil parlayan nokta) ve `"Oynatma (24 saat)"` (`#38BDF8`, mavi oynatma rozeti) mod seçicisi eklendi.
2. **İki Modun Veri Bağlantısı (`src/lib/data.ts`, `src/components/LiveCounters.tsx`):**
   - **Canlı Mod (Varsayılan):** Sayaçlar `snapshot_latest.live` (`live.ts = 08.11.2026 10:00`) verisini gösterir (`live.provisional` gösterilmez); harita `generation_24h` son saatinde (`23:00`) ve `"Santral verisi: 2026-11-07"` etiketiyle durur.
   - **Oynatma Modu:** Sayaçlar, harita ve seçili saat aynı güne (`plants_day.date`) ve aynı saate senkronize olur; toplam MW, yenilenebilir payı (`source_labels.json` `renewable` alanına göre), Akkuyu eşdeğeri (`mw / 1200`) ve PTF (`ptf_tl_mwh[saat]`) `mix_24h.plants_day` serisinden hesaplanır.
3. **24 Saatlik Zaman Çubuğu (`src/components/PlaybackBar.tsx`):** Altta oynat/duraklat, hız seçimi (`1×`, `2×`, `4×`), 24 saat işaretli mini üretim profilli sürüklenebilir imleç ve klavye kısayolları (`Boşluk` = oynat/duraklat, `←`/`→` = 1 saat geri/ileri) eklendi; gün sonunda (`23:00`) başa (`00:00`) sarıp durur, döngüye girmez.
4. **Sinematik 60 FPS Akıcılık (`src/components/ui/animated-value.tsx`, `src/components/TurkeyMap.tsx`):** Sütun yükseklikleri ve nokta yarıçapları `deck.gl` GPU `transitions` (cubic-out, süre = adım süresi) ile yumuşak geçer; sayaç rakamları React yeniden render'ı tetiklemeden doğrudan DOM `requestAnimationFrame` ile yuvarlanarak değişir.

---

## 6. Dördüncü Adım — Görsel Yön Değişikliği: "Türkiye'nin Enerji Işıkları"

1. **Tam Ekran (Full-Bleed) Gece Haritası ve Komşu Ülkeler (`src/components/TurkeyMap.tsx`):** Harita tüm ekranı (`fixed inset-0 h-dvh w-screen`) kaplayacak şekilde derin gece mavisi (`#03060C`), `/geo/neighbors.geojson` (Natural Earth) sönük komşu ülke dolgusu (`#050911`), Türkiye çok koyu il dolgusu (`#080D18`), ince sınırlar ve kenar karartması (vignette) ile yeniden kuruldu.
2. **İki Katmanlı Parlayan Işıklar ve Toplamsal Harmanlama (Varsayılan 2D Görünüm):** Her santral geniş yarıçaplı düşük opaklıklı **Hale** (`plants-halo-layer`) ve merkeze doğru beyaza yakınlaşan parlak **Çekirdek** (`plants-core-layer`) katmanlarıyla çizildi. `@luma.gl/core` `ADDITIVE_BLEND_PARAMETERS` (`src-alpha` + `one`) ile üst üste binen ışıkların parlaklığı toplandı; yarıçap `√MW` ile ölçeklenerek daire alanının doğrudan `MW` ile orantılı olması sağlandı (`0 MW` santraller sönük köz noktası olarak kalır, sabah yanar).
3. **Yenilenen 3D Sütun Görünümü (`≥ 50 MW`):** Sağ alttaki `2D / 3D` düğmesiyle geçilen 3D görünümde kamera `58°` eğim ve biraz daha yakın zoom'a geçer; yalnızca `50 MW ve üstü` santraller doğrusal yükseklik ölçeği (`mw * 75` m) ve `LightingEffect` (`AmbientLight` + 2 `DirectionalLight`) ile sütun olarak yükselir, küçükler parlayan nokta olarak kalır.
4. **Yarı Saydam Koyu Cam Paneller (`TopLeftHud.tsx`, `SourceStrip.tsx`, `InfoDrawer.tsx`, `PlaybackBar.tsx`):**
   - Sol üstte kompakt cam panel: küçük başlık, mod seçici (`Canlı` / `Oynatma`), büyük rakamla toplam MW, yenilenebilir yüzdesi, saat, `"Lisanslı yurt içi üretim"` etiketi ve altında 11 dilimli yatay kaynak şeridi (dilim üzerine gelince kaynak adı, MW, `%` ve Akkuyu eşdeğeri).
   - Sağ üstte tazelik rozeti ve `"i"` bilgi çekmecesi (santral tarihi, lisanssız güneş notu, ölçek açıklaması, santral sayısı ve atıflar).
   - Altta `"Döngü"` (`isLooping`) düğmeli ince oynatma çubuğu; mobilde (`< 768px`) üstte tek satırlık özet ve alttan açılan sayfada kaynak şeridi.

---

## 7. Beşinci Adım — Kaynak Bazlı Minimum Spanning Tree (MST) Ağları

1. **Düz Santral Noktaları ve Halelerin Kaldırılması (`src/lib/visual.ts`, `src/components/TurkeyMap.tsx`):** Haleler ve additive blending kaldırıldı; her santral küçük düz bir nokta olarak (`> 0 MW` için `1,5–4 px` (`√MW`) yarıçap ve `0,9` opaklık; `0 MW` için `1 px` yarıçap ve `0,3` opaklık) en üst katmanda çizildi.
2. **Kaynak Bazlı MST Ağları (`src/lib/network.ts`):** Her enerji kaynağı için ayrı bir Minimum Spanning Tree (Prim algoritması, Haversine `km` mesafesi, `≤ 150 km` eşiği) `useMemo` ile bir kez hesaplandı. Kenarlar `ArcLayer` ile (3D'de hafif yükselen yaylar, 2D'de düz çizgi; önce fosil ağları, üstte yenilenebilir ağları) çizildi; parlaklık (`0,08–0,90` opaklık) ve kalınlık (`0,5–2,5 px`) iki uçtaki santralin o saatteki MW toplamının kaynak maksimumuna oranına göre `400 ms` yumuşak geçişle güncellendi.
3. **Kamera (`fitBounds`), Kaynak Filtresi ve Bilgi Notu:** Masaüstünde varsayılan `45°` 3D eğim ve panel padding'li `WebMercatorViewport.fitBounds` uygulandı (mobilde varsayılan 2D); kaynak şeridinde bir dilime/etikete tıklanınca o kaynağın ağı vurgulanıp diğerlerinin `%15` opaklığa inmesi sağlandı ve `"i"` çekmecesine `"Çizgiler aynı kaynaktaki santralleri görsel olarak birleştirir; gerçek iletim hatlarını göstermez."` notu eklendi.

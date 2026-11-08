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

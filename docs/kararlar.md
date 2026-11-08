# Kararlar

Onaylanan proje kararları. Her aşama başlamadan önce kontrol edilir.

## 2026-11-08 — Aşama 0 sonrası (kaynak: docs/kesif.md §7)

1. **Lisanssız üretim:** Harita ve sayaçlar yalnızca lisanslı gerçek zamanlı üretimi (`rt-gen` / `rt-gen-bulk`) gösterir.
   - Sayaç etiketlerinde açıkça **"lisanslı üretim"** yazar.
   - **Belirgin bir bilgi notu** gösterilir: "Son yayımlanan ayda (AY YIL) lisanssız güneş ortalama ≈ X MW, öğlen tepe ≈ Y MW. Bu üretim gerçek zamanlı veride yer almaz." Kaynak `ren-ul-gen`, aylık güncellenir.
   - Lisanssız güneş tahmini → Sürüm 2'nin ilk maddesi (`docs/yol-haritasi.md`).
2. **Koordinat kaynağı:** GEM GIPT (ana kaynak) + OSM `power=plant` (yedek) + `seeds/plant_match_overrides.csv` (elle düzeltme).
   - Elle düzeltmelere üretime göre **en büyük 200 santralden** başlanır.
3. **Eşleşmeyen üretim payı testi:** ilk aşamada < %15, elle düzeltmelerden sonra < %10.
4. **Tazelik testi:** son veri 3 saatten eskiyse uyarı, 6 saatten eskiyse hata. **2026-11-08 güncellendi:** ülke (kaynak bazlı) verisinde 4 saat uyarı, 6 saat hata. Normal yaş 1,7–2,7 saat, 3 saat çok dar kalıyordu. Santral verisinde 36/48 saat.
5. **İl sınırları:** geoBoundaries TUR ADM1. İl ataması koordinattan nokta-poligon yöntemiyle yapılır.
6. **Lisans ve atıflar:** GEM (CC BY 4.0), OSM (ODbL), geoBoundaries (CC BY-SA 2.0) ve EPİAŞ Şeffaflık Platformu atıfları **README'ye ve panelin altına** eklenir.
   - OSM kökenli koordinat içeren `plants.json` ODbL kapsamındadır.
7. **BigQuery konumu:** `EU` çoklu bölge. Tüm dataset'ler aynı konumda olacak.

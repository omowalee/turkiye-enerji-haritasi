# Yol haritası

## Sürüm 2 (öncelik sırasıyla)

1. **Lisanssız güneş tahmini:** Gecikmeli yayınlanan `ren-ul-gen` aylık verisinden saatlik profil ve kurulu güç büyümesiyle anlık lisanssız güneş tahmini. Panelde tahmin olduğu açıkça belirtilir.
2. Boşa giden enerji (kısıntı) tahmini
3. Sanal türbin ve panel potansiyeli
4. Fiyat tahmini / makine öğrenmesi
5. **Kurulu güç kaynağı:** Santral kurulu gücünü EPİAŞ'ın kendi lisanslı santral verisinden almayı araştır (`lic-pp-list` vb., EPDK lisans kurulu gücü). Sürüm 1'de kurulu güç GEM/OSM konum kaydından geliyor ve yalnızca tek santrale bağlanan kayıtlarda gösteriliyor, diğerlerinde "bilinmiyor" yazıyor.

## Sürüm 2 adayı: il bazında enerji dengesi

Sürüm 1'de yapılmıyor (karar 2026-11-08). Ayrıntılı araştırma: `docs/il-tuketim-kaynaklari.md`.

- **Amaç:** yıllık il üretimi / il tüketimi oranıyla "enerji dengesi" görünümü.
- **Önerilen kaynak:** EPDK 2025 Elektrik Piyasası Gelişim Raporu.
  - Excel Tablo 3: il bazında faturalanan tüketim, 2024 ve 2025.
  - PDF Tablo 1.2 ve 1.8: il bazında lisanslı ve lisanssız brüt üretim.
  - Avantajı: aynı yıl, aynı kaynak ve aynı kapsam.
- **Çapraz kontrol:** EPİAŞ santral verisi (`rt-gen-bulk`) en az 2021'e kadar geriye gidiyor. Bir yıl için yaklaşık 13.500 istek gerekir; EPİAŞ dakikada 80 istek sınırı uyguluyor.
- **Riskler:**
  - Faturalanan tüketim kayıp-kaçağı içermez. Gerçek tüketim 352,5 TWh, faturalanan 288,5 TWh, aradaki fark yaklaşık %18. Etiket "faturalanan tüketim" olmalı.
  - PDF iki sütunlu, ayrıştırması zor.
  - Yeniden dağıtım lisansı doğrulanmadı.
  - TEİAŞ ve TÜİK il tablolarına ulaşılamadı.

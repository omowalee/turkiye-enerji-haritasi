# İl bazında elektrik tüketimi ve üretimi: kaynak araştırması

Tarih: 2026-11-08. Amaç: "yıllık il üretimi / il tüketimi = enerji dengesi" görünümü için kaynak seçmek.
Doğrulama işaretleri: **[doğrulandı]** dosyayı/uç noktayı bu oturumda indirip veya çağırıp gördüm. **[doğrulanamadı]** kanıt bulunamadı veya erişilemedi.

## 1. Özet karar

- Tüketim ve üretimin ikisi için de **tek kaynak: EPDK "2025 Yılı Elektrik Piyasası Gelişim Raporu"** (PDF + Excel eki). Aynı raporda il bazında lisanslı üretim (Tablo 1.2), lisanssız brüt üretim (Tablo 1.8) ve faturalanan tüketim (Tablo 1.14 / Excel Tablo 3) var. Aynı yıl, aynı kurum, aynı kapsam tanımı olduğu için denge yöntemsel olarak tutarlı olur.
- Tüketimde ikinci kaynak (çapraz kontrol ve aylık/güncel veri): EPİAŞ `consumption-quantity` (il × tüketici türü × ay).
- Üretimde EPİAŞ `rt-gen-bulk` ile bir yıllık hesaplama **mümkün** ama yalnızca lisanslı üretimi verir. Resmi EPDK tablosunun doğrulama aracı olarak kullanılmalı, ana kaynak olarak değil.
- TEİAŞ'ın il bazında tüketim veya üretim tablosu yayımladığına dair kanıt bulamadım. TÜİK için tablo bulunamadı (lead var).

## 2. Karşılaştırma tablosu

| Kaynak | Son yıl | Biçim | Ayrıntı düzeyi | Kapsam / tanım | Lisans / kullanım | Ayrıştırma zorluğu |
|---|---|---|---|---|---|---|
| **EPDK Piyasa Gelişim Raporu eki (Excel)**, tüketim | 2025 (2024 ile karşılaştırmalı) [doğrulandı] | xlsx | 81 il ("İl Toplam" satırı her ilde var; İstanbul tek il olarak, Avrupa/Anadolu ayrımı yalnızca PDF Tablo 1.14'te) × 5 tüketici türü (Aydınlatma, Kamu ve Özel Hizmetler ile Diğer, Mesken, Sanayi, Tarımsal Faaliyetler) × yıl | Faturalanan tüketim, MWh. Teknik/teknik olmayan kayıplar ve üretim tesislerinin kendi ihtiyacı dahil değil. Genel toplam 2025 = 288.480 GWh [doğrulandı] | Sayfada açık bir kullanım koşulu bulunamadı, yalnızca "© 2018 EPDK" altbilgisi [doğrulandı]. Yeniden yayın izni **[doğrulanamadı]**. Kamu verisi olarak kaynak göstererek türev kullanım makul, ama yazılı güvence yok | Kolay. `Tablo 3`: il adı yalnızca ilk satırda dolu (ileri doldurma gerekir), "İl Toplam" satırını süz |
| **EPDK Piyasa Gelişim Raporu (PDF)**, üretim | 2025 [doğrulandı] | pdf (tablolar iki sütunlu, metin çıkarımı karışık) | Tablo 1.2: il bazında **lisanslı** üretim (GWh, %); Tablo 1.8: il bazında **brüt lisanssız** üretim (GWh, %); Tablo 1.3/1.6: il bazında lisanslı/lisanssız kurulu güç | Lisanslı = serbest üretim şirketleri, EÜAŞ, İHD ve YİD santralleri. Lisanssız = 6446 sayılı Kanun md. 14 kapsamı, brüt. İkisi toplanırsa lisanslı+lisanssız üretim bulunur. Lisanslı üretimin brüt/net olduğu **[doğrulanamadı]** | Excel ekinde bu tablolar yok (yalnızca Tablo 1-9) [doğrulandı] | Zor. `pdftotext -layout` çıktısında il adı ve değer sütunları kayıyor (Tablo 1.2'de il ve değer eşleşmesi güvenilmez). `pdfplumber` ile sayfa/sütun kırpma veya elle doğrulama gerekir. Tablo 1.8 yalnızca ilk ~40 il olabilir, tamlığı kontrol edilmedi |
| **EPİAŞ Şeffaflık `consumption-quantity`** | Aylık, 2023-06 sorgusu çalıştı; 2026-10 kısmi [doğrulandı] | JSON (REST; eptr2'de `consumption-breakdown`) | İl (82 kimlik, İstanbul Avrupa+Anadolu) × tüketici türü × ay; sütunlar: serbest tüketici / ST hakkı bulunmayan / ST hakkını kullanmayan | Birim doğrulanmadı (MWh gibi görünüyor). Haziran 2025 ülke toplamı 14,66 milyon MWh; EPDK'nın aynı yılın aylık ortalamasından (≈ 24 TWh) düşük, kapsam farkı **[doğrulanamadı]** | Giriş gerekli; hız sınırı **80 istek/dk**, aşınca HTTP 429 [doğrulandı, bu oturumda aldım]. Yeniden yayın şartı **[doğrulanamadı]** (EPİAŞ koşullar sayfasına ulaşılamadı, 429) | Orta. Bir yıl = 12 ay × 82 il = 984 istek (≈ 13 dk hız sınırında). Hat zaten eptr2 kullanıyor |
| **EPİAŞ `unlicensed-generation-amount`** | Çalışıyor, 2024 sorgusu 3 günde 72 satır [doğrulandı] | JSON | Kaynak × saat, **il yok** | Yalnızca YEKDEM kapsamındaki lisanssız santraller | Yukarıdaki gibi | Kolay ama il bazlı olmadığı için denge için işe yaramaz |
| **TEİAŞ yıllık "Türkiye Elektrik Üretim-İletim İstatistikleri"** | 2025 sayfası listede [doğrulandı] | Dosya galerisi (bölüm başlıkları: kurulu güç, üretim-tüketim-kayıplar vb.), dosya adresleri JS ile yükleniyor | Ulusal. İl bazında üretim/tüketim tablosuna dair kanıt **bulunamadı** | — | **[doğrulanamadı]** | İndirme adresi çıkarılamadı (webapi.teias.gov.tr) |
| **TÜİK** | **[doğrulanamadı]** | Veri Portalı | Üstveri: elektrik dağıtım ve üretim İBBS-3 (il) düzeyinde, tüketim dağıtım birimlerine anketle toplanıyor | Tablo bulunamadı | TÜİK erişim belgesi: aşağıdaki bağlantı, şartlar okunmadı | Lead; il tablosunu ancak portal arayüzünde bulabiliriz |
| **ETKB denge tabloları** | **[doğrulanamadı]** | — | Ulusal enerji dengesi, il yok (varsayım, kontrol edilmedi) | — | — | — |

## 3. Öneri

### 3.1 Tüketim: EPDK Excel eki, Tablo 3 (2025)

Neden: tek dosya, 81 il, tüketici türü kırılımı, kurum resmi. Yıl: **2025** (2024 de aynı dosyada, değişim hesabı için).
EPİAŞ `consumption-quantity` ile aylık çapraz kontrol yapılabilir, ama kapsam farkı açıklanmadan ana kaynak yapılmamalı.

### 3.2 Üretim: iki seçenek

| | A) EPDK Tablo 1.2 + 1.8 (resmi) | B) EPİAŞ rt-gen-bulk ile 2025 tam yıl |
|---|---|---|
| Kapsam | Lisanslı + brüt lisanssız | Yalnızca lisanslı |
| Tüketimle yöntem uyumu | Yüksek (aynı rapor, aynı yıl) | Düşük (lisanssız güneş eksik, 2025'te 28,9 TWh) |
| Eşleşme riski | Yok (il bazında hazır) | Santral → il eşleşmesi ≈ %91, kalan %9 il atanamaz |
| Emek | PDF sütun ayrıştırma + elle doğrulama | ~3 saat çekim (aşağıda), dbt tarafında zaten il tablosu var |
| Doğrulama | EPDK ulusal toplamları (lisanslı 325,7 TWh; lisanssız 28,9 TWh) | EPDK Tablo 1.2 ile il il karşılaştır |

**Öneri:** Denge görünümü için A'yı kullan (lisanslı + lisanssız, EPDK). B'yi hem doğrulama hem de panelin mevcut üretim verisiyle tutarlılık kontrolü olarak çalıştır. Panelde yıllık denge "EPDK 2025" etiketiyle gösterilir, saatlik harita ayrıdır.

## 4. EPİAŞ rt-gen-bulk ile bir yıl (Soru C)

Bu oturumda mevcut `pipeline/epias/extract.py` içindeki `fetch_generation_by_plant` ile, 60 santral kimliğiyle yaptığım sorgular [doğrulandı]:

| Tarih | Sonuç |
|---|---|
| 2026-11-06 | 1.296 satır |
| 2025-11-08 | 1.336 satır |
| 2024-08-30 | 1.295 satır |
| 2023-07-27 | 1.320 satır |
| 2021-05-18 | 1.104 satır |

- Geçmiş sınırı en az 2021-05'e kadar çalışıyor, yani bir yıl geri gitmek **mümkün**. Daha eskisi denenmedi.
- Resmi dokümanda alt tarih sınırı yazmıyor; `RealtimeGenerationBulkRequestDto`: `date`, `powerPlantIds` (en fazla 1000, mükerrer olmamalı) (https://seffaflik.epias.com.tr/electricity-service/technical/tr/index.html). Hız sınırı: 80 istek/dk (429 yanıtının gövdesi).
- Hız hesabı: günde ~37 istek (1.688 santral / 50'lik grup), 365 gün ≈ 13.500 istek, 80/dk sınırıyla **en az ~170 dk**. Ölçtüğünüz 29 sn/gün zaten sınıra yakın (37 istek / 29 sn ≈ 77/dk); paralelleştirmek 429 verir. Mevcut 90 gün hariç ~275 gün için ≈ 2,2 saat.
- Satır: yıl başına ≈ 14,7 milyon satır (40 bin × 365). BigQuery'ye yükleme kolay, ama yalnızca günlük/yıllık il toplamı gerekiyorsa ham saatlik tutmaya gerek yok (dbt'de günlük toplamla sınırlı tutulabilir; bu bir öneri, test edilmedi).
- Kapsam: yalnızca lisanslı. Lisanssız üretim santral bazlı yok [kesif.md, EPİAŞ doğrulandı]. Resmi 2025 lisanslı toplam 325,7 TWh; bizim `rt-gen` toplamı gerçek zamanlı ve kesinleşmemiş (UEVM'den farklı olabilir), kesif.md'de belirtilmişti.
- Eşleşme: santrallerin ≈ %91'i ile il bulunuyor. Bu yüzden il toplamlarının toplamı ulusal toplamdan ≈ %9 düşük olur; bu fark denge hesabında "il atanamayan" ayrı satır olarak gösterilmeli.

## 5. Riskler ve tanım farkları

1. **Net/brüt ve kayıplar.** EPDK "faturalanan tüketim" (288,5 TWh) kayıpları ve üretim tesisi iç tüketimini içermez. EPDK "fiili tüketim" 352,5 TWh (= lisanslı üretim + brüt lisanssız üretim + ithalat − ihracat). Aradaki ≈ 64 TWh (≈ %18) kayıp, iç tüketim ve kendi tesisine üretim kısmıdır. İl bazında "üretim − tüketim" farkı bu yüzden pozitif/negatif yanıltıcı olur: faturalanan tüketimle kıyaslamak her ili yapay olarak fazla üretici gösterir. Çözüm: etiket "faturalanan tüketim" kalsın, ya da ilin kayıp payı eklenmeli (il bazında dağıtım şirketi kayıp oranı raporda Tablo 5.2, bölge bazlı, il değil).
2. **Dağıtım bölgesi ≠ il.** Kayıp oranları dağıtım şirketi bölgesine göre; bölgeler il sınırlarını aşabilir. İl düzeyine taşımak varsayım gerektirir.
3. **Lisanssız güneş.** EPDK lisanssız üretim **brüt** (şebekeye verilen artı iç tüketilen), faturalanan tüketim ise sisteme çekilen net tüketimi gösterebilir. Çatı GES olan bir ilde hem üretim hem tüketim çift sayılabilir. Brüt/net uyumu EPDK'dan **[doğrulanamadı]**.
4. **Lisanslı santrallerin kendi tesisine verdiği enerji** faturalanan tüketime girmez (EPDK metni). Organize sanayi bölgesi gibi illerde tüketim eksik görünür.
5. **Yıl uyumu.** Tüketim ve üretim aynı takvim yılı (2025) olmalı. EPİAŞ aylık tüketim son aylarda kısmi (2026-10 yalnızca 0,18 milyon MWh döndü), tam yıl için 2025 kullan.
6. **EPDK rapor revizyonu.** Excel ekinin başındaki not: firmalar bildirim düzeltmesi yapabilir, yayınlanan raporlar arasında fark olabilir [doğrulandı, ekin "İçindekiler" sayfası].
7. **PDF ayrıştırma hatası.** Tablo 1.2 ve 1.8'de sütun kayması var; yanlış il-değer eşleşmesi sessizce hata üretir. Toplamla ve EPDK ulusal toplamıyla doğrulanmalı.
8. **Lisans belirsizliği.** EPDK ve EPİAŞ için yeniden yayın koşulu bulunamadı. Portföy projesi için kaynak göstererek kullanım makul; yine de yazılı kesinlik yok. İstenirse EPDK'ya e-posta ile sorulabilir.

## 6. Kesin indirme adımları

### 6.1 EPDK (tüketim Excel + üretim PDF)

1. Sayfa: https://www.epdk.gov.tr/Detay/Icerik/3-0-24/elektrik-piyasasi-sektor-raporu (2025 satırı).
2. Excel eki (2025): https://www.epdk.gov.tr/Detay/DownloadDocument?id=CTzWPdgnxCU= (doğrudan indirildi, 131.755 bayt, xlsx) [doğrulandı].
3. PDF rapor (2025): https://www.epdk.gov.tr/Detay/DownloadDocument?id=aetLyVmDSsI= (4,17 MB) [doğrulandı].
4. Komut örneği (depo dışına kaydet): `curl -L -o epdk2025.xlsx "https://www.epdk.gov.tr/Detay/DownloadDocument?id=CTzWPdgnxCU="`. Not: belge kimlikleri sayfa güncellenince değişebilir; kalıcı değil.
5. Excel: sayfa `Tablo 3`, `openpyxl` ile; "Tüketici Türü" = "İl Toplam" satırlarını al. "Tüketici Türü" sütununda "Toplam" geçen 82 satır çıkıyor: 81 il + "Genel Toplam" satırı (il sütunu boş); Genel Toplam'ı ayıkla, yoksa iki kat sayarsın. Toplam kontrolü: 2025 için 288.480 GWh.
6. PDF: Tablo 1.2 (sayfa ~25), Tablo 1.8 (sayfa ~37), Tablo 1.14 (sayfa ~42). `pdfplumber` ile sütun kırpma, ardından toplam doğrulaması (lisanslı 325.707 GWh, lisanssız 28.877 GWh).
7. İngilizce sürüm: https://www.epdk.gov.tr/Detay/DownloadDocument?id=fvA3Hww3qBM= (PDF), Excel: id=nZ74LhaG7gU= (açılmadı).

### 6.2 EPİAŞ (isteğe bağlı çapraz kontrol)

1. Hat zaten `EPTR2` istemcisi kullanıyor (`pipeline/epias/extract.py`).
2. Çağrı: `client.call("province-list")` ile 82 kimlik; `client.call("consumption-breakdown", period="2025-06-01T00:00:00+03:00", province_id=<id>)` [doğrulandı, il kimliği 10 = ADANA]. `province_id` verilmezse "Türkiye Geneli" döner.
3. Ay ay (12) × il (82) = 984 istek; **dakikada 80 sınırı**, istekler arasında ≥ 0,8 sn bekle.
4. Bir yıllık santral verisi için mevcut `backfill` işi; 365 gün için ≈ 3 saat.
5. Dokümantasyon: https://seffaflik.epias.com.tr/electricity-service/technical/tr/index.html (şu an 429 verebiliyor; indirilmiş kopya bu oturumda okundu).

## 7. Doğrulanamayanlar

- TEİAŞ'ta il bazlı üretim/tüketim tablosu var mı (dosya listesi JS ile yükleniyor, indirme adresi çıkarılamadı).
- TÜİK'te il bazında elektrik tüketimi tablosu (üstveri İBBS-3 diyor, tablo bulunamadı; Veri Portalı bağlantısı ECONNRESET verdi).
- EPDK, EPİAŞ, TEİAŞ yeniden yayın/lisans koşulları.
- EPİAŞ `consumption-quantity` ile EPDK tüketimi arasındaki kapsam farkı ve birim (MWh varsayımı).
- Tablo 1.2 lisanslı üretimin brüt mü net mi olduğu.
- ETKB denge tablolarında il kırılımı.

## 8. Kaynaklar

- EPDK Elektrik Piyasası Sektör Raporu sayfası: https://www.epdk.gov.tr/Detay/Icerik/3-0-24/elektrik-piyasasi-sektor-raporu
- EPDK 2025 Excel eki: https://www.epdk.gov.tr/Detay/DownloadDocument?id=CTzWPdgnxCU=
- EPDK 2025 rapor PDF: https://www.epdk.gov.tr/Detay/DownloadDocument?id=aetLyVmDSsI=
- EPDK verileri sayfası (kullanım koşulu yok, © 2018): https://www.epdk.gov.tr/Detay/Icerik/3-0-0/elektrik-piyasasi-ile-ilgili-veriler
- EPİAŞ Şeffaflık teknik dokümanı: https://seffaflik.epias.com.tr/electricity-service/technical/tr/index.html
- EPİAŞ API bildirimi (giriş zorunluluğu, 2024): https://www.epias.com.tr/en/announcements/market/electricity/web-service/epias-api-portal-announcement
- TEİAŞ yıllık istatistik sayfası: https://www.teias.gov.tr/turkiye-elektrik-uretim-iletim-istatistikleri
- TÜİK Veri Portalı (arama): https://data.tuik.gov.tr/Search/Search?text=elektrik
- TÜİK bilgi ve veriye erişim: https://www.tuik.gov.tr/media/corporatecontent/bilgi_ve_veriler_erisim.pdf
- Proje içi: `docs/kesif.md` (rt-gen-bulk gecikmesi, lisanssız kapsam)

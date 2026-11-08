# AGENTS.md — Türkiye Enerji Haritası

Bu dosyayı hem Claude Code hem de Antigravity okur. Ortak kurallar burada durur. Araçlara özel ayarlar `.claude/` (Claude Code) ve `.agents/` (Antigravity) klasörlerindedir.

## Proje

Türkiye'deki elektrik santrallerinin saatlik üretimini koyu temalı bir harita panelinde gösteren veri ürünü.
Akış: EPİAŞ API → Python (`pipeline/`) → BigQuery `epias_raw` → dbt Core → `epias_marts` → JSON dışa aktarma → React paneli (`frontend/`).
Sürüm planı ve aşamalar: `prompt-surum1.md`. Güncel durum: `docs/ilerleme.md`. Keşif bulguları: `docs/kesif.md`.

## Kim neyi yapar

| Alan | Araç ve model | Klasörler |
|---|---|---|
| Veri hattı, dbt, Airflow, JSON dışa aktarma, şemalar | Claude Code (Opus 5.5; rutin işlerde Sonnet/Haiku) | `pipeline/`, `dbt/`, `contracts/`, `airflow/`, `scripts/` |
| React paneli, harita, tasarım | Antigravity (Gemini 4 Argon; küçük işlerde Gemini Flash) | `frontend/` |
| Ortak | İki taraf da okur, ilgili bölümü günceller | `docs/ilerleme.md`, `AGENTS.md` |

- İki araç da aynı `a/` klasöründe ve `master` branch'inde çalışır. Worktree ya da ayrı branch kullanılmaz.
- Antigravity yalnızca `a/frontend` klasörünü açar ve yalnızca `frontend/` içine yazar.
- `frontend/src/types/` ve `frontend/public/data/` klasörlerini Claude Code'un scriptleri üretir. Antigravity bunlara dokunmaz.
- `frontend/` içindeki diğer her şeyi Claude Code yalnızca okur. Build ve test çalıştırabilir, kod değiştirmez.
- Antigravity `pipeline/`, `dbt/`, `contracts/`, `scripts/` içinde kod yazmaz.
- Frontend görevleri, Claude Code'un yazdığı tek parça prompt'larla verilir. Kullanıcı bu prompt'u Antigravity'ye yapıştırır.

## Veri sözleşmesi (en önemli kural)

- JSON çıktılarının şekli `contracts/*.schema.json` dosyalarında tanımlıdır. Açıklaması `docs/data-contract.md` dosyasındadır.
- `frontend/src/types/` altındaki TypeScript tipleri şemalardan otomatik üretilir. Elle düzenlenmez.
- Şemaları **sadece veri tarafı** değiştirir. Frontend yeni bir alana ihtiyaç duyarsa `docs/ilerleme.md` içindeki "Sözleşme istekleri" bölümüne not yazar ve bekler.
- Frontend, `frontend/public/data/sample/` altındaki gerçek veriden üretilmiş örnek JSON'larla geliştirilir. Sahte veri uydurulmaz.
- Her frontend commit'inden önce tek doğrulama komutu çalıştırılır: `.venv/Scripts/python -X utf8 -m scripts.check`. Komut sırayla dışa aktarır, şemayla doğrular, tiplerin şemalarla uyumunu kontrol eder, frontend'de tip kontrolü ve build yapar.

## Alınmış ürün kararları

- **Tahmin yok (Sürüm 1).** Panel sadece gerçekleşen veriyi gösterir.
- **Lisanslı üretim.** Gerçek zamanlı veri lisanssız üretimi içermez. Sayaç etiketlerinde açıkça "lisanslı üretim" yazar. Lisanssız güneş için gecikme etiketli bir bilgi notu gösterilir.
- **Tazelik eşikleri.** Ülke verisi için 4 saatte uyarı, 6 saatte hata. Santral verisi için 36 saatte uyarı, 48 saatte hata.
- **Zaman ayrımı.** Kaynak bazlı ülke verisi yaklaşık 1 saat gecikmeli gelir. Santral bazlı veri en erken ertesi gün gelir.
- **İki mod.** Canlı modda sayaçlar ve kaynak grafiği bugünü gösterir, harita en son tam günün son saatinde durur ve "Santral verisi: [tarih]" etiketi taşır. Oynatma modunda sayaçlar, grafik ve harita birlikte en son tam güne geçer.
- **Akkuyu eşdeğeri** = kaynak üretimi (MW) / 1200. Veride nükleer kolonu yoksa panel hata vermez.
- **Kaynak renkleri:** güneş sarı, rüzgâr camgöbeği, hidro mavi, doğalgaz turuncu, kömür gri, nükleer mor. Diğerleri bu palete uyumlu seçilir.
- **Arayüz Türkçe.** Sayılar Türkçe biçimde yazılır: binlik ayracı nokta, ondalık virgül.
- **Atıflar** (README ve panelin altında): EPİAŞ Şeffaflık Platformu, Global Energy Monitor, © OpenStreetMap katkıcıları, geoBoundaries, Natural Earth.

## Güvenlik

- `.env`, servis hesabı JSON anahtarları ve şifreler asla commit'lenmez, prompt'lara yazılmaz, ekrana basılmaz.
- Frontend hiçbir sır kullanmaz. Sadece dışa aktarılmış JSON'ları okur.
- **Geri alınamayan ya da yıkıcı işlemler önce kullanıcıya sorulur:** BigQuery'de tablo veya dataset silme, süreç sonlandırma (kill/TaskStop), dosya veya klasör silme, push. Ajanın kendi oluşturduğu nesneler de buna dahildir.
- Arka planda zincirlenmiş shell komutları bırakılmaz. Her komut bitmeden oturum ya da görev kapatılmaz.

## Git

- **Bütün commit'leri Claude Code atar. Antigravity git kullanmaz.**
- Frontend değişiklikleri ayrı commit'lerle atılır. Kullanıcı "frontend bitti" dediğinde Claude Code şu sırayı izler:
  1. Değişen dosyaların yalnızca `frontend/` içinde olduğunu kontrol eder.
  2. `scripts.check` komutunu çalıştırır.
  3. Commit atar.
  4. `docs/ilerleme.md`'yi günceller.
- Araç değiştirmeden önce commit atılır. Commit'ten önce `git status` gösterilir.
- Kullanıcı istemedikçe merge ve push yapılmaz.
- Sözleşme değişiklikleri kendi commit'inde, net bir mesajla gönderilir.

## Çalışma ilkeleri

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

### 1. Think before coding
Don't assume. Don't hide confusion. Surface tradeoffs.
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them; don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity first
Minimum code that solves the problem. Nothing speculative.
- No features beyond what was asked. No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

### 3. Surgical changes
Touch only what you must. Clean up only your own mess.
- Don't "improve" adjacent code, comments, or formatting. Don't refactor things that aren't broken.
- Match existing style. If you notice unrelated dead code, mention it; don't delete it.
- Remove imports/variables/functions that your changes made unused; leave pre-existing dead code unless asked.
- Every changed line should trace directly to the user's request.

### 4. Goal-driven execution
Define success criteria. Loop until verified.
- "Add validation" → write tests for invalid inputs, then make them pass.
- "Fix the bug" → write a test that reproduces it, then make it pass.
- For multi-step tasks, state a brief plan: `1. [Step] → verify: [check]`.

## Bir oturumu bitirirken

`docs/ilerleme.md` içinde kendi bölümünü güncelle: ne yapıldı, ne doğrulandı, açık sorular, sıradaki adım. Limit dolmak üzereyse `handoff` skill'iyle devir notu yaz.

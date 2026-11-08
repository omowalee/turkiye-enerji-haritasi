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

- Claude Code `frontend/` içinde kod yazmaz. Antigravity `pipeline/`, `dbt/`, `contracts/` içinde kod yazmaz.
- Paralel çalışma git worktree ile yapılır: veri tarafı `a` klasöründe (`master`), frontend `a-frontend` klasöründe (`frontend` branch).

## Veri sözleşmesi (en önemli kural)

- JSON çıktılarının şekli `contracts/*.schema.json` dosyalarında tanımlıdır. Açıklaması `docs/data-contract.md` dosyasındadır.
- `frontend/src/types/` altındaki TypeScript tipleri şemalardan otomatik üretilir. Elle düzenlenmez.
- Şemaları **sadece veri tarafı** değiştirir. Frontend yeni bir alana ihtiyaç duyarsa `docs/ilerleme.md` içindeki "Sözleşme istekleri" bölümüne not yazar ve bekler.
- Frontend, `frontend/public/data/sample/` altındaki gerçek veriden üretilmiş örnek JSON'larla geliştirilir. Sahte veri uydurulmaz.
- Her birleştirmeden (merge) sonra tek doğrulama komutu çalıştırılır: dışa aktar → şemayla doğrula → frontend tip kontrolü ve build.

## Alınmış ürün kararları

- **Tahmin yok (Sürüm 1).** Panel sadece gerçekleşen veriyi gösterir.
- **Lisanslı üretim.** Gerçek zamanlı veri lisanssız üretimi içermez. Sayaç etiketlerinde açıkça "lisanslı üretim" yazar. Lisanssız güneş için gecikme etiketli bir bilgi notu gösterilir.
- **Zaman ayrımı.** Kaynak bazlı ülke verisi yaklaşık 1 saat gecikmeli gelir. Santral bazlı veri en erken ertesi gün gelir.
- **İki mod.** Canlı modda sayaçlar ve kaynak grafiği bugünü gösterir, harita en son tam günün son saatinde durur ve "Santral verisi: [tarih]" etiketi taşır. Oynatma modunda sayaçlar, grafik ve harita birlikte en son tam güne geçer.
- **Akkuyu eşdeğeri** = kaynak üretimi (MW) / 1200. Veride nükleer kolonu yoksa panel hata vermez.
- **Kaynak renkleri:** güneş sarı, rüzgâr camgöbeği, hidro mavi, doğalgaz turuncu, kömür gri, nükleer mor. Diğerleri bu palete uyumlu seçilir.
- **Arayüz Türkçe.** Sayılar Türkçe biçimde yazılır: binlik ayracı nokta, ondalık virgül.
- **Atıflar** (README ve panelin altında): EPİAŞ Şeffaflık Platformu, Global Energy Monitor, © OpenStreetMap katkıcıları, geoBoundaries.

## Güvenlik

- `.env`, servis hesabı JSON anahtarları ve şifreler asla commit'lenmez, prompt'lara yazılmaz, ekrana basılmaz.
- Frontend hiçbir sır kullanmaz. Sadece dışa aktarılmış JSON'ları okur.

## Git

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

# CLAUDE.md

@AGENTS.md

## Claude Code'a özel

- Senin alanın veri tarafı: `pipeline/`, `dbt/`, `contracts/`, `airflow/`, `scripts/`. `frontend/` içinde kod yazma.
- Ajanlar: dbt işleri için `dbt-analytics-engineer`, veri hattı ve Airflow için `data-engineer`, Python modülleri için `python-pro`.
- Frontend işi için kullanıcıya Antigravity'ye yapıştıracağı tek parça bir prompt yazılır. Prompt şu sırayla yazılır:
  1. amaç
  2. okunacak dosyalar (sözleşme, tipler, örnek veri yolu)
  3. yapılacaklar
  4. dokunulmayacaklar
  5. "git kullanma" uyarısı
  6. bitiş ölçütü (`npm run typecheck` ve `npm run build`)
  7. "ne yaptığını 5 satırda özetle"
- Model kullanımı: Mimari kararlar, dbt modelleri ve santral eşleştirme gibi zor işler Opus'ta yapılır. Rutin kod, git ve basit debug işlerinde kullanıcıya `/model sonnet` veya `/model haiku` öner.
- Antigravity'nin yazdığı kodu incelemen istenirse `code-review` skill'ini kullan. İnceleme ölçütü `AGENTS.md` ve `docs/data-contract.md` dosyalarıdır.

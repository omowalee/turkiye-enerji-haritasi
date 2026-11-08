# CLAUDE.md

@AGENTS.md

## Claude Code'a özel

- Senin alanın veri tarafı: `pipeline/`, `dbt/`, `contracts/`, `airflow/`, `scripts/`. `frontend/` içinde kod yazma.
- Ajanlar: dbt işleri için `dbt-analytics-engineer`, veri hattı ve Airflow için `data-engineer`, Python modülleri için `python-pro`. Frontend işini Antigravity'ye devretmek gerekirse `antigravity-frontend` ajanı kullanılabilir. Kullanıcı Antigravity'yi doğrudan da açabilir.
- Model kullanımı: Mimari kararlar, dbt modelleri ve santral eşleştirme gibi zor işler Opus'ta yapılır. Rutin kod, git ve basit debug işlerinde kullanıcıya `/model sonnet` veya `/model haiku` öner.
- Antigravity'nin yazdığı kodu incelemen istenirse `code-review` skill'ini kullan. İnceleme ölçütü `AGENTS.md` ve `docs/data-contract.md` dosyalarıdır.

"""Tek doğrulama komutu: dışa aktar -> şemayla doğrula -> TS tipleri senkron mu -> frontend typecheck + build.

Çalıştırma:  .venv/Scripts/python -X utf8 -m scripts.check [--skip-export] [--root PATH]
Herhangi bir adım başarısız olursa çıkış kodu sıfırdan farklıdır.
"""

import argparse
import shutil
import subprocess
import sys
from pathlib import Path

DEFAULT_ROOT = Path(__file__).resolve().parent.parent
NPM = shutil.which("npm") or "npm"


def run(cmd, cwd) -> tuple[bool, str]:
    r = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    return r.returncode == 0, (r.stdout + r.stderr).strip()


def snapshot(d: Path) -> dict:
    return {p.name: p.read_bytes() for p in sorted(d.glob("*.ts"))} if d.exists() else {}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--skip-export", action="store_true", help="BigQuery'ye gitme, sadece mevcut örnekleri doğrula")
    ap.add_argument("--root", type=Path, default=DEFAULT_ROOT)
    a = ap.parse_args()
    root = a.root.resolve()
    skip = a.skip_export
    if not skip and not (root / ".env").is_file():
        print(f"[bilgi] {root / '.env'} yok (BigQuery kimliği yok); dışa aktarma atlanıyor, sadece doğrulama yapılacak.")
        skip = True
    py = [sys.executable, "-X", "utf8", "-m", "scripts.export_sample"]
    results: list[tuple[str, bool, str]] = []

    def step(name, ok, msg, log=""):
        results.append((name, ok, msg))
        print(f"[{'TAMAM' if ok else 'HATA '}] {name}: {msg}")
        if not ok and log:
            print("\n".join("    " + ln for ln in log.splitlines()[-25:]))

    if skip:
        step("1) dışa aktarma", True, "atlandı (--skip-export / veri yok)")
    else:
        ok, log = run(py, root)
        step("1) dışa aktarma", ok, "örnek JSON'lar üretildi ve şemaya uydu" if ok else "dışa aktarma veya doğrulama başarısız", log)

    ok, log = run(py + ["--validate-only"], root)
    step("2) şema doğrulama", ok, "tüm örnek dosyalar ve source_labels şemaya uyuyor" if ok else "şemaya uymayan dosya var", log)

    types = root / "frontend" / "src" / "types"
    before = snapshot(types)
    ok, log = True, ""
    if not (root / "contracts" / "node_modules").is_dir():
        ok, log = run([NPM, "ci"], root / "contracts")
    if ok:
        ok, log = run([NPM, "run", "gen:types"], root / "contracts")
    if ok:
        after = snapshot(types)
        diff = sorted(n for n in before.keys() | after.keys() if before.get(n) != after.get(n))
        ok, log = not diff, "farklı dosyalar: " + ", ".join(diff)
    step("3) TS tipleri", ok, "tipler şemalarla senkron" if ok else "tipler şemalarla senkron DEĞİL (yeniden üretildi, commit'e ekle)", "" if ok else log)

    fe = root / "frontend"
    if not (fe / "package.json").exists():
        step("4) frontend", True, "frontend yok, atlandı")
    else:
        ok, log = True, ""
        if not (fe / "node_modules").is_dir():
            ok, log = run([NPM, "ci"], fe)
        for script in ("typecheck", "build"):
            if ok:
                ok, log = run([NPM, "run", script], fe)
                if not ok:
                    log = f"npm run {script} başarısız\n" + log
        step("4) frontend", ok, "typecheck ve build geçti" if ok else "typecheck/build başarısız", log)

    bad = [n for n, ok, _ in results if not ok]
    print("\nSONUÇ: " + ("hepsi geçti" if not bad else "BAŞARISIZ -> " + ", ".join(bad)))
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())

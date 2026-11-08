#!/usr/bin/env bash
# dbt sarmalayıcı: .env'i python-dotenv ile yükler (yorum ve Türkçe karakterlerde güvenli), dbt'yi dbt/ içinde çalıştırır.
# Kullanım: ./scripts/dbt.sh build --select stg_epias__power_plants
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/dbt" || exit 1
exec "$ROOT/.venv/Scripts/python" -X utf8 -c '
import os, subprocess, sys
from dotenv import load_dotenv
root = sys.argv[1]
load_dotenv(os.path.join(root, ".env"), encoding="utf-8")
os.environ["PYTHONUTF8"] = "1"
dbt = os.path.join(root, ".venv", "Scripts", "dbt.exe")
sys.exit(subprocess.call([dbt, *sys.argv[2:], "--profiles-dir", "."]))
' "$ROOT" "$@"

#!/usr/bin/env bash
# Git Bash için ince sarmalayıcı: ./scripts/check.sh [--skip-export] [--root PATH]
cd "$(dirname "$0")/.." || exit 1
exec .venv/Scripts/python -X utf8 -m scripts.check "$@"

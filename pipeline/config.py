"""Ortak ayarlar. Tüm modüller kimlik bilgilerini ve sabitleri buradan alır."""

import os
from pathlib import Path
from zoneinfo import ZoneInfo

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env", encoding="utf-8")

TZ = ZoneInfo("Europe/Istanbul")  # Türkiye 2016'dan beri sabit +03:00, yaz saati yok

EPIAS_USERNAME = os.environ.get("EPIAS_USERNAME", "")
EPIAS_PASSWORD = os.environ.get("EPIAS_PASSWORD", "")

GCP_PROJECT_ID = os.environ.get("GCP_PROJECT_ID", "")
BQ_LOCATION = "EU"
RAW_DATASET = "epias_raw"
GEO_DATASET = "geo_raw"

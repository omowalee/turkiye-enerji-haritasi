"""build/publish/ içindeki JSON dosyalarını GCS kovasına yükler.

Kimlik: yalnızca /run/secrets/publisher.json (kovaya yazma yetkili ayrı hesap; BigQuery anahtarı ASLA kullanılmaz).
GCS_BUCKET ya da anahtar yoksa "yayın atlandı" yazıp 0 ile çıkar (yerel çalıştırma bozulmaz).
Her dosya gzip'lenir ve Content-Encoding: gzip ile yüklenir. snapshot_latest.json en son yüklenir:
istemci yeni snapshot'ı gördüğünde ona bağlı dosyalar zaten yerindedir.

Çalıştırma:  python -m scripts.publish [--dir build/publish]
"""

import argparse
import gzip
import logging
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_DIR = ROOT / "build" / "publish"
KEY_PATH = Path(os.environ.get("PUBLISHER_KEY", "/run/secrets/publisher.json"))
LAST = "snapshot_latest.json"
SHORT_CACHE = {"snapshot_latest.json", "mix_24h.json"}  # sık değişenler: 5 dk
CONTENT_TYPES = {".json": "application/json", ".geojson": "application/geo+json"}

log = logging.getLogger("publish")


def upload_order(files: list[Path]) -> list[Path]:
    return sorted((f for f in files if f.name != LAST), key=lambda p: p.name) + [f for f in files if f.name == LAST]


def cache_control(name: str) -> str:
    return "public, max-age=300" if name in SHORT_CACHE else "public, max-age=3600"


def publish(bucket, files: list[Path]) -> int:
    for f in upload_order(files):
        blob = bucket.blob(f.name)
        blob.content_encoding = "gzip"
        blob.cache_control = cache_control(f.name)
        blob.upload_from_string(gzip.compress(f.read_bytes(), 9), content_type=CONTENT_TYPES[f.suffix])
        log.info("yüklendi: %s", f.name)
    return len(files)


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir", type=Path, default=DEFAULT_DIR)
    a = ap.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    name = os.environ.get("GCS_BUCKET", "").strip()
    if not name or not KEY_PATH.is_file():
        log.info("yayın atlandı (GCS_BUCKET %s, anahtar %s)", "var" if name else "yok",
                 "var" if KEY_PATH.is_file() else "yok")
        return 0
    files = [p for p in a.dir.iterdir() if p.suffix in CONTENT_TYPES]
    if not any(f.name == LAST for f in files):
        log.error("%s yok, yayın yapılmadı", LAST)
        return 1

    from google.cloud import storage
    client = storage.Client.from_service_account_json(str(KEY_PATH))
    log.info("%d dosya yayımlandı", publish(client.bucket(name), files))
    return 0


if __name__ == "__main__":
    sys.exit(main())

"""Referans veriler -> geo_raw. Kullanım: python -m pipeline.jobs.load_reference"""

import logging
import sys

from pipeline.bq.client import ensure_datasets, get_client
from pipeline.reference import gem, osm, provinces

log = logging.getLogger("load_reference")


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    client = get_client()
    ensure_datasets(client)
    failed = 0
    for name, mod in (("gem_plants", gem), ("provinces", provinces), ("osm_plants", osm)):
        try:
            log.info("%s: %d satır", name, mod.load(client))
        except Exception:
            failed += 1
            log.exception("%s HATA", name)
    if not failed:
        got = provinces.check_point(client, 38.35, 36.98)  # Afşin-Elbistan
        log.info("Afşin-Elbistan noktası -> %s", got)
        if got != ["Kahramanmaraş"]:
            log.error("il kontrolü başarısız")
            failed += 1
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())

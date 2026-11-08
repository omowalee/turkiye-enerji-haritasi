"""Geçmiş yükleme. Kullanım: python -m pipeline.jobs.backfill --days 90 [--force]

Gün gün, en eskiden başlar; load_log'da tamam olan günler atlanır (çökme sonrası devam).
Pencere dünde biter (bugünü ingest işi yükler).
"""

import argparse
import logging
import sys
import time
from datetime import timedelta

from pipeline.bq.client import ensure_tables, get_client
from pipeline.bq.load import complete_days, local_today, window_start
from pipeline.jobs.ingest import DAILY, load_day, load_power_plants, load_unlicensed

log = logging.getLogger("backfill")


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=90)
    ap.add_argument("--force", action="store_true", help="tamam olan günleri de yeniden yükle")
    ap.add_argument("--sleep", type=float, default=2.0, help="günler arası bekleme (sn)")
    args = ap.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    client = get_client()
    ensure_tables(client)
    today = local_today()
    days = [today - timedelta(days=i) for i in range(args.days, 0, -1)]  # eskiden yeniye
    done = {t: (set() if args.force else complete_days(client, t)) for t in DAILY}
    failed = 0

    for i, day in enumerate(days, 1):
        t0, parts = time.time(), []
        for table in DAILY:
            if day.isoformat() in done[table]:
                parts.append(f"{table}=atlandı")
                continue
            try:
                parts.append(f"{table}={load_day(client, table, day)}")
            except Exception:
                failed += 1
                parts.append(f"{table}=HATA")
                log.exception("%s %s", table, day)
        log.info("[%d/%d] %s %s (%.0f sn)", i, len(days), day, " ".join(parts), time.time() - t0)
        time.sleep(args.sleep)

    try:
        log.info("power_plants: %d satır", load_power_plants(client))
        log.info("unlicensed_generation: %d satır",
                 load_unlicensed(client, window_start(days[0], 1), today))
    except Exception:
        failed += 1
        log.exception("power_plants/unlicensed HATA")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())

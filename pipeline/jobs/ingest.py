"""EPİAŞ -> BigQuery raw. Kullanım: python -m pipeline.jobs.ingest [--date YYYY-MM-DD]

Varsayılan: bugün ve dün (yerel) için kaynak, tüketim ve PTF, yalnızca dün için santral
(EPİAŞ santral verisini ertesi gün yayımlıyor); santral listesi günde bir kez;
lisanssız üretim son 3 ay.
"""

import argparse
import logging
import sys
from datetime import date, timedelta

from pipeline.bq.client import ensure_tables, get_client
from pipeline.bq.load import (add_local_date, complete_days, is_day_complete, local_today,
                              log_load, months_between, next_month, replace_partition,
                              window_start)
from pipeline.epias import extract

log = logging.getLogger("ingest")

# tablo -> day alıp DataFrame döndüren fonksiyon adı
DAILY = {
    "realtime_generation_plant": "fetch_generation_by_plant",
    "realtime_generation_source": "fetch_generation_by_source",
    "realtime_consumption": "fetch_consumption",
    "market_clearing_price": "fetch_mcp",
}


def load_day(client, table: str, day: date, today: date | None = None) -> int:
    df = getattr(extract, DAILY[table])(day)
    if df is None or df.empty:
        log.warning("%s %s: veri yok, bölüm değiştirilmedi", table, day)
        return 0
    df = add_local_date(df)
    df = df[df["date_local"] == day]  # yalnızca bu yerel günün satırları
    if df.empty:
        log.warning("%s %s: yerel güne ait satır yok", table, day)
        return 0
    n = replace_partition(client, table, df, day)
    log_load(client, table, day.isoformat(), n, is_day_complete(df, day, today))
    return n


def load_power_plants(client, today: date | None = None) -> int:
    today = today or local_today()
    if today.isoformat() in complete_days(client, "power_plants"):
        log.info("power_plants %s: zaten yüklü", today)
        return 0
    df = extract.fetch_power_plants()
    df["snapshot_date"] = today
    n = replace_partition(client, "power_plants", df, today)
    log_load(client, "power_plants", today.isoformat(), n, True)
    return n


def load_unlicensed(client, start: date, end: date) -> int:
    """[start, end] penceresini aylık bölümler hâlinde yükler (boş ay atlanır)."""
    df = extract.fetch_unlicensed_generation(start, end)
    if df is None or df.empty:
        log.warning("unlicensed_generation %s..%s: yayımlanmış veri yok", start, end)
        return 0
    df = add_local_date(df)
    total, today = 0, local_today()
    for month in months_between(start, end):
        part = df[(df["date_local"].map(lambda d: (d.year, d.month)) == (month.year, month.month))]
        if part.empty:
            continue
        n = replace_partition(client, "unlicensed_generation", part, month, monthly=True)
        month_end = next_month(month)
        hours = (month_end - month).days * 24
        log_load(client, "unlicensed_generation", month.strftime("%Y-%m"), n,
                 month_end <= today and part["ts"].nunique() == hours)
        total += n
        log.info("unlicensed_generation %s: %d satır", month.strftime("%Y-%m"), n)
    return total


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--date", type=date.fromisoformat, help="yalnızca bu yerel gün")
    args = ap.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    client = get_client()
    ensure_tables(client)
    today = local_today()
    days = [args.date] if args.date else [today - timedelta(days=1), today]
    failed = 0

    def step(name, fn, *a):
        nonlocal failed
        try:
            log.info("%s: %d satır", name, fn(*a))
        except Exception:
            failed += 1
            log.exception("%s HATA", name)

    step("power_plants", load_power_plants, client)
    for day in days:
        for table in DAILY:
            # EPİAŞ santral bazlı veriyi en erken ertesi gün veriyor (hata SEF1149).
            if table == "realtime_generation_plant" and day >= today:
                log.info("%s %s: santral verisi ertesi gün yayımlanır, atlandı", table, day)
                continue
            step(f"{table} {day}", load_day, client, table, day)
    ref = args.date or today
    step("unlicensed_generation", load_unlicensed, client, window_start(ref, 3), ref)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())

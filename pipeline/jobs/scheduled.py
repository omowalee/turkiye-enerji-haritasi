"""Airflow DAG'larının çağırdığı küçük komutlar. Kullanım: python -m pipeline.jobs.scheduled <komut>

  country        bugün ve dün (kaynak, PTF, tüketim) + son N günde eksik olanlar (load_log'a göre)
  plant-check    son N günde santral günü eksikse 0, hepsi tamamsa 99 (Airflow'da atlanır)
  plant-ingest   eksik santral günlerini yükler; yeni tam gün oluştuysa 0, oluşmadıysa 99
  lookback       dbt lookback_hours değerini yazar (son başarılı dbt'den bu yana saat, 48..168)
  mark-ok        başarılı çalışmayı durum dosyasına işler
  refs           santral listesi + lisanssız üretim (günlük DAG)

N (gap günleri) = son başarıdan bu yana geçen güne göre 3..7. Durum dosyası: build/state/last_ok.json.
99 çıkış kodu BashOperator'da "atla" anlamına gelir (skip_on_exit_code).
"""

import json
import logging
import math
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
STATE = ROOT / "build" / "state" / "last_ok.json"
SKIP = 99
MIN_LOOKBACK, MAX_LOOKBACK = 48, 168
MIN_DAYS, MAX_DAYS = 3, 7
PLANT = "realtime_generation_plant"

log = logging.getLogger("scheduled")


def hours_since_ok(now: datetime | None = None, path: Path = STATE) -> float | None:
    try:
        last = datetime.fromisoformat(json.loads(path.read_text(encoding="utf-8"))["at"])
    except (OSError, ValueError, KeyError):
        return None
    return ((now or datetime.now(timezone.utc)) - last).total_seconds() / 3600


def lookback_hours(hours: float | None) -> int:
    """Durum yoksa en geniş pencere; aksi halde geçen süre (üste yuvarlanmış), 48..168 arası."""
    if hours is None:
        return MAX_LOOKBACK
    return max(MIN_LOOKBACK, min(MAX_LOOKBACK, math.ceil(hours)))


def gap_days(hours: float | None) -> int:
    if hours is None:
        return MAX_DAYS
    return max(MIN_DAYS, min(MAX_DAYS, math.ceil(hours / 24) + 1))


def mark_ok(path: Path = STATE) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({"at": datetime.now(timezone.utc).isoformat()}), encoding="utf-8")


def missing_days(done: set[str], today: date, n: int, first_offset: int) -> list[date]:
    """today-first_offset .. today-n günlerinden load_log'da tamam olmayanlar (eskiden yeniye)."""
    days = [today - timedelta(days=i) for i in range(n, first_offset - 1, -1)]
    return [d for d in days if d.isoformat() not in done]


def _clients():
    from pipeline.bq.client import ensure_tables, get_client
    c = get_client()
    ensure_tables(c)
    return c


def cmd_country() -> int:
    from pipeline.bq.load import complete_days, local_today
    from pipeline.jobs.ingest import DAILY, load_day
    client, today, failed = _clients(), local_today(), 0
    n = gap_days(hours_since_ok())
    tables = [t for t in DAILY if t != PLANT]
    for table in tables:
        done = complete_days(client, table)
        # dün ve bugün her seferinde yenilenir (EPİAŞ son saatleri revize eder); daha eskiler yalnızca eksikse
        days = missing_days(done, today, n, first_offset=2) + [today - timedelta(days=1), today]
        for day in days:
            try:
                log.info("%s %s: %d satır", table, day, load_day(client, table, day))
            except Exception:
                failed += 1
                log.exception("%s %s HATA", table, day)
    return 1 if failed else 0


def _missing_plant_days(client) -> list[date]:
    from pipeline.bq.load import complete_days, local_today
    return missing_days(complete_days(client, PLANT), local_today(), gap_days(hours_since_ok()), first_offset=1)


def cmd_plant_check() -> int:
    missing = _missing_plant_days(_clients())
    log.info("eksik santral günleri: %s", [d.isoformat() for d in missing] or "yok")
    return 0 if missing else SKIP


def cmd_plant_ingest() -> int:
    from pipeline.bq.load import complete_days
    from pipeline.jobs.ingest import load_day
    client, failed = _clients(), 0
    missing = _missing_plant_days(client)
    for day in missing:
        try:
            log.info("%s %s: %d satır", PLANT, day, load_day(client, PLANT, day))
        except Exception:
            failed += 1
            log.exception("%s %s HATA", PLANT, day)
    if failed:
        return 1
    now_done = complete_days(client, PLANT)
    new = [d for d in missing if d.isoformat() in now_done]
    log.info("yeni tam santral günü: %s", [d.isoformat() for d in new] or "yok")
    return 0 if new else SKIP


def cmd_refs() -> int:
    from pipeline.bq.load import local_today, window_start
    from pipeline.jobs.ingest import load_power_plants, load_unlicensed
    client, today, failed = _clients(), local_today(), 0
    for name, fn, args in (("power_plants", load_power_plants, ()),
                           ("unlicensed_generation", load_unlicensed, (window_start(today, 3), today))):
        try:
            log.info("%s: %d satır", name, fn(client, *args))
        except Exception:
            failed += 1
            log.exception("%s HATA", name)
    return 1 if failed else 0


def main(argv=None) -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    cmd = (argv if argv is not None else sys.argv[1:])[:1]
    if cmd == ["lookback"]:
        print(lookback_hours(hours_since_ok()))
        return 0
    if cmd == ["mark-ok"]:
        mark_ok()
        return 0
    table = {"country": cmd_country, "plant-check": cmd_plant_check,
             "plant-ingest": cmd_plant_ingest, "refs": cmd_refs}
    if not cmd or cmd[0] not in table:
        print(__doc__)
        return 2
    return table[cmd[0]]()


if __name__ == "__main__":
    sys.exit(main())

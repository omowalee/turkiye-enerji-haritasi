from datetime import date, datetime, timezone

import pandas as pd

from pipeline.bq.load import (add_local_date, is_day_complete, months_between, next_month,
                              partition_id, window_start)


def _hours(day_local: date, n=24):
    # yerel 00:00 = önceki gün 21:00 UTC
    start = pd.Timestamp(day_local.isoformat(), tz="Europe/Istanbul").tz_convert("UTC")
    return pd.DataFrame({"ts": [start + pd.Timedelta(hours=i) for i in range(n)]})


def test_local_day_spans_two_utc_days_but_one_local_date():
    df = add_local_date(_hours(date(2026, 11, 6)))
    assert {t.date() for t in df["ts"]} == {date(2026, 11, 5), date(2026, 11, 6)}
    assert set(df["date_local"]) == {date(2026, 11, 6)}
    assert partition_id(date(2026, 11, 6)) == "20261106"


def test_naive_ts_treated_as_utc():
    df = add_local_date(pd.DataFrame({"ts": [datetime(2026, 11, 5, 21)]}))
    assert df["date_local"].iloc[0] == date(2026, 11, 6)


def test_partition_id_monthly():
    assert partition_id(date(2026, 3, 1), monthly=True) == "202603"


def test_is_day_complete():
    day, today = date(2026, 11, 6), date(2026, 11, 8)
    assert is_day_complete(_hours(day), day, today)
    assert not is_day_complete(_hours(day, 23), day, today)
    assert not is_day_complete(_hours(today), today, today)  # bugün asla tamam değil


def test_month_windows():
    assert window_start(date(2026, 11, 8), 3) == date(2026, 9, 1)
    assert window_start(date(2026, 2, 8), 3) == date(2025, 12, 1)
    assert next_month(date(2025, 12, 1)) == date(2026, 1, 1)
    assert months_between(date(2025, 11, 20), date(2026, 1, 5)) == [
        date(2025, 11, 1), date(2025, 12, 1), date(2026, 1, 1)]

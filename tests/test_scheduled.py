from datetime import date, datetime, timedelta, timezone

from pipeline.jobs import scheduled as s


def test_lookback_bounds():
    assert s.lookback_hours(None) == 168
    assert s.lookback_hours(1.2) == 48
    assert s.lookback_hours(100.2) == 101
    assert s.lookback_hours(500) == 168


def test_gap_days_bounds():
    assert s.gap_days(None) == 7
    assert s.gap_days(2) == 3
    assert s.gap_days(80) == 5
    assert s.gap_days(900) == 7


def test_state_roundtrip(tmp_path):
    p = tmp_path / "x" / "last_ok.json"
    assert s.hours_since_ok(path=p) is None
    s.mark_ok(p)
    h = s.hours_since_ok(now=datetime.now(timezone.utc) + timedelta(hours=5), path=p)
    assert 4.9 < h < 5.1


def test_missing_days():
    today = date(2026, 11, 8)
    done = {"2026-11-06"}
    assert s.missing_days(done, today, 3, 1) == [date(2026, 11, 5), date(2026, 11, 7)]
    assert s.missing_days(done, today, 3, 2) == [date(2026, 11, 5)]

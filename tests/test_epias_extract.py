"""extract.py testleri: ağ yok, eptr2 istemcisi sahte; fixture'lar canlı API'den kaydedildi."""

import datetime as dt
import json
from pathlib import Path

import pandas as pd
import pytest

from pipeline.epias import extract

FIX = Path(__file__).parent / "fixtures"
DAY = dt.date(2026, 11, 6)


def load(name: str) -> pd.DataFrame:
    return pd.DataFrame(json.loads((FIX / f"{name}.json").read_text(encoding="utf-8")))


class FakeClient:
    def __init__(self, responses):
        self.responses = responses  # servis -> DataFrame | callable(**params) | list (sırayla)
        self.calls = []

    def call(self, service, **params):
        self.calls.append((service, params))
        r = self.responses[service]
        if callable(r):
            return r(**params)
        return r


@pytest.fixture
def fake(monkeypatch):
    def install(responses):
        client = FakeClient(responses)
        monkeypatch.setattr(extract, "get_client", lambda: client)
        return client

    monkeypatch.setattr(extract._call.retry, "sleep", lambda s: None)
    monkeypatch.setattr(extract, "CHUNK_SLEEP_S", 0)
    return install


def test_source_ts_is_utc_hour_start(fake):
    fake({"rt-gen": load("rt_gen")})
    df = extract.fetch_generation_by_source(DAY)
    assert str(df["ts"].dtype) == "datetime64[ns, UTC]"
    # 2026-11-06 00:00 +03:00 -> 2026-11-05 21:00 UTC
    assert df["ts"].iloc[0] == pd.Timestamp("2026-11-05T21:00:00Z")
    assert df["ts"].iloc[1] == pd.Timestamp("2026-11-05T22:00:00Z")
    assert not {"date", "hour", "time"} & set(df.columns)
    assert all(str(t) == "float64" for t in df.dtypes.iloc[1:])
    assert {"total", "naturalGas", "importExport"} <= set(df.columns)


def test_unknown_numeric_column_passes_through(fake):
    raw = load("rt_gen")
    raw["nuclear"] = [1, 2, 3]
    fake({"rt-gen": raw})
    df = extract.fetch_generation_by_source(DAY)
    assert df["nuclear"].tolist() == [1.0, 2.0, 3.0]
    assert str(df["nuclear"].dtype) == "float64"


def test_plant_id_parsed_from_both_name_formats(fake):
    client = fake({"rt-gen-bulk": load("rt_gen_bulk")})
    df = extract.fetch_generation_by_plant(DAY, [641, 663])
    names = dict(zip(df["pp_id"], df["power_plant_name"]))
    assert names == {641: "ATATÜRK HES-40W000000000142N-641", 663: "ACIBADEM BURSA-663"}
    assert df["pp_id"].dtype == "int64"
    assert len(df) == 4
    assert "powerPlantName" not in df.columns
    assert df["ts"].min() == pd.Timestamp("2026-11-05T21:00:00Z")
    assert client.calls[0][1]["date"] == "2026-11-06"


def test_plant_unknown_numeric_column_passes_through(fake):
    raw = load("rt_gen_bulk")
    raw["nuclear"] = 0.5
    fake({"rt-gen-bulk": raw})
    assert "nuclear" in extract.fetch_generation_by_plant(DAY, [641, 663]).columns


def test_plant_chunking_max_50(fake):
    client = fake({"rt-gen-bulk": lambda **p: pd.DataFrame()})
    df = extract.fetch_generation_by_plant(DAY, list(range(1, 121)))
    sizes = [len(p["pp_ids"]) for _, p in client.calls]
    assert sizes == [50, 50, 20]
    assert list(df.columns) == ["ts", "pp_id", "power_plant_name"]
    assert df.empty


def test_plant_default_ids_come_from_plant_list(fake):
    client = fake({"pp-list": load("pp_list"), "rt-gen-bulk": lambda **p: pd.DataFrame()})
    extract.fetch_generation_by_plant(DAY)
    bulk = [p for s, p in client.calls if s == "rt-gen-bulk"]
    assert bulk[0]["pp_ids"] == load("pp_list")["id"].tolist()


def test_plant_chunk_failure_raises(fake):
    def bulk(**p):
        raise Exception("Request failed with status code: 500\nboom")

    fake({"rt-gen-bulk": bulk})
    with pytest.raises(Exception, match="500"):
        extract.fetch_generation_by_plant(DAY, [1, 2])


def test_duplicates_raise(fake):
    raw = load("rt_gen")
    fake({"rt-gen": pd.concat([raw, raw.head(1)], ignore_index=True)})
    with pytest.raises(extract.DuplicateKeyError):
        extract.fetch_generation_by_source(DAY)


def test_plant_duplicates_raise(fake):
    raw = load("rt_gen_bulk")
    fake({"rt-gen-bulk": pd.concat([raw, raw.head(1)], ignore_index=True)})
    with pytest.raises(extract.DuplicateKeyError):
        extract.fetch_generation_by_plant(DAY, [641, 663])


def test_empty_responses(fake):
    fake({s: pd.DataFrame() for s in ("rt-gen", "mcp", "ren-ul-gen", "pp-list")})
    assert list(extract.fetch_generation_by_source(DAY).columns) == ["ts"]
    assert list(extract.fetch_mcp(DAY).columns) == ["ts", "price", "priceUsd", "priceEur"]
    u = extract.fetch_unlicensed_generation(DAY, DAY)
    assert list(u.columns) == ["ts"] and u.empty
    assert list(extract.fetch_power_plants().columns) == ["pp_id", "name", "eic", "short_name"]


def test_mcp(fake):
    fake({"mcp": load("mcp")})
    df = extract.fetch_mcp(DAY)
    assert list(df.columns) == ["ts", "price", "priceUsd", "priceEur"]
    assert df["ts"].iloc[0] == pd.Timestamp("2026-11-05T21:00:00Z")


def test_unlicensed(fake):
    fake({"ren-ul-gen": load("ren_ul_gen")})
    df = extract.fetch_unlicensed_generation(dt.date(2026, 9, 1), dt.date(2026, 9, 1))
    assert df["ts"].iloc[1] == pd.Timestamp("2026-08-31T22:00:00Z")
    assert {"toplam", "ruzgar", "gunes"} <= set(df.columns)
    assert not {"date", "time"} & set(df.columns)


def test_power_plants(fake):
    raw = load("pp_list")
    raw.loc[0, "eic"] = None
    fake({"pp-list": raw})
    df = extract.fetch_power_plants()
    assert list(df.columns) == ["pp_id", "name", "eic", "short_name"]
    assert df["pp_id"].dtype == "int64"
    assert df["eic"].iloc[0] is None


def test_transient_error_is_retried(fake):
    n = {"i": 0}

    def flaky(**p):
        n["i"] += 1
        if n["i"] < 3:
            raise Exception("Request failed with status code: 503\nbusy")
        return load("mcp")

    fake({"mcp": flaky})
    assert len(extract.fetch_mcp(DAY)) == 3
    assert n["i"] == 3


def test_auth_error_not_retried(fake):
    n = {"i": 0}

    def denied(**p):
        n["i"] += 1
        raise Exception("Request failed with status code: 401: unauthorized")

    fake({"mcp": denied})
    with pytest.raises(Exception, match="401"):
        extract.fetch_mcp(DAY)
    assert n["i"] == 1


def test_persistent_failure_gives_up_after_5(fake):
    n = {"i": 0}

    def down(**p):
        n["i"] += 1
        raise TimeoutError("t")

    fake({"mcp": down})
    with pytest.raises(TimeoutError):
        extract.fetch_mcp(DAY)
    assert n["i"] == 5

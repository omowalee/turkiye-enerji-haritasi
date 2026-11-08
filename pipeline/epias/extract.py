"""EPİAŞ Şeffaflık Platformu'ndan veri çeker (eptr2 üzerinden).

Her fonksiyon `ts` (saat başlangıcı, UTC) ile başlayan bir DataFrame döndürür.
API'nin döndürdüğü sayısal kolonlar adı değiştirilmeden, float64 olarak geçirilir;
bilinmeyen/yeni kolonlar (ör. nükleer) düşürülmez.
"""

import datetime as dt
import re
import time
from functools import cache

import pandas as pd
import urllib3
from eptr2 import EPTR2
from tenacity import retry, retry_if_exception, stop_after_attempt, wait_exponential

from pipeline.config import EPIAS_PASSWORD, EPIAS_USERNAME, TZ

CHUNK_SIZE = 50
CHUNK_SLEEP_S = 0.3
_STRING_DATE_COLS = ("date", "hour", "time")
_HTTP_STATUS = re.compile(r"status code: (\d{3})")
_TRANSIENT_STATUS = {408, 429}


class DuplicateKeyError(ValueError):
    """API aynı anahtar için birden fazla satır döndürdü."""


def _is_transient(exc: BaseException) -> bool:
    """Ağ hataları, zaman aşımı ve HTTP 5xx/408/429 yeniden denenir; kimlik hataları denenmez."""
    if isinstance(exc, (urllib3.exceptions.HTTPError, OSError)):
        return True
    m = _HTTP_STATUS.search(str(exc))
    return bool(m) and (int(m[1]) >= 500 or int(m[1]) in _TRANSIENT_STATUS)


@cache
def get_client() -> EPTR2:
    # use_dotenv=False: eptr2 aksi halde .env'i cp1254 ile okuyup Türkçe karakterde çöker.
    return EPTR2(username=EPIAS_USERNAME, password=EPIAS_PASSWORD, use_dotenv=False)


@retry(
    retry=retry_if_exception(_is_transient),
    stop=stop_after_attempt(5),
    wait=wait_exponential(multiplier=2, max=60),
    reraise=True,
)
def _call(service: str, **params) -> pd.DataFrame:
    df = get_client().call(service, **params)
    return pd.DataFrame() if df is None else df


def _iso(day: dt.date) -> str:
    return day.isoformat()


def _derive_ts(df: pd.DataFrame) -> pd.Series:
    """Saat başlangıcını UTC olarak üretir. `date` günün başlangıcı (+03:00) veya saatin kendisi olabilir."""
    start = pd.to_datetime(df["date"], utc=True).dt.tz_convert(TZ)
    if "hour" in df.columns:  # "HH:MM"
        start = start.dt.normalize() + pd.to_timedelta(df["hour"] + ":00")
    return start.dt.tz_convert("UTC").astype("datetime64[ns, UTC]")


def _with_ts(df: pd.DataFrame) -> pd.DataFrame:
    """`ts` ekler, date/hour/time kolonlarını atar, geri kalan sayısal kolonları float64 yapar."""
    ts = _derive_ts(df)
    numeric = [c for c in df.columns if c not in _STRING_DATE_COLS and pd.api.types.is_numeric_dtype(df[c])]
    out = df[numeric].astype("float64")
    out.insert(0, "ts", ts)
    return out


def _check_unique(df: pd.DataFrame, keys: list[str], what: str) -> None:
    dup = df.duplicated(keys, keep=False)
    if dup.any():
        sample = df.loc[dup, keys].head(5).to_dict("records")
        raise DuplicateKeyError(f"{what}: {int(dup.sum())} satır yinelenen anahtar {keys}, örnek: {sample}")


def _empty(columns: dict[str, str]) -> pd.DataFrame:
    return pd.DataFrame({c: pd.Series(dtype=t) for c, t in columns.items()})


_TS_DTYPE = "datetime64[ns, UTC]"


def fetch_power_plants() -> pd.DataFrame:
    """Santral listesi: pp_id, name, eic, short_name."""
    df = _call("pp-list")
    if df.empty:
        return _empty({"pp_id": "int64", "name": "object", "eic": "object", "short_name": "object"})
    out = df.rename(columns={"id": "pp_id", "shortName": "short_name"})[["pp_id", "name", "eic", "short_name"]]
    out = out.astype({"pp_id": "int64"})
    for c in ("name", "eic", "short_name"):
        out[c] = out[c].astype(object).where(out[c].notna(), None)
    _check_unique(out, ["pp_id"], "pp-list")
    return out.reset_index(drop=True)


def fetch_generation_by_source(day: dt.date) -> pd.DataFrame:
    """Kaynak bazlı saatlik toplam üretim (rt-gen); `day` İstanbul yerel günü."""
    df = _call("rt-gen", start_date=_iso(day), end_date=_iso(day))
    if df.empty:
        return _empty({"ts": _TS_DTYPE})
    out = _with_ts(df)
    _check_unique(out, ["ts"], "rt-gen")
    return out.reset_index(drop=True)


def _pp_id_from_name(name: str) -> int:
    """'AD-EIC-ID' veya 'AD-ID' biçiminden son parçayı (santral id'si) alır."""
    return int(name.rsplit("-", 1)[1])


def fetch_generation_by_plant(day: dt.date, pp_ids: list[int] | None = None) -> pd.DataFrame:
    """Santral bazlı saatlik üretim (rt-gen-bulk). Bir grup bile başarısız olursa hata fırlatır."""
    if pp_ids is None:
        pp_ids = fetch_power_plants()["pp_id"].tolist()
    ids = [int(i) for i in pp_ids]
    frames = []
    for i in range(0, len(ids), CHUNK_SIZE):
        if i:
            time.sleep(CHUNK_SLEEP_S)
        part = _call("rt-gen-bulk", date=_iso(day), pp_ids=ids[i : i + CHUNK_SIZE])
        if not part.empty:
            frames.append(part)
    if not frames:
        return _empty({"ts": _TS_DTYPE, "pp_id": "int64", "power_plant_name": "object"})
    df = pd.concat(frames, ignore_index=True)
    out = _with_ts(df)
    out.insert(1, "pp_id", df["powerPlantName"].map(_pp_id_from_name).astype("int64"))
    out.insert(2, "power_plant_name", df["powerPlantName"].astype(object))
    _check_unique(out, ["ts", "pp_id"], "rt-gen-bulk")
    return out.reset_index(drop=True)


def fetch_consumption(day: dt.date) -> pd.DataFrame:
    """Gerçek zamanlı tüketim (rt-cons): `consumption` (MWh/saat); `day` İstanbul yerel günü."""
    df = _call("rt-cons", start_date=_iso(day), end_date=_iso(day))
    if df.empty:
        return _empty({"ts": _TS_DTYPE})
    out = _with_ts(df)
    _check_unique(out, ["ts"], "rt-cons")
    return out.reset_index(drop=True)


def fetch_mcp(day: dt.date) -> pd.DataFrame:
    """Piyasa takas fiyatı (PTF): price, priceUsd, priceEur."""
    df = _call("mcp", start_date=_iso(day), end_date=_iso(day))
    if df.empty:
        return _empty({"ts": _TS_DTYPE, "price": "float64", "priceUsd": "float64", "priceEur": "float64"})
    out = _with_ts(df)
    _check_unique(out, ["ts"], "mcp")
    return out.reset_index(drop=True)


def fetch_unlicensed_generation(start: dt.date, end: dt.date) -> pd.DataFrame:
    """Lisanssız üretim (ren-ul-gen). Yayımlanmamış dönem için yalnızca `ts` kolonlu boş tablo."""
    df = _call("ren-ul-gen", start_date=_iso(start), end_date=_iso(end))
    if df.empty:
        return _empty({"ts": _TS_DTYPE})
    out = _with_ts(df)
    _check_unique(out, ["ts"], "ren-ul-gen")
    return out.reset_index(drop=True)

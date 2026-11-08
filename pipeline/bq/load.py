"""Raw tablolara idempotent yükleme.

Yerel gün / UTC sorunu: API günü İstanbul yereli (00:00 yerel = önceki gün 21:00 UTC).
Tablolar UTC `ts` yerine yerel tarih kolonu `date_local` (DATE) üzerinden bölümlenir;
böylece bir yerel gün tam olarak tek bölümdür ve `tablo$YYYYMMDD` + WRITE_TRUNCATE ile
o bölüm tek atomik işlemde değiştirilir. Tekrar çalıştırma çoğaltma üretmez.
"""

from datetime import date, datetime, timezone

import pandas as pd
from google.cloud import bigquery

from pipeline.bq.client import table_id
from pipeline.config import TZ


def local_today() -> date:
    return datetime.now(TZ).date()


def partition_id(day: date, monthly: bool = False) -> str:
    return day.strftime("%Y%m" if monthly else "%Y%m%d")


def add_local_date(df: pd.DataFrame) -> pd.DataFrame:
    """ts'yi UTC'ye sabitler ve İstanbul yerel tarihini `date_local` olarak ekler."""
    df = df.copy()
    df["ts"] = pd.to_datetime(df["ts"], utc=True)
    df["date_local"] = df["ts"].dt.tz_convert(TZ).dt.date
    return df


def is_day_complete(df: pd.DataFrame, day: date, today: date | None = None) -> bool:
    """24 farklı saat var ve gün geçmişte ise tamamdır."""
    today = today or local_today()
    return day < today and df["ts"].nunique() == 24


def next_month(d: date) -> date:
    return date(d.year + (d.month == 12), d.month % 12 + 1, 1)


def window_start(ref: date, months: int) -> date:
    """ref'in ayı dahil son `months` ayın ilk günü."""
    y, m = ref.year, ref.month - (months - 1)
    while m < 1:
        y, m = y - 1, m + 12
    return date(y, m, 1)


def months_between(start: date, end: date) -> list[date]:
    """start ve end'i kapsayan ayların ilk günleri."""
    out, y, m = [], start.year, start.month
    while (y, m) <= (end.year, end.month):
        out.append(date(y, m, 1))
        y, m = next_month(date(y, m, 1)).timetuple()[:2]
    return out


def _numeric_to_float(df: pd.DataFrame, keep: set[str]) -> pd.DataFrame:
    # Kolon tipi zamanla kaymasın (INT64 tabloya FLOAT yükleme hatası): sayılar hep FLOAT64.
    for c in df.columns:
        if c not in keep and pd.api.types.is_numeric_dtype(df[c]):
            df[c] = df[c].astype("float64")
    return df


def replace_partition(client: bigquery.Client, table: str, df: pd.DataFrame, part: date,
                      monthly: bool = False) -> int:
    """df'i tablonun ilgili bölümüne yazar (WRITE_TRUNCATE). Yeni kolonlara izin verir."""
    df = df.copy()
    df["ingested_at"] = datetime.now(timezone.utc)
    df = _numeric_to_float(df, {"pp_id"})
    cfg = bigquery.LoadJobConfig(
        write_disposition=bigquery.WriteDisposition.WRITE_TRUNCATE,
        schema_update_options=[bigquery.SchemaUpdateOption.ALLOW_FIELD_ADDITION],
    )
    dest = f"{table_id(table)}${partition_id(part, monthly)}"
    client.load_table_from_dataframe(df, dest, job_config=cfg).result()
    return len(df)


def log_load(client: bigquery.Client, table: str, partition_key: str, row_count: int,
             is_complete: bool) -> None:
    row = pd.DataFrame([{"table_name": table, "partition_key": partition_key,
                         "row_count": row_count, "loaded_at": datetime.now(timezone.utc),
                         "is_complete": is_complete}])
    client.load_table_from_dataframe(row, table_id("load_log")).result()


def complete_days(client: bigquery.Client, table: str) -> set[str]:
    """Son yüklemesi is_complete olan bölüm anahtarları (YYYY-MM-DD)."""
    sql = f"""
    SELECT partition_key FROM `{table_id('load_log')}`
    WHERE table_name = @t
    QUALIFY ROW_NUMBER() OVER (PARTITION BY partition_key ORDER BY loaded_at DESC) = 1
      AND is_complete
    """
    cfg = bigquery.QueryJobConfig(query_parameters=[bigquery.ScalarQueryParameter("t", "STRING", table)])
    return {r.partition_key for r in client.query(sql, job_config=cfg).result()}

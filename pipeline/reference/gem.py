"""GEM Global Integrated Power (Türkiye) -> geo_raw.gem_plants."""

import re
from datetime import datetime, timezone

import pandas as pd
from google.cloud import bigquery

from pipeline.config import GCP_PROJECT_ID, GEO_DATASET, ROOT

XLSX = ROOT / "data" / "raw" / "gem" / "Global Integrated Power September 2026 V2.xlsx"
SHEET = "Power facilities"
FLOAT_COLS = ["Capacity (MW)", "Latitude", "Longitude"]
TURKEY = {"türkiye", "turkiye", "turkey"}


def sanitize_column(name: str) -> str:
    """'Capacity (MW)' -> 'capacity_mw'. Orijinal ad tablo kolon açıklamasında tutulur."""
    s = re.sub(r"[^0-9a-z]+", "_", name.lower().replace("ı", "i")).strip("_")
    return f"c_{s}" if s[:1].isdigit() else s


def read_turkey() -> pd.DataFrame:
    df = pd.read_excel(XLSX, sheet_name=SHEET, dtype=str)
    df = df[df["Country/area"].str.strip().str.lower().isin(TURKEY)].copy()
    for c in FLOAT_COLS:
        df[c] = pd.to_numeric(df[c], errors="coerce")
    return df.reset_index(drop=True)


def load(client: bigquery.Client) -> int:
    df = read_turkey()
    mapping = {c: sanitize_column(c) for c in df.columns}
    assert len(set(mapping.values())) == len(mapping), "sanitize çakışması"
    df = df.rename(columns=mapping)
    df["source_file"] = XLSX.name
    df["ingested_at"] = datetime.now(timezone.utc)
    schema = [bigquery.SchemaField(new, "FLOAT64" if old in FLOAT_COLS else "STRING",
                                   description=f"GEM: {old}") for old, new in mapping.items()]
    schema += [bigquery.SchemaField("source_file", "STRING"),
               bigquery.SchemaField("ingested_at", "TIMESTAMP")]
    cfg = bigquery.LoadJobConfig(schema=schema, write_disposition="WRITE_TRUNCATE")
    client.load_table_from_dataframe(df, f"{GCP_PROJECT_ID}.{GEO_DATASET}.gem_plants",
                                     job_config=cfg).result()
    return len(df)

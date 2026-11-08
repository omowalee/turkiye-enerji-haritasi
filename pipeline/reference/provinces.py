"""geoBoundaries TUR ADM1 -> geo_raw.provinces (GEOGRAPHY)."""

import json

import pandas as pd
from google.cloud import bigquery

from pipeline.config import GCP_PROJECT_ID, GEO_DATASET, ROOT

GEOJSON = ROOT / "data" / "raw" / "geoboundaries_tur_adm1_simplified.geojson"
TABLE = f"{GCP_PROJECT_ID}.{GEO_DATASET}.provinces"


def plate_code(iso: str) -> int:
    return int(iso.split("-")[1])  # 'TR-01' -> 1


def load(client: bigquery.Client) -> int:
    feats = json.loads(GEOJSON.read_text(encoding="utf-8"))["features"]
    df = pd.DataFrame([{"province_name": f["properties"]["shapeName"],
                        "iso_code": f["properties"]["shapeISO"],
                        "plate_code": plate_code(f["properties"]["shapeISO"]),
                        "geom_json": json.dumps(f["geometry"])} for f in feats])
    stg = TABLE + "_stg"
    client.load_table_from_dataframe(
        df, stg, job_config=bigquery.LoadJobConfig(write_disposition="WRITE_TRUNCATE")).result()
    client.query(f"""
        CREATE OR REPLACE TABLE `{TABLE}` AS
        SELECT province_name, iso_code, plate_code,
               ST_GEOGFROMGEOJSON(geom_json, make_valid => TRUE) AS geom,
               CURRENT_TIMESTAMP() AS ingested_at
        FROM `{stg}`""").result()
    client.delete_table(stg)
    return len(df)


def check_point(client: bigquery.Client, lat: float, lon: float) -> list[str]:
    sql = f"SELECT province_name FROM `{TABLE}` WHERE ST_CONTAINS(geom, ST_GEOGPOINT({lon}, {lat}))"
    return [r.province_name for r in client.query(sql).result()]

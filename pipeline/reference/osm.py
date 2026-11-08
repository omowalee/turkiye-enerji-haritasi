"""OSM power=plant (Overpass) -> data/raw/osm/plants_<tarih>.json -> geo_raw.osm_plants."""

import json
import logging
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime, timezone

import pandas as pd
from google.cloud import bigquery
from tenacity import before_sleep_log, retry, retry_if_exception, stop_after_attempt, wait_exponential

from pipeline.config import GCP_PROJECT_ID, GEO_DATASET, ROOT

log = logging.getLogger(__name__)
URL = "https://overpass-api.de/api/interpreter"
QUERY = ('[out:json][timeout:200];area["ISO3166-1"="TR"][admin_level=2]->.a;'
         'nwr["power"="plant"](area.a);out center tags;')
UA = "turkiye-enerji-haritasi/0.1"


def _retryable(e: BaseException) -> bool:
    if isinstance(e, urllib.error.HTTPError):
        return e.code in (429, 502, 503, 504)
    return isinstance(e, (urllib.error.URLError, TimeoutError, ConnectionError))


@retry(retry=retry_if_exception(_retryable), stop=stop_after_attempt(6),
       wait=wait_exponential(multiplier=15, max=240), reraise=True,
       before_sleep=before_sleep_log(log, logging.WARNING))
def fetch() -> dict:
    req = urllib.request.Request(URL, data=urllib.parse.urlencode({"data": QUERY}).encode(),
                                 headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=300) as r:
        return json.loads(r.read())


def to_frame(elements: list[dict]) -> pd.DataFrame:
    rows = []
    for e in elements:
        t = e.get("tags", {})
        c = e.get("center", e)  # node'da lat/lon doğrudan, way/relation'da center
        rows.append({"osm_type": e["type"], "osm_id": e["id"], "lat": c.get("lat"),
                     "lon": c.get("lon"), "name": t.get("name"),
                     "plant_source": t.get("plant:source"),
                     "plant_output_electricity": t.get("plant:output:electricity"),
                     "operator": t.get("operator"),
                     "tags_json": json.dumps(t, ensure_ascii=False)})
    return pd.DataFrame(rows)


def load(client: bigquery.Client) -> int:
    data = fetch()
    out = ROOT / "data" / "raw" / "osm" / f"plants_{date.today().isoformat()}.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    df = to_frame(data["elements"])
    df["ingested_at"] = datetime.now(timezone.utc)
    cfg = bigquery.LoadJobConfig(write_disposition="WRITE_TRUNCATE", schema=[
        bigquery.SchemaField("osm_type", "STRING"), bigquery.SchemaField("osm_id", "INT64"),
        bigquery.SchemaField("lat", "FLOAT64"), bigquery.SchemaField("lon", "FLOAT64"),
        bigquery.SchemaField("name", "STRING"), bigquery.SchemaField("plant_source", "STRING"),
        bigquery.SchemaField("plant_output_electricity", "STRING"),
        bigquery.SchemaField("operator", "STRING"), bigquery.SchemaField("tags_json", "STRING"),
        bigquery.SchemaField("ingested_at", "TIMESTAMP")])
    client.load_table_from_dataframe(df, f"{GCP_PROJECT_ID}.{GEO_DATASET}.osm_plants",
                                     job_config=cfg).result()
    return len(df)

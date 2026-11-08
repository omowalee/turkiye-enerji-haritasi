"""BigQuery istemcisi, dataset ve tablo tanımları.

Kısmi (partition) kimliği için yerel gün kullanılır: bkz. pipeline/bq/load.py.
Tablolarda yalnızca anahtar kolonlar tanımlıdır; EPİAŞ'ın sayısal kolonları
yüklemede ALLOW_FIELD_ADDITION ile eklenir (yeni kolon, örn. nükleer, kaybolmaz).
"""

from google.cloud import bigquery

from pipeline.config import BQ_LOCATION, GCP_PROJECT_ID, GEO_DATASET, RAW_DATASET

SF = bigquery.SchemaField

# tablo adı -> (şema, bölümleme kolonu, bölümleme türü, kümeleme kolonları)
TABLES = {
    "realtime_generation_plant": (
        [SF("ts", "TIMESTAMP"), SF("date_local", "DATE"),
         SF("pp_id", "INT64"), SF("power_plant_name", "STRING"),
         SF("ingested_at", "TIMESTAMP")],
        "date_local", bigquery.TimePartitioningType.DAY, ["pp_id"]),
    "realtime_generation_source": (
        [SF("ts", "TIMESTAMP"), SF("date_local", "DATE"),
         SF("ingested_at", "TIMESTAMP")],
        "date_local", bigquery.TimePartitioningType.DAY, None),
    "realtime_consumption": (
        [SF("ts", "TIMESTAMP"), SF("date_local", "DATE"),
         SF("consumption", "FLOAT64"), SF("ingested_at", "TIMESTAMP")],
        "date_local", bigquery.TimePartitioningType.DAY, None),
    "market_clearing_price": (
        [SF("ts", "TIMESTAMP"), SF("date_local", "DATE"),
         SF("price", "FLOAT64"), SF("priceUsd", "FLOAT64"), SF("priceEur", "FLOAT64"),
         SF("ingested_at", "TIMESTAMP")],
        "date_local", bigquery.TimePartitioningType.DAY, None),
    "unlicensed_generation": (
        [SF("ts", "TIMESTAMP"), SF("date_local", "DATE"),
         SF("ingested_at", "TIMESTAMP")],
        "date_local", bigquery.TimePartitioningType.MONTH, None),
    "power_plants": (
        [SF("snapshot_date", "DATE"), SF("pp_id", "INT64"),
         SF("name", "STRING"), SF("eic", "STRING"), SF("short_name", "STRING"),
         SF("ingested_at", "TIMESTAMP")],
        "snapshot_date", bigquery.TimePartitioningType.DAY, None),
    "load_log": (
        [SF("table_name", "STRING"), SF("partition_key", "STRING"),
         SF("row_count", "INT64"), SF("loaded_at", "TIMESTAMP"),
         SF("is_complete", "BOOL")],
        None, None, None),
}


def get_client() -> bigquery.Client:
    return bigquery.Client(project=GCP_PROJECT_ID, location=BQ_LOCATION)


def ensure_datasets(client: bigquery.Client) -> None:
    for name in (RAW_DATASET, GEO_DATASET):
        ds = bigquery.Dataset(f"{GCP_PROJECT_ID}.{name}")
        ds.location = BQ_LOCATION
        client.create_dataset(ds, exists_ok=True)


def ensure_tables(client: bigquery.Client) -> None:
    ensure_datasets(client)
    for name, (schema, part_col, part_type, cluster) in TABLES.items():
        table = bigquery.Table(f"{GCP_PROJECT_ID}.{RAW_DATASET}.{name}", schema=schema)
        if part_col:
            table.time_partitioning = bigquery.TimePartitioning(type_=part_type, field=part_col)
        if cluster:
            table.clustering_fields = cluster
        client.create_table(table, exists_ok=True)


def table_id(name: str) -> str:
    return f"{GCP_PROJECT_ID}.{RAW_DATASET}.{name}"


if __name__ == "__main__":
    c = get_client()
    ensure_tables(c)
    print("datasets ve tablolar hazır")
